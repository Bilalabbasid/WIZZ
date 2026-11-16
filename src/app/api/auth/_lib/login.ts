import { NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { SITE_CONFIG } from "@/lib/config";
import { randomToken, sha256Hex } from "@/lib/crypto";
import {
  DUMMY_PASSWORD_HASH,
  emailAuditFields,
  hashPassword,
  isLoginLocked,
  isPlatformRole,
  issueSessionToken,
  passwordNeedsRehash,
  recordAuthEvent,
  registerAuthFailure,
  verifyPassword,
  type AuthRequestMeta,
} from "@/lib/auth";
import { verifySecondFactor } from "./mfa";

/** Same body and status for an unknown email and a wrong password. */
export const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password.";
export const LOCKED_MESSAGE = "Too many sign-in attempts. Please wait 15 minutes and try again, or reset your password.";

export const MFA_PENDING_COOKIE = `${SITE_CONFIG.sessionCookieName}_mfa`;
export const MFA_PENDING_TTL_SECONDS = 5 * 60;
export const MFA_MAX_ATTEMPTS = 5;

export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export type PasswordLoginResult =
  | { kind: "invalid" }
  | { kind: "locked" }
  | { kind: "mfa_required"; pendingToken: string }
  | { kind: "success"; user: PublicUser; sessionToken: string; mfaSetupRequired: boolean };

/**
 * First sign-in step. Unknown emails go through the same bcrypt comparison (against a
 * dummy hash), audit write and lock check as known ones, so responses and timing match.
 */
export async function attemptPasswordLogin(input: {
  email: unknown;
  password: unknown;
  meta: AuthRequestMeta;
}): Promise<PasswordLoginResult> {
  const cleanEmail = String(input.email ?? "").toLowerCase().trim().slice(0, 254);
  const password = typeof input.password === "string" ? input.password.slice(0, 1024) : "";
  const { emailDomain, emailHash } = emailAuditFields(cleanEmail);

  const user = await prisma.user.findUnique({
    where: { email: cleanEmail },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      passwordHash: true,
      tokenVersion: true,
      mfaEnabled: true,
    },
  });
  const userId = user?.id ?? null;

  if (await isLoginLocked(userId, emailHash)) {
    await verifyPassword(password, DUMMY_PASSWORD_HASH); // keep timing flat
    await recordAuthEvent({
      action: "LOGIN_LOCKED",
      userId,
      meta: input.meta,
      details: { reason: "attempt_while_locked", emailDomain, emailHash },
    });
    return { kind: "locked" };
  }

  const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !passwordOk) {
    const { lockedNow } = await registerAuthFailure({
      action: "LOGIN_FAILED",
      userId,
      emailHash,
      emailDomain,
      meta: input.meta,
      details: { reason: user ? "wrong_password" : "unknown_email" },
    });
    return lockedNow ? { kind: "locked" } : { kind: "invalid" };
  }

  if (passwordNeedsRehash(user.passwordHash)) {
    try {
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } });
    } catch (err) {
      console.error("[auth] password rehash failed:", err instanceof Error ? err.message : err);
    }
  }

  if (user.mfaEnabled) {
    const pendingToken = randomToken(32);
    await prisma.$transaction([
      prisma.authToken.deleteMany({ where: { userId: user.id, purpose: "MFA_LOGIN" } }),
      prisma.authToken.create({
        data: {
          userId: user.id,
          purpose: "MFA_LOGIN",
          tokenHash: sha256Hex(pendingToken),
          expiresAt: new Date(Date.now() + MFA_PENDING_TTL_SECONDS * 1000),
          ipAddress: input.meta.ipAddress,
        },
      }),
    ]);
    await recordAuthEvent({
      action: "LOGIN_SUCCESS",
      userId: user.id,
      meta: input.meta,
      details: { stage: "password", mfaPending: true, emailDomain },
    });
    return { kind: "mfa_required", pendingToken };
  }

  const sessionToken = await issueSessionToken(user, { mfa: false });
  await recordAuthEvent({
    action: "LOGIN_SUCCESS",
    userId: user.id,
    meta: input.meta,
    details: { stage: "password", mfa: false, emailDomain },
  });
  return {
    kind: "success",
    user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
    sessionToken,
    // Staff without MFA get a session that only works for enrolling (requireRole refuses it).
    mfaSetupRequired: isPlatformRole(user.role),
  };
}

