import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { Secret, TOTP } from "otpauth";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { SITE_CONFIG } from "@/lib/config";
import { decryptField, encryptField, sha256Hex } from "@/lib/crypto";
import {
  isPlatformRole,
  recordAuthEvent,
  requireRecentAuth,
  type AuthRequestMeta,
} from "@/lib/auth";

/**
 * TOTP two-factor authentication (RFC 6238 via the `otpauth` library):
 * SHA-1, 6 digits, 30-second steps, accepting ±1 step of clock drift.
 *
 * Replay protection: each accepted code's time-step counter is stored as an AuthToken
 * row (purpose MFA_TOTP_USED, `attempts` = counter, tokenHash = sha256 of user+counter,
 * which is unique). A code is rejected when its counter is ≤ the last accepted counter,
 * and the unique index makes two concurrent submissions of the same code fail too.
 */
const TOTP_PERIOD = 30;
const TOTP_DIGITS = 6;
const TOTP_WINDOW = 1;
const USED_COUNTER_PURPOSE = "MFA_TOTP_USED";
export const RECOVERY_CODE_COUNT = 10;

function buildTotp(secretBase32: string, label: string) {
  return new TOTP({
    issuer: SITE_CONFIG.brandName,
    label,
    algorithm: "SHA1",
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret: Secret.fromBase32(secretBase32),
  });
}

function normalizeTotpCode(code: unknown): string | null {
  if (typeof code !== "string") return null;
  const digits = code.replace(/[\s-]/g, "");
  return /^\d{6}$/.test(digits) ? digits : null;
}

export function normalizeRecoveryCode(code: unknown): string | null {
  if (typeof code !== "string") return null;
  const clean = code.toLowerCase().replace(/[^0-9a-f]/g, "");
  return clean.length === 12 ? clean : null;
}

function generateRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const hex = crypto.randomBytes(6).toString("hex");
    return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
  });
}

function hashRecoveryCode(normalized: string): string {
  return sha256Hex(`mfa-recovery:${normalized}`);
}

function parseHashes(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((h): h is string => typeof h === "string") : [];
  } catch {
    return [];
  }
}

export function recoveryCodesRemaining(json: string | null): number {
  return parseHashes(json).length;
}

/**
 * Checks a TOTP code against the user's secret and records its counter so it can't be
 * used again. Returns false for wrong, expired or replayed codes.
 */
export async function verifyTotpForUser(
  user: { id: string; mfaSecretEnc: string | null },
  code: unknown,
  now: number = Date.now()
): Promise<boolean> {
  const token = normalizeTotpCode(code);
  if (!token || !user.mfaSecretEnc) return false;
  const secretBase32 = decryptField(user.mfaSecretEnc);
  if (!secretBase32) return false;

  // Housekeeping: counters outside the acceptance window are no longer needed.
  await prisma.authToken.deleteMany({
    where: { userId: user.id, purpose: USED_COUNTER_PURPOSE, expiresAt: { lt: new Date(now) } },
  });
  const last = await prisma.authToken.findFirst({
    where: { userId: user.id, purpose: USED_COUNTER_PURPOSE },
    orderBy: { attempts: "desc" },
    select: { attempts: true },
  });

  const delta = TOTP.validate({
    token,
    secret: Secret.fromBase32(secretBase32),
    algorithm: "SHA1",
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    timestamp: now,
    window: TOTP_WINDOW,
    ...(last ? { afterCounter: last.attempts } : {}),
  });
  if (delta === null) return false;

  const counter = TOTP.counter({ period: TOTP_PERIOD, timestamp: now }) + delta;
  try {
    await prisma.authToken.create({
      data: {
        userId: user.id,
        purpose: USED_COUNTER_PURPOSE,
        tokenHash: sha256Hex(`totp-used:${user.id}:${counter}`),
        attempts: counter,
        expiresAt: new Date(now + 10 * 60 * 1000),
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return false; // replay race
    throw err;
  }
  return true;
}

/** Uses up one recovery code (atomically). Returns false when it doesn't match an unused code. */
export async function consumeRecoveryCode(userId: string, code: unknown, meta?: AuthRequestMeta): Promise<boolean> {
  const normalized = normalizeRecoveryCode(code);
  if (!normalized) return false;
  const hash = hashRecoveryCode(normalized);

  for (let attempt = 0; attempt < 3; attempt++) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { mfaRecoveryHashesJson: true } });
    if (!user?.mfaRecoveryHashesJson) return false;
    const hashes = parseHashes(user.mfaRecoveryHashesJson);
    if (!hashes.includes(hash)) return false;
    const remaining = hashes.filter((h) => h !== hash);
    // Compare-and-swap so two concurrent uses of the same code can't both succeed.
    const res = await prisma.user.updateMany({
      where: { id: userId, mfaRecoveryHashesJson: user.mfaRecoveryHashesJson },
      data: { mfaRecoveryHashesJson: JSON.stringify(remaining) },
    });
    if (res.count === 1) {
      await recordAuthEvent({ action: "MFA_RECOVERY_CODE_USED", userId, meta, details: { remaining: remaining.length } });
      return true;
    }
  }
  return false;
}

