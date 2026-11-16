import { NextRequest, NextResponse } from "next/server";
import { clientErrorMessage, clientErrorStatus } from "@/lib/api-error";
import { authRequestMeta, getCurrentUser, issueSessionToken, setSessionCookie } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { enableMfa } from "../../_lib/mfa";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/mfa/enable { code } — confirms enrolment with a code from the app.
 * Returns 10 recovery codes (shown once; only hashes are stored) and upgrades this
 * session to a two-factor session, since the user just proved possession of the device.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    if (!checkRateLimit(`mfa_enable_${user.id}`, { windowMs: 15 * 60 * 1000, max: 10 }).success) {
      return NextResponse.json({ error: "Too many attempts. Please wait 15 minutes and try again." }, { status: 429 });
    }
    const body = await req.json().catch(() => null);
    const { recoveryCodes } = await enableMfa(user.id, body?.code, authRequestMeta(req.headers));

    const res = NextResponse.json({ success: true, recoveryCodes }, { headers: { "Cache-Control": "no-store" } });
    const token = await issueSessionToken(
      { id: user.id, email: user.email, role: user.role, tokenVersion: user.sessionVersion },
      { mfa: true }
    );
    setSessionCookie(res, token, user.role);
    return res;
  } catch (err: unknown) {
    return NextResponse.json(
      { error: clientErrorMessage(err, "We could not turn on two-factor authentication. Please try again.") },
      { status: clientErrorStatus(err, 500) }
    );
  }
}
