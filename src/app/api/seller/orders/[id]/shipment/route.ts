import { NextRequest, NextResponse } from "next/server";
import { createSellerShipment } from "@/modules/sellers/order-services";
import { FULFILLMENT_ROLES, requireSellerContext, sellerErrorResponse } from "@/modules/sellers/api-guard";

/** Seller dispatches a package with the courier's real tracking number. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { sellerOrg, user } = await requireSellerContext({ roles: FULFILLMENT_ROLES, roleLabel: "dispatch orders" });
    const { id } = await params;
    const { carrierName, trackingNumber, trackingUrl } = await req.json().catch(() => ({}));

    if (!carrierName || !trackingNumber) {
      return NextResponse.json({ error: "Choose the courier and enter its tracking number." }, { status: 400 });
    }

    const shipment = await createSellerShipment(sellerOrg.id, id, { carrierName, trackingNumber, trackingUrl }, user.id);
    return NextResponse.json({ success: true, shipment });
  } catch (err: unknown) {
    return sellerErrorResponse(err, "Could not create the shipment.");
  }
}
