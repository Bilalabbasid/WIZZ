import bcrypt from "bcryptjs";
import crypto from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { prisma } from "./db";
import { SITE_CONFIG } from "./config";
import { UserRole } from "@prisma/client";
import { checkRateLimit, clientIpFrom } from "./rate-limit";

const rawSecret = process.env.JWT_SECRET;
if (process.env.NODE_ENV === "production" && (!rawSecret || rawSecret.length < 32)) {
  throw new Error("FATAL CONFIG ERROR: JWT_SECRET must be set to a secure string of at least 32 characters in production.");
}

const JWT_SECRET_STRING = rawSecret || "wizz-pk-development-secret-jwt-key-min-32-chars-long!";
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_STRING);

/** bcrypt work factor for new hashes; older hashes are upgraded on the next successful sign-in. */
export const BCRYPT_COST = 12;

/** Platform staff roles: always behind two-factor authentication and shorter sessions. */
export const PLATFORM_ROLES: UserRole[] = [
  UserRole.PLATFORM_SUPER_ADMIN,
  UserRole.PLATFORM_CATALOG_ADMIN,
  UserRole.PLATFORM_FINANCE_ADMIN,
  UserRole.PLATFORM_SUPPORT,
];

export function isPlatformRole(role: UserRole | string): boolean {
  return (PLATFORM_ROLES as string[]).includes(role);
}

/** Staff sessions last 12 hours; customer/seller sessions SESSION_EXPIRY_DAYS (default 7). */
export const PLATFORM_SESSION_HOURS = 12;

export function sessionMaxAgeSeconds(role: UserRole | string): number {
  if (isPlatformRole(role)) return PLATFORM_SESSION_HOURS * 60 * 60;
  return 60 * 60 * 24 * SITE_CONFIG.sessionExpiryDays;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  /** User.tokenVersion at issue time; a mismatch means the session was revoked. */
  tv?: number;
  /** True only when the session was completed with a second factor (or MFA was just enrolled). */
  mfa?: boolean;
}

export interface SessionClaims {
  userId: string;
  email: string;
  role: UserRole;
  tv: number;
  mfa: boolean;
}

export async function hashPassword(plainText: string): Promise<string> {
  const salt = await bcrypt.genSalt(BCRYPT_COST);
  return bcrypt.hash(plainText, salt);
}

export async function verifyPassword(plainText: string, passwordHash: string): Promise<boolean> {
  if (typeof plainText !== "string" || typeof passwordHash !== "string") return false;
  try {
    return await bcrypt.compare(plainText, passwordHash);
  } catch {
    return false;
  }
}

/** True when a stored bcrypt hash uses a lower cost than BCRYPT_COST (rehash after a successful login). */
export function passwordNeedsRehash(passwordHash: string): boolean {
  try {
    return bcrypt.getRounds(passwordHash) < BCRYPT_COST;
  } catch {
    return false;
  }
}

/**
 * bcrypt hash (cost 12) of a random value nobody knows. Compared against when the email
 * doesn't exist so "unknown email" and "wrong password" take the same time.
 */
export const DUMMY_PASSWORD_HASH = "$2b$12$gkS4Eqx6.q7QkjOY0c3LcOzFKe9qYgzQ/eT3PUcveYDl7XMLklpfW";

export async function createSessionToken(payload: TokenPayload): Promise<string> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return new SignJWT({
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    tv: payload.tv ?? 0,
    mfa: payload.mfa === true,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + sessionMaxAgeSeconds(payload.role))
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, { algorithms: ["HS256"] });
    if (typeof payload.userId !== "string") return null;
    return {
      userId: payload.userId,
      email: payload.email as string,
      role: payload.role as UserRole,
      // Tokens issued before revocation support carry no `tv`; they match version 0 only.
      tv: typeof payload.tv === "number" ? payload.tv : 0,
      mfa: payload.mfa === true,
    };
  } catch {
    return null;
  }
}

const SESSION_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  isEmailVerified: true,
  tokenVersion: true,
  mfaEnabled: true,
  memberships: {
    select: {
      id: true,
      sellerOrgId: true,
      role: true,
      isActive: true,
      sellerOrg: {
        select: {
          id: true,
          name: true,
          slug: true,
          operationalStatus: true,
        },
      },
    },
  },
} as const;

