import { NextRequest, NextResponse } from "next/server";
import { clientErrorMessage, clientErrorStatus } from "@/lib/api-error";
import { getCurrentUser } from "@/lib/auth";
import { acceptSellerInvitation } from "@/modules/sellers/services";

/** Signed-in user accepts a seller team invitation ({ token }). */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Please sign in to accept the invitation." }, { status: 401 });
    const { token } = await req.json().catch(() => ({}));
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "This invitation link is incomplete." }, { status: 400 });
    }
    await acceptSellerInvitation(token, user.id);
    return NextResponse.json({ success: true, redirectTo: "/seller/portal" });
  } catch (err: unknown) {
    return NextResponse.json({ error: clientErrorMessage(err, "Could not accept the invitation.") }, { status: clientErrorStatus(err) });
  }
}