export type MfaLoginResult =
  | { kind: "expired" }
  | { kind: "locked" }
  | { kind: "invalid_code"; attemptsLeft: number }
  | { kind: "success"; user: PublicUser; sessionToken: string };

/** Second sign-in step: a TOTP code or a recovery code for a pending MFA login. */
export async function completeMfaLogin(input: {
  pendingToken: string | null | undefined;
  code?: unknown;
  recoveryCode?: unknown;
  meta: AuthRequestMeta;
}): Promise<MfaLoginResult> {
  if (!input.pendingToken || typeof input.pendingToken !== "string") return { kind: "expired" };
  const now = new Date();
  const row = await prisma.authToken.findUnique({ where: { tokenHash: sha256Hex(input.pendingToken) } });
  if (!row || row.purpose !== "MFA_LOGIN" || row.usedAt || row.expiresAt <= now || row.attempts >= MFA_MAX_ATTEMPTS) {
    return { kind: "expired" };
  }

  // Spend one attempt atomically before checking the code.
  const claimed = await prisma.authToken.updateMany({
    where: { id: row.id, usedAt: null, attempts: { lt: MFA_MAX_ATTEMPTS }, expiresAt: { gt: now } },
    data: { attempts: { increment: 1 } },
  });
  if (claimed.count !== 1) return { kind: "expired" };
  const attemptsLeft = MFA_MAX_ATTEMPTS - (row.attempts + 1);

  const user = await prisma.user.findUnique({
    where: { id: row.userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      tokenVersion: true,
      mfaEnabled: true,
      mfaSecretEnc: true,
    },
  });
  if (!user || !user.mfaEnabled) return { kind: "expired" };
  const { emailDomain, emailHash } = emailAuditFields(user.email);

  if (await isLoginLocked(user.id, emailHash)) {
    await recordAuthEvent({
      action: "LOGIN_LOCKED",
      userId: user.id,
      meta: input.meta,
      details: { reason: "attempt_while_locked", stage: "mfa", emailDomain, emailHash },
    });
    return { kind: "locked" };
  }

  const second = await verifySecondFactor(user, { code: input.code, recoveryCode: input.recoveryCode }, input.meta);
  if (!second.ok) {
    const { lockedNow } = await registerAuthFailure({
      action: "MFA_FAILED",
      userId: user.id,
      emailHash,
      emailDomain,
      meta: input.meta,
      details: { method: second.method },
    });
    if (lockedNow) return { kind: "locked" };
    return attemptsLeft > 0 ? { kind: "invalid_code", attemptsLeft } : { kind: "expired" };
  }

  const used = await prisma.authToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  if (used.count !== 1) return { kind: "expired" };

  const sessionToken = await issueSessionToken(user, { mfa: true });
  await recordAuthEvent({
    action: "LOGIN_SUCCESS",
    userId: user.id,
    meta: input.meta,
    details: { stage: "mfa", method: second.method, emailDomain },
  });
  return {
    kind: "success",
    user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
    sessionToken,
  };
}

export function setMfaPendingCookie(res: NextResponse, token: string) {
  res.cookies.set(MFA_PENDING_COOKIE, token, {
    path: "/api/auth/mfa",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: MFA_PENDING_TTL_SECONDS,
  });
}

export function clearMfaPendingCookie(res: NextResponse) {
  res.cookies.set(MFA_PENDING_COOKIE, "", {
    path: "/api/auth/mfa",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
  });
}

/** Where to send a user after a completed sign-in when no ?next= is given. */
export function defaultLandingPath(role: UserRole | string): string {
  return role === "CUSTOMER" ? "/account" : "/admin";
}
