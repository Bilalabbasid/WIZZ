import { NextRequest, NextResponse } from "next/server";
import { ingestPaymentWebhook } from "@/modules/payments/services";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Payment provider webhook receiver.
 *
 * The HMAC signature (header `x-wizz-signature`, hex HMAC-SHA256 of the raw body using
 * PAYMENT_WEBHOOK_SECRET) is mandatory. The raw body is read as text so the signature
 * is verified over exactly the bytes that were sent.
 *
 * NOTE: no live Pakistani PSP (Safepay/PayFast/Kuickpay) adapter exists yet. This
 * endpoint implements the generic signed-event contract and is what a provider
 * adapter will plug into.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown-ip";
  const limit = checkRateLimit(`webhook_${ip}`, { windowMs: 60000, max: 120 });
  if (!limit.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const rawBody = await req.text();
  if (rawBody.length > 100_000) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  try {
    const result = await ingestPaymentWebhook(rawBody, req.headers.get("x-wizz-signature"));
    return NextResponse.json({ received: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Webhook processing failed";
    if (message.startsWith("INVALID_WEBHOOK_SIGNATURE")) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    if (message.startsWith("INVALID_WEBHOOK_PAYLOAD")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("[webhook] processing error", message);
    // 5xx so the provider retries; the event is stored as FAILED and re-processed on retry.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
