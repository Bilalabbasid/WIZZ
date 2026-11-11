import { NextResponse } from "next/server";
import { requireSellerContext, sellerErrorResponse, STORE_ADMIN_ROLES } from "@/modules/sellers/api-guard";
import { getSellerAuditHistory } from "@/modules/sellers/services";

export async function GET() {
  try {
    const { user, context } = await requireSellerContext({ roles: STORE_ADMIN_ROLES, roleLabel: "view the store audit log" });
    void user;

    const logs = await getSellerAuditHistory(context.sellerOrg.id);

    return NextResponse.json({ success: true, logs });
  } catch (err: unknown) {
    return sellerErrorResponse(err, "Error fetching audit logs");
  }
}
