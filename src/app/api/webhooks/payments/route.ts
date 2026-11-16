import { NextRequest, NextResponse } from "next/server";
import { ingestPaymentWebhook } from "@/modules/payments/services";
import { checkRateLimit, clientIpFrom } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 100_000;

/**
 * Payment provider webhook receiver.
 *
 * The HMAC signature (header `x-wizz-signature`, hex HMAC-SHA256 of the raw body using
 * PAYMENT_WEBHOOK_SECRET) is mandatory and verified (timing-safe) before the body is parsed
 * or the database is touched. The raw body is read as text so the signature is verified over
 * exactly the bytes that were sent.
 *
 * Responses: 401 bad/missing signature · 400 malformed payload · 200 processed, duplicate,
 * ignored or rejected (amount/currency/order mismatch is final, so the provider must not retry)
 * · 500 internal failure (nothing was committed; the provider retries and the event is also
 * re-processed by the reconciliation job).
 *
 * NOTE: no live Pakistani PSP (Safepay/PayFast/Kuickpay) adapter exists yet. This
 * endpoint implements the generic signed-event contract and is what a provider
 * adapter will plug into.
 */
export async function POST(req: NextRequest) {
  const ip = clientIpFrom(req.headers);
  const limit = checkRateLimit(`webhook_${ip}`, { windowMs: 60000, max: 120 });
  if (!limit.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const declaredLength = Number(req.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  const rawBody = await req.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  try {
    const result = await ingestPaymentWebhook(rawBody, req.headers.get("x-wizz-signature"));
    return NextResponse.json({ received: true, ...result });
  } catch (err: unknown) {
    // Match on the raw service message: the codes are internal and never echoed in full.
    const message = err instanceof Error ? err.message : "";
    if (message.startsWith("INVALID_WEBHOOK_SIGNATURE")) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    if (message.startsWith("INVALID_WEBHOOK_PAYLOAD")) {
      return NextResponse.json({ error: message.replace(/^INVALID_WEBHOOK_PAYLOAD:\s*/, "") }, { status: 400 });
    }
    console.error("[webhook] processing error", message.slice(0, 300));
    // 5xx so the provider retries; the transaction rolled back and the event is stored as FAILED.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
