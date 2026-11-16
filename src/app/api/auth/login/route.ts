import { NextRequest, NextResponse } from "next/server";
import { clientErrorMessage } from "@/lib/api-error";
import { authRequestMeta, setSessionCookie } from "@/lib/auth";
import { claimGuestCart } from "@/lib/cart-session";
import { checkRateLimit, resetRateLimit, clientIpFrom } from "@/lib/rate-limit";
import {
  INVALID_CREDENTIALS_MESSAGE,
  LOCKED_MESSAGE,
  attemptPasswordLogin,
  clearMfaPendingCookie,
  setMfaPendingCookie,
} from "../_lib/login";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * POST /api/auth/login — password step.
 * - Unknown email and wrong password give the same 401 body.
 * - 10 failures in 15 minutes lock the account (or unknown address) for 15 minutes.
 * - Accounts with MFA get { mfaRequired: true } and a 5-minute pending cookie; the session
 *   is only issued by POST /api/auth/mfa/verify.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400, headers: NO_STORE });
    }

    const cleanEmail = email.toLowerCase().trim();
    const clientIp = clientIpFrom(req.headers);
    const rateLimitKey = `login_${clientIp}_${cleanEmail}`;

    const limitResult = checkRateLimit(rateLimitKey, { windowMs: 60000, max: 5 });
    // Per-account limit across all IPs (slows distributed password guessing)
    const accountLimit = checkRateLimit(`login_account_${cleanEmail}`, { windowMs: 600000, max: 20 });
    if (!accountLimit.success) {
      return NextResponse.json(
        { error: "Too many sign-in attempts for this account. Please wait 10 minutes and try again." },
        { status: 429, headers: { ...NO_STORE, "Retry-After": Math.ceil(accountLimit.resetMs / 1000).toString() } }
      );
    }
    if (!limitResult.success) {
      return NextResponse.json(
        { error: "Too many login attempts. Please wait a minute before trying again." },
        { status: 429, headers: { ...NO_STORE, "Retry-After": Math.ceil(limitResult.resetMs / 1000).toString() } }
      );
    }

    const result = await attemptPasswordLogin({ email: cleanEmail, password, meta: authRequestMeta(req.headers) });

    if (result.kind === "invalid") {
      return NextResponse.json({ error: INVALID_CREDENTIALS_MESSAGE }, { status: 401, headers: NO_STORE });
    }
    if (result.kind === "locked") {
      return NextResponse.json(
        { error: LOCKED_MESSAGE },
        { status: 429, headers: { ...NO_STORE, "Retry-After": "900" } }
      );
    }

    // Reset the per-IP limiter once the password is right
    resetRateLimit(rateLimitKey);

    if (result.kind === "mfa_required") {
      const res = NextResponse.json({ success: true, mfaRequired: true }, { headers: NO_STORE });
      setMfaPendingCookie(res, result.pendingToken);
      return res;
    }

    const res = NextResponse.json(
      { success: true, user: result.user, mfaSetupRequired: result.mfaSetupRequired },
      { headers: NO_STORE }
    );
    setSessionCookie(res, result.sessionToken, result.user.role);
    clearMfaPendingCookie(res);
    await claimGuestCart(result.user.id);
    return res;
  } catch (err: unknown) {
    const message = clientErrorMessage(err, "Error during authentication");
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
