import { NextRequest, NextResponse } from "next/server";
import { resolveSellerReturn } from "@/modules/sellers/order-services";
import { FULFILLMENT_ROLES, requireSellerContext, sellerErrorResponse } from "@/modules/sellers/api-guard";

/**
 * Seller reviews a return: APPROVED / REJECTED (while submitted), or RECEIVED once the goods
 * are back (restocks them). Refunds are recorded by platform finance.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { sellerOrg, user } = await requireSellerContext({ roles: FULFILLMENT_ROLES, roleLabel: "handle returns" });
    const { id } = await params;
    const { decision, inspectionResult } = await req.json().catch(() => ({}));

    if (!["APPROVED", "REJECTED", "RECEIVED"].includes(decision)) {
      return NextResponse.json({ error: "Choose approve, reject or mark received." }, { status: 400 });
    }
    if (decision === "REJECTED" && String(inspectionResult || "").trim().length < 3) {
      return NextResponse.json({ error: "Tell the customer why the return was not approved." }, { status: 400 });
    }

    const result = await resolveSellerReturn(
      sellerOrg.id,
      id,
      decision,
      typeof inspectionResult === "string" ? inspectionResult : undefined,
      user.id
    );
    return NextResponse.json({ success: true, returnRequest: result });
  } catch (err: unknown) {
    return sellerErrorResponse(err, "Could not update the return.");
  }
}