/** Verifies either a TOTP code or a recovery code. */
export async function verifySecondFactor(
  user: { id: string; mfaSecretEnc: string | null },
  input: { code?: unknown; recoveryCode?: unknown },
  meta?: AuthRequestMeta
): Promise<{ ok: boolean; method: "totp" | "recovery" | null }> {
  if (typeof input.recoveryCode === "string" && input.recoveryCode.trim()) {
    return { ok: await consumeRecoveryCode(user.id, input.recoveryCode, meta), method: "recovery" };
  }
  return { ok: await verifyTotpForUser(user, input.code), method: "totp" };
}

/**
 * Starts enrolment: generates a new secret, stores it encrypted (MFA stays off until a
 * code is confirmed) and returns the otpauth:// URI, the base32 secret for manual entry
 * and a QR code image (data: URL).
 */
export async function beginMfaSetup(userId: string, meta?: AuthRequestMeta) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, mfaEnabled: true } });
  if (!user) throw new Error("UNAUTHORIZED: Please sign in again.");
  if (user.mfaEnabled) {
    throw new Error("VALIDATION: Two-factor authentication is already on for this account.");
  }

  const secret = new Secret({ size: 20 });
  const secretBase32 = secret.base32;
  await prisma.user.update({ where: { id: userId }, data: { mfaSecretEnc: encryptField(secretBase32) } });

  const otpauthUri = buildTotp(secretBase32, user.email).toString();
  const qrDataUrl = await QRCode.toDataURL(otpauthUri, { errorCorrectionLevel: "M", margin: 1, width: 220 });
  await recordAuthEvent({ action: "MFA_SETUP_STARTED", userId, meta });
  return { otpauthUri, secret: secretBase32, qrDataUrl };
}

/** Confirms enrolment with a code from the app; returns 10 recovery codes (shown once). */
export async function enableMfa(userId: string, code: unknown, meta?: AuthRequestMeta) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, mfaEnabled: true, mfaSecretEnc: true },
  });
  if (!user) throw new Error("UNAUTHORIZED: Please sign in again.");
  if (user.mfaEnabled) throw new Error("VALIDATION: Two-factor authentication is already on for this account.");
  if (!user.mfaSecretEnc) throw new Error("VALIDATION: Start the set-up first, then enter the code from your app.");

  if (!(await verifyTotpForUser(user, code))) {
    throw new Error("VALIDATION: That code didn't match. Check the time on your phone and enter the newest 6-digit code.");
  }

  const recoveryCodes = generateRecoveryCodes();
  const hashes = recoveryCodes.map((c) => hashRecoveryCode(normalizeRecoveryCode(c)!));
  const res = await prisma.user.updateMany({
    where: { id: userId, mfaEnabled: false, mfaSecretEnc: user.mfaSecretEnc },
    data: { mfaEnabled: true, mfaEnabledAt: new Date(), mfaRecoveryHashesJson: JSON.stringify(hashes) },
  });
  if (res.count !== 1) {
    throw new Error("VALIDATION: Two-factor set-up changed in another window. Start again.");
  }
  await recordAuthEvent({ action: "MFA_ENABLED", userId, meta });
  return { recoveryCodes };
}

/** Turns MFA off (customers and sellers only; platform staff must keep it). */
export async function disableMfa(
  userId: string,
  input: { password: unknown; code?: unknown; recoveryCode?: unknown },
  meta?: AuthRequestMeta
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, mfaEnabled: true, mfaSecretEnc: true },
  });
  if (!user) throw new Error("UNAUTHORIZED: Please sign in again.");
  if (isPlatformRole(user.role)) {
    throw new Error("FORBIDDEN: Staff accounts must keep two-factor authentication on.");
  }
  if (!user.mfaEnabled) throw new Error("VALIDATION: Two-factor authentication is not on.");

  await requireRecentAuth(user, typeof input.password === "string" ? input.password : "", meta);

  const second = await verifySecondFactor(user, input, meta);
  if (!second.ok) {
    throw new Error("VALIDATION: That code didn't match. Enter a current code from your app or an unused recovery code.");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecretEnc: null, mfaRecoveryHashesJson: null, mfaEnabledAt: null },
    }),
    prisma.authToken.deleteMany({ where: { userId, purpose: { in: ["MFA_LOGIN", USED_COUNTER_PURPOSE] } } }),
  ]);
  await recordAuthEvent({ action: "MFA_DISABLED", userId, meta });
}
