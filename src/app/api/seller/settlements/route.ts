import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSellerContextForUser } from "@/modules/sellers/services";
import { getSellerSettlementStatement } from "@/modules/sellers/order-services";

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

    const statement = await getSellerSettlementStatement(context.sellerOrg.id);

    return NextResponse.json({ success: true, statement });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error fetching settlement statement";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