/**
 * Resolves a session JWT to its user. Returns null for invalid/expired tokens and for
 * revoked sessions (token `tv` ≠ User.tokenVersion). `sessionMfa` says whether this
 * session passed a second factor.
 */
export async function getUserForSessionToken(token: string) {
  const payload = await verifySessionToken(token);
  if (!payload?.userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: SESSION_USER_SELECT,
  });
  if (!user || user.tokenVersion !== payload.tv) return null;

  const { tokenVersion, ...rest } = user;
  return { ...rest, sessionVersion: tokenVersion, sessionMfa: payload.mfa };
}

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getUserForSessionToken>>>;

/**
 * Retrieves the currently authenticated user from the request session cookie.
 */
export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SITE_CONFIG.sessionCookieName)?.value;
    if (!token) return null;
    return await getUserForSessionToken(token);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Authorization guards
// ---------------------------------------------------------------------------

export const MFA_REQUIRED_CODE = "MFA_REQUIRED";

/**
 * Thrown when a platform staff session has not passed two-factor authentication.
 * The "FORBIDDEN:" prefix maps to HTTP 403 in clientErrorStatus/adminErrorResponse;
 * the visible message keeps the MFA_REQUIRED code so clients can react to it.
 */
export class MfaRequiredError extends Error {
  readonly code = MFA_REQUIRED_CODE;
  readonly status = 403;
  constructor() {
    super(`FORBIDDEN: Two-factor authentication is required (${MFA_REQUIRED_CODE}).`);
    this.name = "MfaRequiredError";
  }
}

/** Platform staff must hold a session completed with a second factor. */
export function assertSessionMfa(user: { role: UserRole; sessionMfa: boolean }) {
  if (isPlatformRole(user.role) && !user.sessionMfa) {
    throw new MfaRequiredError();
  }
}

/** Pure role check used by requireRole (exported for tests). */
export function assertRoleAccess(user: { role: UserRole; sessionMfa: boolean }, allowedRoles: UserRole[]) {
  if (!allowedRoles.includes(user.role)) {
    throw new Error(`FORBIDDEN: Access restricted. Requires one of: ${allowedRoles.join(", ")}.`);
  }
  assertSessionMfa(user);
}

/**
 * Asserts user is authenticated, otherwise throws UNAUTHORIZED.
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED: Authentication is required to perform this action.");
  }
  return user;
}

/**
 * Asserts that the authenticated user possesses one of the allowed platform roles.
 * Platform staff sessions must also have passed two-factor authentication.
 */
export async function requireRole(allowedRoles: UserRole[]) {
  const user = await requireAuth();
  assertRoleAccess(user, allowedRoles);
  return user;
}

/**
 * Asserts that the user is a member of the specific seller organization.
 */
export async function requireSellerMembership(sellerOrgId: string) {
  const user = await requireAuth();
  // Super admin can inspect/act on any seller org (only from a two-factor session)
  if (user.role === UserRole.PLATFORM_SUPER_ADMIN) {
    assertSessionMfa(user);
    return { user, membership: null, isSuperAdmin: true };
  }

  const membership = user.memberships.find(
    (m) => m.sellerOrgId === sellerOrgId && m.isActive
  );

  if (!membership) {
    throw new Error(`FORBIDDEN: You do not have permissions for seller organization ${sellerOrgId}.`);
  }

  return { user, membership, isSuperAdmin: false };
}

// ---------------------------------------------------------------------------
// Session cookies and revocation
// ---------------------------------------------------------------------------

export function sessionCookieOptions(role: UserRole | string) {
  return {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: sessionMaxAgeSeconds(role),
  };
}

/** Signs a session for the user's current tokenVersion. */
export async function issueSessionToken(
  user: { id: string; email: string; role: UserRole; tokenVersion: number },
  opts: { mfa: boolean }
): Promise<string> {
  return createSessionToken({ userId: user.id, email: user.email, role: user.role, tv: user.tokenVersion, mfa: opts.mfa });
}

