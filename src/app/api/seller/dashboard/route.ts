import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSellerContextForUser, getSellerDashboardStats } from "@/modules/sellers/services";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const context = await getSellerContextForUser(user.id);
    if (!context?.sellerOrg) {
      return NextResponse.json({ error: "No seller organization found for this user." }, { status: 404 });
    }

    const stats = await getSellerDashboardStats(context.sellerOrg.id);

    return NextResponse.json({
      success: true,
      stats,
      sellerOrg: context.sellerOrg,
      status: context.status,
      canSell: context.canSell,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error fetching dashboard stats";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
