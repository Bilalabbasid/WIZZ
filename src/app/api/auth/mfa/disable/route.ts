import { NextRequest, NextResponse } from "next/server";
import { clientErrorMessage, clientErrorStatus } from "@/lib/api-error";
import { authRequestMeta, getCurrentUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { disableMfa } from "../../_lib/mfa";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/mfa/disable { password, code | recoveryCode } — customers and sellers only;
 * platform staff accounts must keep two-factor authentication (403).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    if (!checkRateLimit(`mfa_disable_${user.id}`, { windowMs: 15 * 60 * 1000, max: 5 }).success) {
      return NextResponse.json({ error: "Too many attempts. Please wait 15 minutes and try again." }, { status: 429 });
    }
    const body = await req.json().catch(() => null);
    await disableMfa(
      user.id,
      { password: body?.password, code: body?.code, recoveryCode: body?.recoveryCode },
      authRequestMeta(req.headers)
    );
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: clientErrorMessage(err, "We could not turn off two-factor authentication. Please try again.") },
      { status: clientErrorStatus(err, 500) }
    );
  }
}
