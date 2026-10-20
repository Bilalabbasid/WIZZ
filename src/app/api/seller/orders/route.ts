import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSellerContextForUser } from "@/modules/sellers/services";
import { getSellerOrders } from "@/modules/sellers/order-services";
import { SellerOrderStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const context = await getSellerContextForUser(user.id);
    if (!context?.sellerOrg) {
      return NextResponse.json({ error: "No seller organization found for this user." }, { status: 404 });
    }

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
    const message = err instanceof Error ? err.message : "Error fetching orders";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
