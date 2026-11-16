import crypto from "crypto";

/**
 * Field-level encryption for sensitive data at rest (bank account numbers, TOTP secrets).
 * AES-256-GCM via Node's crypto module, key from DATA_ENCRYPTION_KEY (32 bytes, base64).
 * Ciphertext format: "enc:v1:<iv b64>:<auth tag b64>:<ciphertext b64>".
 * Values without the prefix are legacy plaintext and are returned as-is by decryptField,
 * so existing rows keep working until they are re-saved (or migrated by the bootstrap).
 */
const PREFIX = "enc:v1:";

function getKey(): Buffer | null {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("DATA_ENCRYPTION_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32).");
  }
  return key;
}

export function isEncryptionConfigured(): boolean {
  try {
    return getKey() !== null;
  } catch {
    return false;
  }
}

export function isEncryptedValue(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/** Encrypts a value. Throws when no key is configured: sensitive data is never written in clear. */
export function encryptField(plain: string): string {
  const key = getKey();
  if (!key) {
    throw new Error("VALIDATION: Secure storage is not configured on this server yet, so this can't be saved. Contact WIZZ.PK support.");
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

/** Decrypts a value written by encryptField; legacy plaintext is returned unchanged. */
export function decryptField(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return value ?? null;
  if (!isEncryptedValue(value)) return value;
  const key = getKey();
  if (!key) throw new Error("Encrypted data cannot be read: DATA_ENCRYPTION_KEY is not configured.");
  const [ivB64, tagB64, ctB64] = value.slice(PREFIX.length).split(":");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
}

/** Last 4 characters of an account number, for display and history ("•••• 1234"). */
export function last4(value: string | null | undefined): string | null {
  if (!value) return null;
  const clean = value.replace(/\s+/g, "");
  return clean.length <= 4 ? clean : clean.slice(-4);
}

export function maskAccount(plain: string | null | undefined): string | null {
  const l4 = last4(plain);
  return l4 ? `•••• ${l4}` : null;
}

/** SHA-256 hex of a token / recovery code (store only hashes of secrets we hand out). */
export function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}
