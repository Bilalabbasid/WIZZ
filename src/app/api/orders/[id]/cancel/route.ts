import { NextRequest, NextResponse } from "next/server";
import { clientErrorMessage, clientErrorStatus } from "@/lib/api-error";
import { getCurrentUser } from "@/lib/auth";
import { requestOrderCancellation } from "@/modules/orders/services";

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
    const { reason = "Customer cancellation" } = await req.json();

    await requestOrderCancellation(id, user.id, reason);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = clientErrorMessage(err, "Error cancelling order");
    return NextResponse.json({ error: message }, { status: clientErrorStatus(err) });
  }
}
