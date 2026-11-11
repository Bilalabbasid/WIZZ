import { NextRequest, NextResponse } from "next/server";
import { SellerOrderStatus } from "@prisma/client";
import { updateSellerOrderStatus } from "@/modules/sellers/order-services";
import { FULFILLMENT_ROLES, requireSellerContext, sellerErrorResponse } from "@/modules/sellers/api-guard";

/**
 * Seller moves a package: CONFIRMED <-> PACKING, DISPATCHED -> DELIVERED, or CANCELLED
 * (before dispatch, with a reason). Dispatch happens through the shipment route.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { sellerOrg, user } = await requireSellerContext({ roles: FULFILLMENT_ROLES, roleLabel: "update orders" });
    const { id } = await params;
    const { status, reason } = await req.json().catch(() => ({}));

    if (!status || !Object.values(SellerOrderStatus).includes(status)) {
      return NextResponse.json({ error: "Choose a valid status." }, { status: 400 });
    }

    const updated = await updateSellerOrderStatus(sellerOrg.id, id, status as SellerOrderStatus, user.id, reason);
    return NextResponse.json({ success: true, order: updated });
  } catch (err: unknown) {
    return sellerErrorResponse(err, "Could not update the order status.");
  }
}
