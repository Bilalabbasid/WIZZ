import { NextRequest, NextResponse } from "next/server";
import { clientErrorMessage, clientErrorStatus } from "@/lib/api-error";
import { authRequestMeta, clearSessionCookie } from "@/lib/auth";
import { checkRateLimit, clientIpFrom } from "@/lib/rate-limit";
import { confirmPasswordReset } from "../../_lib/tokens";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/password-reset/confirm { token, password }
 * Single-use, 30-minute link. Signs out every session of the account; the user then
 * signs in with the new password (and their authenticator code, if MFA is on).
 */
export async function POST(req: NextRequest) {
  try {
    const ip = clientIpFrom(req.headers);
    if (!checkRateLimit(`pwreset_confirm_${ip}`, { windowMs: 15 * 60 * 1000, max: 10 }).success) {
      return NextResponse.json({ error: "Too many attempts. Please wait 15 minutes and try again." }, { status: 429 });
    }
    const body = await req.json().catch(() => null);
    await confirmPasswordReset(body?.token, body?.password, authRequestMeta(req.headers));
    const res = NextResponse.json(
      { success: true, message: "Your password has been changed. Sign in with your new password." },
      { headers: { "Cache-Control": "no-store" } }
    );
    clearSessionCookie(res);
    return res;
  } catch (err: unknown) {
    return NextResponse.json(
      { error: clientErrorMessage(err, "We could not reset your password. Please try again.") },
      { status: clientErrorStatus(err, 500) }
    );
  }
}
