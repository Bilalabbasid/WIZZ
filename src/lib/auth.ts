import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { SITE_CONFIG } from "./config";
import { UserRole } from "@prisma/client";

const rawSecret = process.env.JWT_SECRET;
if (process.env.NODE_ENV === "production" && (!rawSecret || rawSecret.length < 32)) {
  throw new Error("FATAL CONFIG ERROR: JWT_SECRET must be set to a secure string of at least 32 characters in production.");
}

const JWT_SECRET_STRING = rawSecret || "wizz-pk-development-secret-jwt-key-min-32-chars-long!";
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_STRING);

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export async function hashPassword(plainText: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(plainText, salt);
}

export async function verifyPassword(plainText: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(plainText, passwordHash);
}

export async function createSessionToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SITE_CONFIG.sessionExpiryDays}d`)
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      role: payload.role as UserRole,
    };
  } catch {
    return null;
  }
}

/**
 * Retrieves the currently authenticated user from the request session cookie.
 */
export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SITE_CONFIG.sessionCookieName)?.value;
    if (!token) return null;

    const payload = await verifySessionToken(token);
    if (!payload?.userId) return null;

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isEmailVerified: true,
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
      },
    });

    return user;
  } catch {
    return null;
  }
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
 */
export async function requireRole(allowedRoles: UserRole[]) {
  const user = await requireAuth();
  if (!allowedRoles.includes(user.role)) {
    throw new Error(`FORBIDDEN: Access restricted. Requires one of: ${allowedRoles.join(", ")}.`);
  }
  return user;
}

/**
 * Asserts that the user is a member of the specific seller organization.
 */
export async function requireSellerMembership(sellerOrgId: string) {
  const user = await requireAuth();
  // Super admin can inspect/act on any seller org
  if (user.role === UserRole.PLATFORM_SUPER_ADMIN) {
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
