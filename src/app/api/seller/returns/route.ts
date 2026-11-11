import { NextResponse } from "next/server";
import { requireSellerContext, sellerErrorResponse, FULFILLMENT_ROLES } from "@/modules/sellers/api-guard";
import { getSellerReturns } from "@/modules/sellers/order-services";

export async function GET() {
  try {
    const { user, context } = await requireSellerContext({ roles: FULFILLMENT_ROLES, roleLabel: "view returns" });
    void user;

    const returns = await getSellerReturns(context.sellerOrg.id);

    return NextResponse.json({ success: true, returns });
  } catch (err: unknown) {
    return sellerErrorResponse(err, "Error fetching returns");
  }
}
