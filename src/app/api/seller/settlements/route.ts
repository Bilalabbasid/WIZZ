import { NextResponse } from "next/server";
import { requireSellerContext, sellerErrorResponse, STORE_ADMIN_ROLES } from "@/modules/sellers/api-guard";
import { getSellerSettlementStatement } from "@/modules/sellers/order-services";

export const dynamic = "force-dynamic";

/**
 * GET /api/seller/settlements: the caller's own statement (seller derived from membership).
 * Balances come from getSellerBalances; payouts are made by WIZZ.PK finance, sellers cannot
 * withdraw. The bank account is masked.
 */
export async function GET() {
  try {
    const { sellerOrg } = await requireSellerContext({ roles: STORE_ADMIN_ROLES, roleLabel: "view payouts and settlements" });
    const statement = await getSellerSettlementStatement(sellerOrg.id);
    return NextResponse.json({ success: true, statement }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err: unknown) {
    return sellerErrorResponse(err, "Error fetching settlement statement");
  }
}