/** Sets the session cookie on a route-handler response. */
export function setSessionCookie(res: NextResponse, token: string, role: UserRole | string) {
  res.cookies.set(SITE_CONFIG.sessionCookieName, token, sessionCookieOptions(role));
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SITE_CONFIG.sessionCookieName, "", {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
  });
}

/** Revokes every session of the user. Returns the new tokenVersion. */
export async function bumpTokenVersion(userId: string, opts: { passwordChanged?: boolean } = {}): Promise<number> {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      tokenVersion: { increment: 1 },
      ...(opts.passwordChanged ? { passwordChangedAt: new Date() } : {}),
    },
    select: { tokenVersion: true },
  });
  return updated.tokenVersion;
}

// ---------------------------------------------------------------------------
// Auth audit trail and lockout
// ---------------------------------------------------------------------------

export type AuthAuditAction =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "LOGIN_LOCKED"
  | "MFA_FAILED"
  | "MFA_SETUP_STARTED"
  | "MFA_ENABLED"
  | "MFA_DISABLED"
  | "MFA_RECOVERY_CODE_USED"
  | "MFA_RESET_BY_OPERATOR"
  | "PASSWORD_CHANGED"
  | "PASSWORD_RESET_REQUESTED"
  | "PASSWORD_RESET"
  | "LOGOUT_ALL"
  | "EMAIL_VERIFIED"
  | "REAUTH_FAILED";

export interface AuthRequestMeta {
  ipAddress: string | null;
  userAgent: string | null;
}

export function authRequestMeta(headers: Headers): AuthRequestMeta {
  const ip = clientIpFrom(headers);
  const ua = headers.get("user-agent");
  return {
    ipAddress: ip && ip !== "unknown-ip" ? ip.slice(0, 64) : null,
    userAgent: ua ? ua.slice(0, 255) : null,
  };
}

/**
 * Email identifiers safe to put in the audit log: the domain, and a keyed hash
 * (HMAC with JWT_SECRET) so repeated attempts can be correlated without storing the address.
 */
export function emailAuditFields(email: string) {
  const clean = String(email || "").toLowerCase().trim();
  const domain = clean.includes("@") ? clean.split("@").pop()!.slice(0, 100) : null;
  const emailHash = crypto.createHmac("sha256", JWT_SECRET_STRING).update(`auth-email:${clean}`).digest("hex").slice(0, 32);
  return { emailDomain: domain, emailHash };
}

export async function recordAuthEvent(input: {
  action: AuthAuditAction;
  userId: string | null;
  meta?: AuthRequestMeta;
  details?: Record<string, unknown>;
}) {
  try {
    await prisma.auditEvent.create({
      data: {
        actorUserId: input.userId,
        entityType: "Auth",
        entityId: input.userId ?? "unknown",
        action: input.action,
        detailsJson: JSON.stringify(input.details ?? {}),
        ipAddress: input.meta?.ipAddress ?? null,
        userAgent: input.meta?.userAgent ?? null,
      },
    });
  } catch (err) {
    console.error("[auth] could not write audit event:", input.action, err instanceof Error ? err.message : err);
  }
}

/** 10 failed password/MFA attempts within 15 minutes lock the account for 15 minutes. */
export const LOGIN_LOCK_THRESHOLD = 10;
export const LOGIN_LOCK_WINDOW_MS = 15 * 60 * 1000;
const LOCK_TRIGGER_MARKER = '"reason":"threshold"';

/**
 * Lock state for an account (known user) or an unknown email (by its audit hash), so a
 * locked response never reveals whether the address is registered.
 */
function lockScope(userId: string | null, emailHash: string) {
  return userId
    ? { entityType: "Auth", entityId: userId }
    : { entityType: "Auth", entityId: "unknown", detailsJson: { contains: emailHash } };
}

export async function isLoginLocked(userId: string | null, emailHash: string): Promise<boolean> {
  const scope = lockScope(userId, emailHash);
  const since = new Date(Date.now() - LOGIN_LOCK_WINDOW_MS);

  const trigger = await prisma.auditEvent.findFirst({
    where: {
      ...scope,
      action: "LOGIN_LOCKED",
      createdAt: { gte: since },
      AND: [{ detailsJson: { contains: LOCK_TRIGGER_MARKER } }, ...(userId ? [] : [{ detailsJson: { contains: emailHash } }])],
    },
    select: { id: true },
  });
  if (trigger) return true;
  return (await countRecentFailures(userId, emailHash)) >= LOGIN_LOCK_THRESHOLD;
}

