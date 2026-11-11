import { NextRequest, NextResponse } from "next/server";
import { requireSellerContext, sellerErrorResponse, FULFILLMENT_ROLES } from "@/modules/sellers/api-guard";
import { getSellerOrders } from "@/modules/sellers/order-services";
import { SellerOrderStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const { user, context } = await requireSellerContext({ roles: FULFILLMENT_ROLES, roleLabel: "view orders" });
    void user;

    const { searchParams } = new URL(req.url);
    const status = (searchParams.get("status") as SellerOrderStatus) || undefined;
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 20;

    const result = await getSellerOrders(context.sellerOrg.id, {
      status,
      page,
      limit,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    return sellerErrorResponse(err, "Error fetching orders");
  }
}
