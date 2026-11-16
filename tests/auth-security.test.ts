import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { Secret, TOTP } from "otpauth";
import { UserRole } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { sha256Hex } from "../src/lib/crypto";
import { clientErrorStatus } from "../src/lib/api-error";
import {
  assertRoleAccess,
  bumpTokenVersion,
  emailAuditFields,
  getUserForSessionToken,
  hashPassword,
  issueSessionToken,
  verifySessionToken,
  LOGIN_LOCK_THRESHOLD,
  type AuthRequestMeta,
} from "../src/lib/auth";
import { attemptPasswordLogin, completeMfaLogin } from "../src/app/api/auth/_lib/login";
import { beginMfaSetup, disableMfa, enableMfa, verifyTotpForUser } from "../src/app/api/auth/_lib/mfa";
import {
  confirmEmailVerification,
  confirmPasswordReset,
  createEmailVerification,
  requestPasswordReset,
} from "../src/app/api/auth/_lib/tokens";
import { POST as loginRoute } from "../src/app/api/auth/login/route";
import { checkCsrf } from "../src/proxy";

async function runAuthSecuritySuite() {
  console.log("=========================================================");
  console.log("🔐 WIZZ.PK AUTHENTICATION & SESSION SECURITY SUITE");
  console.log("=========================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  async function expectThrow(fn: () => Promise<unknown>): Promise<Error | null> {
    try {
      await fn();
      return null;
    } catch (err) {
      return err instanceof Error ? err : new Error(String(err));
    }
  }

  const nonce = `${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 1000)}`;
  const meta: AuthRequestMeta = { ipAddress: "127.0.0.1", userAgent: "auth-security-test" };
  const PASSWORD = "Correct-Horse-42";
  const createdUserIds: string[] = [];

  async function makeUser(label: string, role: UserRole, passwordHash?: string) {
    const user = await prisma.user.create({
      data: {
        email: `auth_${label}_${nonce}@example.com`,
        passwordHash: passwordHash ?? (await hashPassword(PASSWORD)),
        firstName: "Auth",
        lastName: label,
        role,
      },
    });
    createdUserIds.push(user.id);
    return user;
  }

  /** TOTP code for a time offset (steps of 30 s) from now. */
  function totpAt(secretBase32: string, stepOffset: number) {
    return TOTP.generate({ secret: Secret.fromBase32(secretBase32), timestamp: Date.now() + stepOffset * 30_000 });
  }

  try {
    // -----------------------------------------------------------------------
    console.log("🧪 [TEST 1] Session revocation via tokenVersion");
    const customer = await makeUser("revoke", UserRole.CUSTOMER);
    const token = await issueSessionToken(customer, { mfa: false });
    const claims = await verifySessionToken(token);
    assert(claims?.tv === 0 && claims?.mfa === false, "Session JWT carries tv (tokenVersion) and mfa claims");
    assert((await getUserForSessionToken(token))?.id === customer.id, "Fresh session resolves to its user");
    await bumpTokenVersion(customer.id);
    assert((await getUserForSessionToken(token)) === null, "Session is rejected after tokenVersion bump (sign out everywhere)");
    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: customer.id } });
    const token2 = await issueSessionToken(fresh, { mfa: false });
    assert((await getUserForSessionToken(token2))?.id === customer.id, "Session issued for the new tokenVersion works");

    // -----------------------------------------------------------------------
    console.log("\n🧪 [TEST 2] Identical responses for unknown email vs wrong password");
    const victim = await makeUser("enum", UserRole.CUSTOMER);
    const callLogin = async (email: string, password: string, ip: string) => {
      const started = Date.now();
      const res = await loginRoute(
        new NextRequest("http://localhost:3000/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json", "x-real-ip": ip, origin: "http://localhost:3000" },
          body: JSON.stringify({ email, password }),
        })
      );
      return { status: res.status, body: await res.text(), ms: Date.now() - started };
    };
    const wrongPw = await callLogin(victim.email, "Not-The-Password-1", `10.1.${nonce.slice(-3)}.1`);
    const unknown = await callLogin(`nobody_${nonce}@example.com`, "Not-The-Password-1", `10.1.${nonce.slice(-3)}.2`);
    assert(wrongPw.status === 401 && unknown.status === 401, `Both return HTTP 401 (got ${wrongPw.status} / ${unknown.status})`);
    assert(wrongPw.body === unknown.body, `Response bodies are byte-identical (${wrongPw.body})`);
    assert(
      unknown.ms >= wrongPw.ms * 0.5,
      `Unknown email still runs a bcrypt comparison (timing ${unknown.ms}ms vs ${wrongPw.ms}ms)`
    );

    // -----------------------------------------------------------------------
    console.log("\n🧪 [TEST 3] Progressive account lockout (10 failures / 15 min)");
    const lockUser = await makeUser("lock", UserRole.CUSTOMER);
    let lastKind = "";
    let lockedAt = -1;
    for (let i = 1; i <= LOGIN_LOCK_THRESHOLD; i++) {
      const r = await attemptPasswordLogin({ email: lockUser.email, password: `wrong-${i}-pass`, meta });
      lastKind = r.kind;
      if (r.kind === "locked" && lockedAt < 0) lockedAt = i;
    }
    assert(lockedAt === LOGIN_LOCK_THRESHOLD, `Account locks on failure #${LOGIN_LOCK_THRESHOLD} (locked at ${lockedAt}, last=${lastKind})`);
    const whileLocked = await attemptPasswordLogin({ email: lockUser.email, password: PASSWORD, meta });
    assert(whileLocked.kind === "locked", "Correct password is refused while the account is locked");
    const lockEvents = await prisma.auditEvent.count({
      where: { entityType: "Auth", entityId: lockUser.id, action: "LOGIN_LOCKED" },
    });
    const failEvents = await prisma.auditEvent.findMany({
      where: { entityType: "Auth", entityId: lockUser.id, action: "LOGIN_FAILED" },
      select: { detailsJson: true, ipAddress: true, userAgent: true },
    });
    assert(lockEvents >= 2 && failEvents.length === LOGIN_LOCK_THRESHOLD, "LOGIN_FAILED and LOGIN_LOCKED audit events recorded");
    assert(
      failEvents.every((e) => !e.detailsJson.includes(lockUser.email) && !e.detailsJson.includes("wrong-") && e.ipAddress === "127.0.0.1" && e.userAgent === "auth-security-test"),
      "Audit details hold no email address or password; IP and user agent are recorded"
    );

    const ghostEmail = `ghost_${nonce}@example.com`;
    let ghostLocked = false;
    for (let i = 1; i <= LOGIN_LOCK_THRESHOLD; i++) {
      const r = await attemptPasswordLogin({ email: ghostEmail, password: `wrong-${i}-pass`, meta });
      if (r.kind === "locked") ghostLocked = true;
    }
    assert(ghostLocked, "Unknown emails lock the same way (lockout doesn't reveal account existence)");

    // -----------------------------------------------------------------------
    console.log("\n🧪 [TEST 4] bcrypt cost upgrade on login");
    const legacy = await makeUser("legacy", UserRole.CUSTOMER, bcrypt.hashSync(PASSWORD, 10));
    const legacyLogin = await attemptPasswordLogin({ email: legacy.email, password: PASSWORD, meta });
    const legacyAfter = await prisma.user.findUniqueOrThrow({ where: { id: legacy.id } });
    assert(legacyLogin.kind === "success" && bcrypt.getRounds(legacyAfter.passwordHash) === 12, "Cost-10 hash is rehashed at cost 12 after a successful login");

    // -----------------------------------------------------------------------
    console.log("\n🧪 [TEST 5] Platform roles require an MFA session");
    const staff = await makeUser("staff", UserRole.PLATFORM_SUPPORT);
    const staffLogin = await attemptPasswordLogin({ email: staff.email, password: PASSWORD, meta });
    assert(staffLogin.kind === "success" && staffLogin.mfaSetupRequired, "Unenrolled staff get a session flagged for MFA set-up");
    if (staffLogin.kind === "success") {
      const staffSession = await getUserForSessionToken(staffLogin.sessionToken);
      const err = await expectThrow(async () => assertRoleAccess(staffSession!, [UserRole.PLATFORM_SUPPORT]));
      assert(
        Boolean(err && err.message.includes("MFA_REQUIRED") && clientErrorStatus(err) === 403),
        `requireRole refuses a platform session without the mfa claim with 403 (${err?.message})`
      );
    }
    const customerSession = await getUserForSessionToken(token2);
    assert(
      (await expectThrow(async () => assertRoleAccess(customerSession!, [UserRole.CUSTOMER]))) === null,
      "Customer sessions are not affected by the MFA requirement"
    );

    // -----------------------------------------------------------------------
    console.log("\n🧪 [TEST 6] TOTP enrolment, login, replay protection and recovery codes");
    const setup = await beginMfaSetup(staff.id, meta);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: staff.id } });
    assert(
      setup.otpauthUri.startsWith("otpauth://totp/") && Boolean(stored.mfaSecretEnc?.startsWith("enc:v1:")) && !stored.mfaEnabled,
      "Setup returns an otpauth URI; secret stored encrypted; MFA not yet enabled"
    );
    assert(!stored.mfaSecretEnc!.includes(setup.secret), "Plain base32 secret is not stored");
    assert(
      (await expectThrow(() => enableMfa(staff.id, "000000", meta))) !== null || false,
      "Wrong code does not enable MFA"
    );
    const enrolCode = totpAt(setup.secret, 0);
    const { recoveryCodes } = await enableMfa(staff.id, enrolCode, meta);
    const enrolled = await prisma.user.findUniqueOrThrow({ where: { id: staff.id } });
    const hashes = JSON.parse(enrolled.mfaRecoveryHashesJson || "[]") as string[];
    assert(enrolled.mfaEnabled && recoveryCodes.length === 10, "MFA enabled and 10 recovery codes issued");
    assert(hashes.length === 10 && !recoveryCodes.some((c) => enrolled.mfaRecoveryHashesJson!.includes(c)), "Only hashes of recovery codes are stored");
    assert(!(await verifyTotpForUser(enrolled, enrolCode)), "Replaying the enrolment code is rejected");

    const pw = await attemptPasswordLogin({ email: staff.email, password: PASSWORD, meta });
    assert(pw.kind === "mfa_required", "Password step for an MFA account returns mfaRequired (no session yet)");
    if (pw.kind === "mfa_required") {
      const pending = await prisma.authToken.findUnique({ where: { tokenHash: sha256Hex(pw.pendingToken) } });
      assert(
        pending?.purpose === "MFA_LOGIN" && pending.expiresAt.getTime() - Date.now() <= 5 * 60_000 + 1000,
        "Pending MFA token stored hashed with a 5-minute expiry"
      );
      const replay = await completeMfaLogin({ pendingToken: pw.pendingToken, code: enrolCode, meta });
      assert(replay.kind === "invalid_code", `Already-used TOTP code is rejected at login (${replay.kind})`);
      const nextCode = totpAt(setup.secret, 1);
      const ok = await completeMfaLogin({ pendingToken: pw.pendingToken, code: nextCode, meta });
      assert(ok.kind === "success", `Fresh TOTP code (within ±1 step) completes login (${ok.kind})`);
      if (ok.kind === "success") {
        const c = await verifySessionToken(ok.sessionToken);
        assert(c?.mfa === true, "Completed login issues a session with mfa: true");
        const s = await getUserForSessionToken(ok.sessionToken);
        assert(
          (await expectThrow(async () => assertRoleAccess(s!, [UserRole.PLATFORM_SUPPORT]))) === null,
          "requireRole accepts the staff session with the mfa claim"
        );
        const reuse = await completeMfaLogin({ pendingToken: pw.pendingToken, code: totpAt(setup.secret, 1), meta });
        assert(reuse.kind === "expired", "Pending MFA token cannot be used twice");
      }
    }

    const pw2 = await attemptPasswordLogin({ email: staff.email, password: PASSWORD, meta });
    const rec1 = pw2.kind === "mfa_required" ? await completeMfaLogin({ pendingToken: pw2.pendingToken, recoveryCode: recoveryCodes[0], meta }) : null;
    assert(rec1?.kind === "success", "Recovery code completes login");
    const pw3 = await attemptPasswordLogin({ email: staff.email, password: PASSWORD, meta });
    const rec2 = pw3.kind === "mfa_required" ? await completeMfaLogin({ pendingToken: pw3.pendingToken, recoveryCode: recoveryCodes[0], meta }) : null;
    assert(rec2?.kind === "invalid_code", "The same recovery code is rejected the second time");
    const afterRec = await prisma.user.findUniqueOrThrow({ where: { id: staff.id } });
    assert((JSON.parse(afterRec.mfaRecoveryHashesJson || "[]") as string[]).length === 9, "One recovery code consumed, 9 left");

    if (pw3.kind === "mfa_required") {
      let kind = "";
      for (let i = 0; i < 6; i++) {
        kind = (await completeMfaLogin({ pendingToken: pw3.pendingToken, code: "111111", meta })).kind;
      }
      assert(kind === "expired", "Pending MFA login is void after 5 attempts");
    }

    const disableErr = await expectThrow(() => disableMfa(staff.id, { password: PASSWORD, code: totpAt(setup.secret, 0) }, meta));
    assert(Boolean(disableErr?.message.startsWith("FORBIDDEN")), "Platform staff cannot turn MFA off");

    // -----------------------------------------------------------------------
    console.log("\n🧪 [TEST 7] Password reset tokens");
    const resetUser = await makeUser("reset", UserRole.CUSTOMER);
    const sessionBefore = await issueSessionToken(resetUser, { mfa: false });
    assert((await requestPasswordReset(`nobody_${nonce}@example.com`, meta)) === null, "Unknown email creates no reset token");
    const firstMail = await requestPasswordReset(resetUser.email, meta);
    const firstToken = firstMail ? new URL(firstMail.text.match(/https?:\/\/\S+/)![0]).searchParams.get("token")! : "";
    const mail = await requestPasswordReset(resetUser.email, meta);
    const resetToken = mail ? new URL(mail.text.match(/https?:\/\/\S+/)![0]).searchParams.get("token")! : "";
    assert(Boolean(resetToken) && mail!.to === resetUser.email, "Reset email built with a link token");
    const row = await prisma.authToken.findUnique({ where: { tokenHash: sha256Hex(resetToken) } });
    assert(
      Boolean(row && row.expiresAt.getTime() - Date.now() <= 30 * 60_000 + 1000 && row.expiresAt.getTime() - Date.now() > 29 * 60_000),
      "Reset token stored as SHA-256 with a 30-minute expiry"
    );
    assert(
      (await expectThrow(() => confirmPasswordReset(firstToken, "Brand-New-Pass-1", meta))) !== null,
      "Issuing a new reset link invalidates the older one"
    );
    await confirmPasswordReset(resetToken, "Brand-New-Pass-1", meta);
    const resetAfter = await prisma.user.findUniqueOrThrow({ where: { id: resetUser.id } });
    assert(
      (await bcrypt.compare("Brand-New-Pass-1", resetAfter.passwordHash)) && resetAfter.tokenVersion === 1 && Boolean(resetAfter.passwordChangedAt),
      "Reset sets the new password, bumps tokenVersion and records passwordChangedAt"
    );
    assert((await getUserForSessionToken(sessionBefore)) === null, "Existing sessions are revoked by the reset");
    assert(
      (await expectThrow(() => confirmPasswordReset(resetToken, "Another-Pass-22", meta))) !== null,
      "Reset token is single-use"
    );
    const mail2 = await requestPasswordReset(resetUser.email, meta);
    const expiredToken = new URL(mail2!.text.match(/https?:\/\/\S+/)![0]).searchParams.get("token")!;
    await prisma.authToken.update({ where: { tokenHash: sha256Hex(expiredToken) }, data: { expiresAt: new Date(Date.now() - 1000) } });
    assert(
      (await expectThrow(() => confirmPasswordReset(expiredToken, "Another-Pass-22", meta))) !== null,
      "Expired reset token is rejected"
    );
    const weak = await expectThrow(() => confirmPasswordReset("x".repeat(43), "short", meta));
    assert(Boolean(weak?.message.startsWith("VALIDATION")), "Reset enforces the registration password rules");
    assert(
      (await prisma.auditEvent.count({ where: { entityType: "Auth", entityId: resetUser.id, action: "PASSWORD_RESET" } })) === 1,
      "PASSWORD_RESET audit event recorded"
    );

    // -----------------------------------------------------------------------
    console.log("\n🧪 [TEST 8] Email verification tokens");
    const unverified = await makeUser("verify", UserRole.CUSTOMER);
    const vMail = await createEmailVerification(unverified.id, meta);
    const vToken = vMail ? new URL(vMail.text.match(/https?:\/\/\S+/)![0]).searchParams.get("token")! : "";
    await confirmEmailVerification(vToken, meta);
    const verified = await prisma.user.findUniqueOrThrow({ where: { id: unverified.id } });
    assert(verified.isEmailVerified, "Verification link marks the email verified");
    assert((await expectThrow(() => confirmEmailVerification(vToken, meta))) !== null, "Verification token is single-use");
    assert((await createEmailVerification(unverified.id, meta)) === null, "No new link for an already verified address");

    // -----------------------------------------------------------------------
    console.log("\n🧪 [TEST 9] CSRF origin check (src/proxy.ts)");
    const base = { pathname: "/api/cart/items", host: "wizz.pk", referer: null, trustedUrls: ["https://wizz.pk"] };
    assert(!checkCsrf({ ...base, method: "POST", origin: "https://evil.example" }).ok, "Foreign Origin is rejected");
    assert(checkCsrf({ ...base, method: "POST", origin: "https://wizz.pk" }).ok, "Same-site Origin is accepted");
    assert(!checkCsrf({ ...base, method: "DELETE", origin: null }).ok, "Missing Origin and Referer is rejected");
    assert(checkCsrf({ ...base, method: "POST", origin: null, referer: "https://wizz.pk/cart" }).ok, "Same-site Referer accepted when Origin is absent");
    assert(!checkCsrf({ ...base, method: "POST", origin: null, referer: "https://wizz.pk.evil.example/x" }).ok, "Look-alike Referer host is rejected");
    assert(!checkCsrf({ ...base, method: "PATCH", origin: "null" }).ok, "Opaque Origin \"null\" is rejected");
    assert(checkCsrf({ ...base, method: "GET", origin: "https://evil.example" }).ok, "Safe methods are not blocked");
    assert(
      checkCsrf({ ...base, method: "POST", host: "127.0.0.1:3000", origin: "https://wizz.pk" }).ok,
      "APP_URL host is trusted behind a reverse proxy"
    );
    assert(
      checkCsrf({ ...base, method: "POST", pathname: "/api/webhooks/payments", origin: null }).ok &&
        checkCsrf({ ...base, method: "POST", pathname: "/api/cron/cleanup", origin: null }).ok,
      "Webhook and cron endpoints are exempt (they use their own signatures/secrets)"
    );
  } finally {
    // Test users and their Auth audit events stay in the local test database on purpose:
    // AuditEvent is insert-only (DB trigger), and deleting a user would rewrite its audit rows.
    void createdUserIds;
  }

  console.log("\n=========================================================");
  console.log(`🏁 AUTH SECURITY RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=========================================================\n");

  await prisma.$disconnect();
  if (failed > 0) {
    process.exit(1);
  }
}

runAuthSecuritySuite().catch(async (err) => {
  console.error("FATAL ERROR IN AUTH SECURITY SUITE:", err);
  await prisma.$disconnect();
  process.exit(1);
});