async function countRecentFailures(userId: string | null, emailHash: string): Promise<number> {
  const scope = lockScope(userId, emailHash);
  let since = new Date(Date.now() - LOGIN_LOCK_WINDOW_MS);
  if (userId) {
    // A successful sign-in clears earlier failures.
    const lastSuccess = await prisma.auditEvent.findFirst({
      where: { entityType: "Auth", entityId: userId, action: "LOGIN_SUCCESS", createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (lastSuccess) since = lastSuccess.createdAt;
  }
  return prisma.auditEvent.count({
    where: { ...scope, action: { in: ["LOGIN_FAILED", "MFA_FAILED"] }, createdAt: { gt: since } },
  });
}

/** Records a failed attempt; returns lockedNow=true when this failure reached the threshold. */
export async function registerAuthFailure(input: {
  action: "LOGIN_FAILED" | "MFA_FAILED";
  userId: string | null;
  emailHash: string;
  emailDomain: string | null;
  meta?: AuthRequestMeta;
  details?: Record<string, unknown>;
}): Promise<{ lockedNow: boolean }> {
  await recordAuthEvent({
    action: input.action,
    userId: input.userId,
    meta: input.meta,
    details: { emailDomain: input.emailDomain, emailHash: input.emailHash, ...(input.details ?? {}) },
  });
  const failures = await countRecentFailures(input.userId, input.emailHash);
  if (failures >= LOGIN_LOCK_THRESHOLD) {
    await recordAuthEvent({
      action: "LOGIN_LOCKED",
      userId: input.userId,
      meta: input.meta,
      details: {
        reason: "threshold",
        emailDomain: input.emailDomain,
        emailHash: input.emailHash,
        failures,
        lockedUntil: new Date(Date.now() + LOGIN_LOCK_WINDOW_MS).toISOString(),
      },
    });
    return { lockedNow: true };
  }
  return { lockedNow: false };
}

// ---------------------------------------------------------------------------
// Re-authentication for sensitive actions
// ---------------------------------------------------------------------------

/**
 * Confirms the signed-in user's password before a sensitive action (bank details,
 * payouts, team changes). Rate-limited to 5 attempts per 15 minutes per user and
 * refused while the account is locked. Throws a "VALIDATION: …" error (HTTP 400 via
 * clientErrorStatus) when the password is wrong or attempts are exhausted.
 *
 *   await requireRecentAuth(user, body.password, authRequestMeta(req.headers));
 */
export async function requireRecentAuth(
  user: { id: string },
  password: string,
  meta?: AuthRequestMeta
): Promise<void> {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("VALIDATION: Enter your password to confirm this change.");
  }
  if (!checkRateLimit(`reauth_${user.id}`, { windowMs: 15 * 60 * 1000, max: 5 }).success) {
    throw new Error("VALIDATION: Too many password attempts. Please wait 15 minutes and try again.");
  }
  const record = await prisma.user.findUnique({ where: { id: user.id }, select: { email: true, passwordHash: true } });
  if (!record) {
    throw new Error("UNAUTHORIZED: Authentication is required to perform this action.");
  }
  const { emailHash } = emailAuditFields(record.email);
  if (await isLoginLocked(user.id, emailHash)) {
    throw new Error("VALIDATION: Too many failed attempts on this account. Please wait 15 minutes and try again.");
  }
  if (!(await verifyPassword(password, record.passwordHash))) {
    await recordAuthEvent({ action: "REAUTH_FAILED", userId: user.id, meta });
    throw new Error("VALIDATION: The password you entered is incorrect.");
  }
}

/** Alias of requireRecentAuth taking a user id. */
export async function reauthenticate(userId: string, password: string, meta?: AuthRequestMeta): Promise<void> {
  return requireRecentAuth({ id: userId }, password, meta);
}
