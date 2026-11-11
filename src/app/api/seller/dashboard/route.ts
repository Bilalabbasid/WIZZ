import { NextResponse } from "next/server";
import { requireSellerContext, sellerErrorResponse } from "@/modules/sellers/api-guard";
import { getSellerDashboardStats } from "@/modules/sellers/services";

export async function GET() {
  try {
    const { user, context } = await requireSellerContext({});
    void user;

    const stats = await getSellerDashboardStats(context.sellerOrg.id);

    return NextResponse.json({
      success: true,
      stats,
      sellerOrg: context.sellerOrg,
      status: context.status,
      canSell: context.canSell,
    });
  } catch (err: unknown) {
    return sellerErrorResponse(err, "Error fetching dashboard stats");
  }
}
