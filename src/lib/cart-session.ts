import crypto from "crypto";
import { cookies } from "next/headers";
import { SITE_CONFIG } from "./config";
import { mergeGuestCart } from "@/modules/cart/services";

/**
 * Guest cart identity lives in its own httpOnly cookie. It must never share the
 * authentication cookie, otherwise a signed session JWT would be persisted in
 * the database as `Cart.sessionToken`.
 */
export const CART_COOKIE_NAME = process.env.CART_COOKIE_NAME || "wizz_cart";

export async function getCartToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(CART_COOKIE_NAME)?.value || undefined;
}

/** Route-handler/server-action only: returns the existing guest token or issues a new one. */
export async function ensureCartToken(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(CART_COOKIE_NAME)?.value;
  if (existing) return existing;

  const token = crypto.randomUUID();
  cookieStore.set(CART_COOKIE_NAME, token, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * SITE_CONFIG.sessionExpiryDays,
  });
  return token;
}

export async function clearCartToken(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(CART_COOKIE_NAME);
}

/**
 * Call right after a sign-in or sign-up sets the session cookie: moves the guest
 * cart's items into the user's cart and drops the guest cookie. Never throws, so a
 * merge problem cannot block the sign-in itself.
 */
export async function claimGuestCart(userId: string): Promise<void> {
  try {
    const token = await getCartToken();
    if (!token) return;
    await mergeGuestCart(token, userId);
    await clearCartToken();
  } catch (err) {
    console.error("[cart] Could not merge guest cart after sign-in:", err instanceof Error ? err.message : err);
  }
}
