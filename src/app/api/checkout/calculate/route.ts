import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCartToken } from "@/lib/cart-session";
import { assertCartAccess } from "@/modules/cart/services";
import { calculateCheckoutTotals } from "@/modules/checkout/services";
import { checkRateLimit, clientIpFrom } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const ip = clientIpFrom(req.headers);
    if (!checkRateLimit(`calc_${ip}`, { windowMs: 60000, max: 60 }).success) {
      return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
    }

    const { cartId, couponCode, shippingTier = "STANDARD" } = await req.json();
    if (!cartId || typeof cartId !== "string") {
      return NextResponse.json({ error: "cartId is required" }, { status: 400 });
    }
    if (shippingTier !== "STANDARD" && shippingTier !== "EXPRESS") {
      return NextResponse.json({ error: "Invalid shipping tier." }, { status: 400 });
    }

    const user = await getCurrentUser();
    await assertCartAccess(cartId, { userId: user?.id, guestToken: await getCartToken() });

    const totals = await calculateCheckoutTotals(
      cartId,
      typeof couponCode === "string" ? couponCode : undefined,
      shippingTier
    );
    // Shoppers see prices only: commission, seller payouts and internal reconciliation stay server-side
    const { sellerPackages, reconciliation: _reconciliation, ...publicTotals } = totals;
    void _reconciliation;
    return NextResponse.json({
      success: true,
      totals: {
        ...publicTotals,
        sellerPackages: sellerPackages.map((pkg) => ({
          sellerName: pkg.sellerName,
          subtotalMinor: pkg.subtotalMinor,
          discountMinor: pkg.discountMinor,
          shippingMinor: pkg.shippingMinor,
          taxMinor: pkg.taxMinor,
          totalMinor: pkg.totalMinor,
          itemCount: pkg.items.reduce((n, i) => n + i.quantity, 0),
        })),
      },
    });
  } catch (err: unknown) {
    return apiError(err, "Error calculating totals");
  }
}
