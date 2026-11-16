import { prisma } from "@/lib/db";
import { randomToken, sha256Hex } from "@/lib/crypto";
import { hashPassword, recordAuthEvent, type AuthRequestMeta } from "@/lib/auth";
import { registrationSchema } from "@/lib/validation";
import {
  appLink,
  buildEmailVerificationEmail,
  buildPasswordResetEmail,
  type OutgoingEmail,
} from "@/lib/email";

/**
 * One-time links (password reset, email verification). The raw token only ever exists in
 * the emailed link; the database keeps its SHA-256. Issuing a new token invalidates the
 * user's older unused tokens of the same purpose.
 */
export const PASSWORD_RESET_TTL_MINUTES = 30;
export const EMAIL_VERIFY_TTL_HOURS = 24;

export const PASSWORD_RESET_GENERIC_MESSAGE =
  "If an account exists for that email, we've emailed a link to reset your password. It expires in 30 minutes.";
export const RESET_LINK_INVALID_MESSAGE = "This reset link is invalid, already used or expired. Request a new one.";
export const VERIFY_LINK_INVALID_MESSAGE = "This verification link is invalid, already used or expired. Request a new one from your account.";

type TokenPurpose = "PASSWORD_RESET" | "EMAIL_VERIFY";

async function issueAuthToken(userId: string, purpose: TokenPurpose, ttlMs: number, ipAddress: string | null) {
  const token = randomToken(32);
  await prisma.$transaction([
    prisma.authToken.deleteMany({ where: { userId, purpose, usedAt: null } }),
    prisma.authToken.create({
      data: { userId, purpose, tokenHash: sha256Hex(token), expiresAt: new Date(Date.now() + ttlMs), ipAddress },
    }),
  ]);
  return token;
}

/**
 * Creates a reset token for the address if an account exists and returns the email to
 * send (null when there is no account). Callers respond identically either way.
 */
export async function requestPasswordReset(email: unknown, meta: AuthRequestMeta): Promise<OutgoingEmail | null> {
  const cleanEmail = String(email ?? "").toLowerCase().trim().slice(0, 254);
  if (!cleanEmail.includes("@")) return null;
  const user = await prisma.user.findUnique({ where: { email: cleanEmail }, select: { id: true, email: true, firstName: true } });
  if (!user) return null;

  const token = await issueAuthToken(user.id, "PASSWORD_RESET", PASSWORD_RESET_TTL_MINUTES * 60 * 1000, meta.ipAddress);
  await recordAuthEvent({ action: "PASSWORD_RESET_REQUESTED", userId: user.id, meta });
  return buildPasswordResetEmail({
    to: user.email,
    firstName: user.firstName,
    link: appLink("/reset-password", { token }),
    expiresMinutes: PASSWORD_RESET_TTL_MINUTES,
  });
}

/**
 * Sets a new password from a reset link: single use, 30-minute expiry, signs out every
 * session (tokenVersion bump) and drops pending MFA logins. MFA itself stays on.
 */
export async function confirmPasswordReset(token: unknown, newPassword: unknown, meta: AuthRequestMeta) {
  const parsed = registrationSchema.shape.password.safeParse(newPassword);
  if (!parsed.success) {
    throw new Error(`VALIDATION: ${parsed.error.issues[0]?.message ?? "Choose a stronger password."}`);
  }
  if (typeof token !== "string" || token.length < 20 || token.length > 200) {
    throw new Error(`VALIDATION: ${RESET_LINK_INVALID_MESSAGE}`);
  }

  const row = await prisma.authToken.findUnique({ where: { tokenHash: sha256Hex(token) } });
  const now = new Date();
  if (!row || row.purpose !== "PASSWORD_RESET" || row.usedAt || row.expiresAt <= now) {
    throw new Error(`VALIDATION: ${RESET_LINK_INVALID_MESSAGE}`);
  }

  const passwordHash = await hashPassword(parsed.data);

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.authToken.updateMany({
      where: { id: row.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) throw new Error(`VALIDATION: ${RESET_LINK_INVALID_MESSAGE}`);
    await tx.user.update({
      where: { id: row.userId },
      data: {
        passwordHash,
        passwordChangedAt: now,
        tokenVersion: { increment: 1 },
        // Opening the emailed link proves the address belongs to the user.
        isEmailVerified: true,
      },
    });
    await tx.authToken.deleteMany({
      where: { userId: row.userId, purpose: { in: ["PASSWORD_RESET", "MFA_LOGIN"] }, usedAt: null },
    });
  });
  await recordAuthEvent({ action: "PASSWORD_RESET", userId: row.userId, meta });
  return { userId: row.userId };
}

/** Creates an email verification token; returns the email to send, or null when already verified. */
export async function createEmailVerification(userId: string, meta?: AuthRequestMeta): Promise<OutgoingEmail | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, firstName: true, isEmailVerified: true },
  });
  if (!user || user.isEmailVerified) return null;
  const token = await issueAuthToken(user.id, "EMAIL_VERIFY", EMAIL_VERIFY_TTL_HOURS * 60 * 60 * 1000, meta?.ipAddress ?? null);
  return buildEmailVerificationEmail({
    to: user.email,
    firstName: user.firstName,
    link: appLink("/verify-email", { token }),
    expiresHours: EMAIL_VERIFY_TTL_HOURS,
  });
}

/** Marks the email verified from a link token (single use, 24-hour expiry). */
export async function confirmEmailVerification(token: unknown, meta?: AuthRequestMeta) {
  if (typeof token !== "string" || token.length < 20 || token.length > 200) {
    throw new Error(`VALIDATION: ${VERIFY_LINK_INVALID_MESSAGE}`);
  }
  const row = await prisma.authToken.findUnique({ where: { tokenHash: sha256Hex(token) } });
  const now = new Date();
  if (!row || row.purpose !== "EMAIL_VERIFY" || row.usedAt || row.expiresAt <= now) {
    throw new Error(`VALIDATION: ${VERIFY_LINK_INVALID_MESSAGE}`);
  }
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.authToken.updateMany({
      where: { id: row.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) throw new Error(`VALIDATION: ${VERIFY_LINK_INVALID_MESSAGE}`);
    await tx.user.update({ where: { id: row.userId }, data: { isEmailVerified: true } });
  });
  await recordAuthEvent({ action: "EMAIL_VERIFIED", userId: row.userId, meta });
  return { userId: row.userId };
}
