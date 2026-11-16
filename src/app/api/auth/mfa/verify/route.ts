import { NextRequest, NextResponse } from "next/server";
import { clientErrorMessage } from "@/lib/api-error";
import { authRequestMeta, setSessionCookie } from "@/lib/auth";
import { claimGuestCart } from "@/lib/cart-session";
import { checkRateLimit, clientIpFrom } from "@/lib/rate-limit";
import { LOCKED_MESSAGE, MFA_PENDING_COOKIE, clearMfaPendingCookie, completeMfaLogin } from "../../_lib/login";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * POST /api/auth/mfa/verify { code } or { recoveryCode } — second sign-in step.
 * Needs the pending cookie from the password step (5 minutes, 5 attempts).
 * Issues the session with the `mfa: true` claim.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = clientIpFrom(req.headers);
    const limit = checkRateLimit(`mfa_verify_${ip}`, { windowMs: 15 * 60 * 1000, max: 20 });
    if (!limit.success) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait a few minutes and try again." },
        { status: 429, headers: { ...NO_STORE, "Retry-After": Math.ceil(limit.resetMs / 1000).toString() } }
      );
    }

    const body = await req.json().catch(() => null);
    const result = await completeMfaLogin({
      pendingToken: req.cookies.get(MFA_PENDING_COOKIE)?.value,
      code: body?.code,
      recoveryCode: body?.recoveryCode,
      meta: authRequestMeta(req.headers),
    });

    if (result.kind === "expired") {
      const res = NextResponse.json(
        { error: "Your sign-in timed out. Enter your email and password again.", restart: true },
        { status: 401, headers: NO_STORE }
      );
      clearMfaPendingCookie(res);
      return res;
    }
    if (result.kind === "locked") {
      const res = NextResponse.json(
        { error: LOCKED_MESSAGE, restart: true },
        { status: 429, headers: { ...NO_STORE, "Retry-After": "900" } }
      );
      clearMfaPendingCookie(res);
      return res;
    }
    if (result.kind === "invalid_code") {
      const left = result.attemptsLeft;
      return NextResponse.json(
        { error: `That code didn't work. ${left} attempt${left === 1 ? "" : "s"} left.`, attemptsLeft: left },
        { status: 401, headers: NO_STORE }
      );
    }

    const res = NextResponse.json({ success: true, user: result.user }, { headers: NO_STORE });
    setSessionCookie(res, result.sessionToken, result.user.role);
    clearMfaPendingCookie(res);
    await claimGuestCart(result.user.id);
    return res;
  } catch (err: unknown) {
    return NextResponse.json(
      { error: clientErrorMessage(err, "We could not check your code. Please try again.") },
      { status: 500, headers: NO_STORE }
    );
  }
}
