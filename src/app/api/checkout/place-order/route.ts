import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCartToken } from "@/lib/cart-session";
import { isGuestCheckoutAllowed } from "@/lib/flags";
import { checkRateLimit } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-error";
import { placeOrderSchema, formatZodError } from "@/lib/validation";
import { orderPath } from "@/lib/order-access";
import { assertCartAccess } from "@/modules/cart/services";
import { placeOrder } from "@/modules/checkout/services";
import { executeOrderPayment } from "@/modules/payments/services";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown-ip";
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
    });

    // COD stays UNPAID until the courier remits the cash. The sandbox adapter (non-production only)
    // goes through the same verified markOrderPaid() path as webhooks.
    let payment: Record<string, unknown> = {
      success: true,
      message: "Cash on delivery confirmed. Payment is due on delivery.",
    };
    if (input.paymentMethod === "ONLINE_SANDBOX") {
      payment = await executeOrderPayment(order.id, input.idempotencyKey);
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentMethod: input.paymentMethod,
      payment,
      redirectTo: orderPath(order.id, { guest: !user }),
    });
  } catch (err: unknown) {
    return apiError(err, "We could not place your order. Please try again.");
  }
}
