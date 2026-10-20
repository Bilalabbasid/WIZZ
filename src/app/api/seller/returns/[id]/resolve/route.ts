import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSellerContextForUser } from "@/modules/sellers/services";
import { resolveSellerReturn } from "@/modules/sellers/order-services";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const context = await getSellerContextForUser(user.id);
    if (!context?.sellerOrg) {
      return NextResponse.json({ error: "No seller organization found for this user." }, { status: 404 });
    }

    const { id } = await params;
    const { decision, inspectionResult } = await req.json();

    if (!["APPROVED", "REJECTED"].includes(decision)) {
      return NextResponse.json({ error: "decision must be APPROVED or REJECTED." }, { status: 400 });
    }

    const result = await resolveSellerReturn(
      context.sellerOrg.id,
      id,
      decision,
      inspectionResult,
      user.id
    );

    return NextResponse.json({ success: true, returnRequest: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error resolving return";
    const status = message.includes("FORBIDDEN") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
