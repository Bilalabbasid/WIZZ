import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { UserRole } from "@prisma/client";
import { reviewReturnRequest, processReturnRestockAndRefund } from "@/modules/returns/services";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole([
      UserRole.PLATFORM_SUPER_ADMIN,
      UserRole.PLATFORM_SUPPORT,
    ]);

    const { id } = await params;
    const body = await req.json();
    const { decision, notes } = body;

    if (!decision || !["APPROVED", "REJECTED"].includes(decision)) {
      return NextResponse.json(
        { error: "decision must be either APPROVED or REJECTED." },
        { status: 400 }
      );
    }

    // 1. Review and update return status
    const reviewed = await reviewReturnRequest(id, decision, notes);

    // 2. If approved, process inventory restocking and customer refund
    let refundResult: Record<string, unknown> | null = null;
    if (decision === "APPROVED") {
      refundResult = await processReturnRestockAndRefund(id);
    }

    return NextResponse.json({
      success: true,
      returnRequest: reviewed,
      refundResult,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error handling return request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
