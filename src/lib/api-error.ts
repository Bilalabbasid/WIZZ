import { NextResponse } from "next/server";

const CLIENT_SAFE_PREFIXES: Record<string, number> = {
  INSUFFICIENT_STOCK: 409,
  ITEM_UNAVAILABLE: 409,
  CART_NOT_ACTIVE: 409,
  COUPON_INVALID: 400,
  COD_LIMIT_EXCEEDED: 400,
  PAYMENT_METHOD_UNAVAILABLE: 400,
  IDEMPOTENCY_KEY_CONFLICT: 409,
  FORBIDDEN: 403,
  UNAUTHORIZED: 401,
  FEATURE_DISABLED: 403,
  VALIDATION: 400,
};

/**
 * Converts a thrown error to a JSON response. Only errors whose message starts with a
 * known business-rule prefix (or contains a plain, intentionally written message that is
 * flagged as safe) are echoed; anything else is logged server-side and returned generically
 * so database/driver internals never reach the browser.
 */
export function apiError(err: unknown, fallback = "Something went wrong. Please try again.") {
  const message = err instanceof Error ? err.message : "";
  for (const [prefix, status] of Object.entries(CLIENT_SAFE_PREFIXES)) {
    if (message.startsWith(prefix)) {
      return NextResponse.json({ error: message.replace(/^[A-Z_]+:\s*/, ""), code: prefix }, { status });
    }
  }
  if (
    message === "Cart is empty or not found." ||
    message === "Cart not found." ||
    message.startsWith("Item \"")
  ) {
    return NextResponse.json({ error: message }, { status: 400 });
  }
  console.error("[api] unexpected error:", message || err);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
