import { NextResponse } from "next/server";
import { clientErrorMessage, clientErrorStatus } from "@/lib/api-error";
import { getCurrentUser } from "@/lib/auth";
import { getSellerContextForUser } from "@/modules/sellers/services";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const context = await getSellerContextForUser(user.id);
    return NextResponse.json({ success: true, context });
  } catch (err: unknown) {
    const message = clientErrorMessage(err, "Error getting seller context");
    return NextResponse.json({ error: message }, { status: clientErrorStatus(err) });
  }
}
