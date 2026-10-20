import crypto from "crypto";

/**
 * Guest order access tokens.
 *
 * Order IDs are cuids (semi-predictable) and order numbers are short, so neither
 * may be used alone to expose a guest customer's address, phone and email.
 * The token is an HMAC of the order ID with a server secret: stateless, not
 * guessable, and bound to exactly one order.
 */
function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET must be configured (min 32 chars) to issue order access tokens.");
    }
    return "wizz-pk-development-secret-jwt-key-min-32-chars-long!";
  }
  return s;
}

export function createOrderAccessToken(orderId: string): string {
  return crypto.createHmac("sha256", secret()).update(`order-access:${orderId}`).digest("base64url");
}

export function verifyOrderAccessToken(orderId: string, token: string | undefined | null): boolean {
  if (!token) return false;
  const expected = createOrderAccessToken(orderId);
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function orderPath(orderId: string, opts: { guest?: boolean } = {}): string {
  return opts.guest ? `/orders/${orderId}?t=${createOrderAccessToken(orderId)}` : `/orders/${orderId}`;
}
