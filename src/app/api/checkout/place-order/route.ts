import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCartToken } from "@/lib/cart-session";
import { isGuestCheckoutAllowed } from "@/lib/flags";
import { checkRateLimit, clientIpFrom } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-error";
import { placeOrderSchema, formatZodError } from "@/lib/validation";
import { orderPath } from "@/lib/order-access";
import { assertCartAccess } from "@/modules/cart/services";
import { placeOrder } from "@/modules/checkout/services";
import { executeOrderPayment, getOrderPaymentMethod } from "@/modules/payments/services";
import { RiskBlockedError } from "@/modules/risk/services";

export const dynamic = "force-dynamic";

/** Business errors this route knows better than the generic mapper. */
function checkoutError(err: unknown) {
  if (err instanceof RiskBlockedError) {
    return NextResponse.json({ error: err.publicMessage, code: err.event.rule }, { status: err.httpStatus });
  }
  const message = err instanceof Error ? err.message : "";
  if (message.startsWith("PRICE_CHANGED:")) {
    return NextResponse.json({ error: message.replace(/^PRICE_CHANGED:\s*/, ""), code: "PRICE_CHANGED" }, { status: 409 });
  }
  return apiError(err, "We could not place your order. Please try again.");
}

export async function POST(req: NextRequest) {
  try {
    const ip = clientIpFrom(req.headers);
    if (!checkRateLimit(`place_${ip}`, { windowMs: 60000, max: 15 }).success) {
      return NextResponse.json({ error: "Too many order attempts. Please wait a minute." }, { status: 429 });
    }

    const user = await getCurrentUser();
    if (!user && !isGuestCheckoutAllowed()) {
      return NextResponse.json({ error: "Please sign in to place an order." }, { status: 401 });
    }

    const body = await req.json();
    const cartId = typeof body?.cartId === "string" ? body.cartId : "";
    if (!cartId) {
      return NextResponse.json({ error: "cartId is required" }, { status: 400 });
    }

    // The schema whitelists fields: any amount/price/discount/total in the body is dropped here.
    const parsed = placeOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error), code: "VALIDATION" }, { status: 400 });
    }
    const input = parsed.data;

    // The cart must belong to the caller. Prices, totals, discounts and seller ownership are
    // always recomputed from the database; nothing financial is read from the request body.
    await assertCartAccess(cartId, { userId: user?.id, guestToken: await getCartToken() });

    const order = await placeOrder({
      cartId,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone ?? input.shippingAddress.phone,
      customerUserId: user?.id,
      shippingAddress: input.shippingAddress,
      billingAddress: input.billingAddress ?? input.shippingAddress,
      shippingTier: input.shippingTier,
      couponCode: input.couponCode,
      idempotencyKey: input.idempotencyKey,
      paymentMethod: input.paymentMethod,
      risk: { ipAddress: ip },
    });

    // The payment method comes from the order itself, not the request: a retried request with
    // the same key but a different method can never "pay" a cash-on-delivery order.
    const paymentMethod = await getOrderPaymentMethod(order.id);

    // COD stays UNPAID until the courier remits the cash. The sandbox adapter (non-production only,
    // enforced inside executeOrderPayment) goes through the same verified path as webhooks.
    let payment: Record<string, unknown> = {
      success: true,
      message: "Cash on delivery confirmed. Payment is due on delivery.",
    };
    if (paymentMethod === "ONLINE_SANDBOX") {
      payment = await executeOrderPayment(order.id, input.idempotencyKey, { userId: user?.id ?? null });
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentMethod,
      payment,
      redirectTo: orderPath(order.id, { guest: !user }),
    });
  } catch (err: unknown) {
    return checkoutError(err);
  }
}
