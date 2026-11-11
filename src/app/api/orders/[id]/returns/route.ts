import { NextRequest, NextResponse } from "next/server";
import { clientErrorMessage, clientErrorStatus } from "@/lib/api-error";
import { getCurrentUser } from "@/lib/auth";
import { createReturnRequest } from "@/modules/returns/services";

/**
 * Customer requests a return for one item of a delivered package.
 * Body: { sellerOrderId, orderItemId, quantity, reasonCode, explanation }
 * reasonCode: DEFECTIVE | NOT_AS_DESCRIBED | WRONG_ITEM | UNWANTED
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Please sign in to request a return." }, { status: 401 });

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { sellerOrderId, orderItemId, reasonCode, explanation } = body as Record<string, unknown>;
    const quantity = Number(body?.quantity ?? 1);

    if (typeof sellerOrderId !== "string" || typeof orderItemId !== "string" || typeof reasonCode !== "string") {
      return NextResponse.json({ error: "Choose the item and a reason for the return." }, { status: 400 });
    }

    const result = await createReturnRequest(
      sellerOrderId,
      user.id,
      orderItemId,
      quantity,
      reasonCode,
      typeof explanation === "string" ? explanation : "",
      id
    );
    return NextResponse.json({ success: true, returnRequest: result });
  } catch (err: unknown) {
    return NextResponse.json({ error: clientErrorMessage(err, "Could not create the return request.") }, { status: clientErrorStatus(err) });
  }
}
