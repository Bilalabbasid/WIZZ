import { NextRequest, NextResponse } from "next/server";
import { clientErrorMessage, clientErrorStatus } from "@/lib/api-error";
import { authRequestMeta, bumpTokenVersion, clearSessionCookie, getCurrentUser, recordAuthEvent } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** POST /api/auth/logout-all — revokes every session of the signed-in user (all devices). */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    }
    await bumpTokenVersion(user.id);
    await recordAuthEvent({ action: "LOGOUT_ALL", userId: user.id, meta: authRequestMeta(req.headers) });
    const res = NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
    clearSessionCookie(res);
    return res;
  } catch (err: unknown) {
    return NextResponse.json(
      { error: clientErrorMessage(err, "We could not sign you out everywhere. Please try again.") },
      { status: clientErrorStatus(err, 500) }
    );
  }
}
