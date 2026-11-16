/**
 * Lockout recovery for staff two-factor authentication. Server-side CLI only — there is
 * deliberately no HTTP route for this.
 *
 *   npm run reset-admin-mfa -- admin@wizz.pk --confirm
 *   (or: npx tsx scripts/reset-admin-mfa.ts admin@wizz.pk --confirm)
 *
 * Clears the user's TOTP secret and recovery codes, turns MFA off, signs out every session
 * (tokenVersion bump) and records an AuditEvent. A platform user must enrol again at
 * /account/security before the admin console lets them back in.
 * Verify the person's identity out of band before running this.
 */
import os from "os";
import { prisma } from "../src/lib/db";

async function main() {
  const args = process.argv.slice(2);
  const confirm = args.includes("--confirm");
  const email = args.find((a) => !a.startsWith("--"))?.toLowerCase().trim();

  if (!email || !email.includes("@")) {
    console.error("Usage: npm run reset-admin-mfa -- <email> --confirm");
    process.exit(2);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true, mfaEnabled: true },
  });
  if (!user) {
    console.error(`No user with email ${email}.`);
    process.exit(1);
  }

  console.log(`User: ${user.email} (${user.role}), two-factor currently ${user.mfaEnabled ? "ON" : "OFF"}.`);
  if (!confirm) {
    console.error("Refusing to change anything without --confirm. This turns off two-factor and signs the user out everywhere.");
    process.exit(1);
  }

  let operator = "unknown";
  try {
    operator = os.userInfo().username;
  } catch {
    // ignore
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: false,
        mfaSecretEnc: null,
        mfaRecoveryHashesJson: null,
        mfaEnabledAt: null,
        tokenVersion: { increment: 1 },
      },
    }),
    prisma.authToken.deleteMany({ where: { userId: user.id, purpose: { in: ["MFA_LOGIN", "MFA_TOTP_USED"] } } }),
    prisma.auditEvent.create({
      data: {
        actorUserId: null,
        entityType: "Auth",
        entityId: user.id,
        action: "MFA_RESET_BY_OPERATOR",
        detailsJson: JSON.stringify({ via: "scripts/reset-admin-mfa.ts", operator, host: os.hostname() }),
      },
    }),
  ]);

  console.log("Two-factor authentication was reset and all sessions were signed out.");
  console.log("The user must sign in and set up two-factor again at /account/security.");
}

main()
  .catch((err) => {
    console.error("reset-admin-mfa failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
