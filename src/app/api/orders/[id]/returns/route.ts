import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createReturnRequest } from "@/modules/returns/services";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { sellerOrderId, orderItemId, quantity = 1, reasonCode, explanation } = await req.json();

    if (!sellerOrderId || !orderItemId || !reasonCode) {
      return NextResponse.json({ error: "Missing required return parameters." }, { status: 400 });
    }

    const result = await createReturnRequest(
      sellerOrderId,
      user.id,
      orderItemId,
      quantity,
      reasonCode,
      explanation || "Customer initiated return"
    );

    return NextResponse.json({ success: true, returnRequest: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error creating return request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
