import { NextRequest, NextResponse } from "next/server";
import { requireSellerContext, sellerErrorResponse, FULFILLMENT_ROLES } from "@/modules/sellers/api-guard";
import { getSellerOrderById } from "@/modules/sellers/order-services";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, context } = await requireSellerContext({ roles: FULFILLMENT_ROLES, roleLabel: "view orders" });
    void user;

    const { id } = await params;
    const order = await getSellerOrderById(context.sellerOrg.id, id);

    return NextResponse.json({ success: true, order });
  } catch (err: unknown) {
    return sellerErrorResponse(err, "Error fetching order");
  }
}
