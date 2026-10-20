import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { UserRole } from "@prisma/client";
import { reconcileCodPayment } from "@/modules/orders/services";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole([
      UserRole.PLATFORM_SUPER_ADMIN,
      UserRole.PLATFORM_FINANCE_ADMIN,
    ]);

    const { id } = await params;
    const body = await req.json();
    const { remittanceRef } = body;

    if (!remittanceRef || typeof remittanceRef !== "string" || remittanceRef.trim() === "") {
      return NextResponse.json(
        { error: "Courier remittance reference or slip number is required." },
        { status: 400 }
      );
    }

    const updatedOrder = await reconcileCodPayment(id, remittanceRef.trim(), user!.id);

    return NextResponse.json({
      success: true,
      message: "COD collection reconciled and order payment transitioned to PAID.",
      order: updatedOrder,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error reconciling COD payment.";
    const status = message.includes("FORBIDDEN") || message.includes("UNAUTHORIZED") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
