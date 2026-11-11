import { NextResponse } from "next/server";
import { requireSellerContext, sellerErrorResponse, STORE_ADMIN_ROLES } from "@/modules/sellers/api-guard";
import { getSellerSettlementStatement } from "@/modules/sellers/order-services";

export async function GET() {
  try {
    const { user, context } = await requireSellerContext({ roles: STORE_ADMIN_ROLES, roleLabel: "view payouts and settlements" });
    void user;

    const statement = await getSellerSettlementStatement(context.sellerOrg.id);

    return NextResponse.json({ success: true, statement });
  } catch (err: unknown) {
    return sellerErrorResponse(err, "Error fetching settlement statement");
  }
}
