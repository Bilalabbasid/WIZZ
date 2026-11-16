import { NextRequest, NextResponse } from "next/server";
import { clientErrorMessage, clientErrorStatus } from "@/lib/api-error";
import { authRequestMeta, getCurrentUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { beginMfaSetup } from "../../_lib/mfa";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/mfa/setup — starts authenticator enrolment for the signed-in user.
 * Works without a two-factor session so staff can enrol. Returns the otpauth:// URI,
 * the base32 secret for manual entry and a QR image; MFA stays off until /enable.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    if (!checkRateLimit(`mfa_setup_${user.id}`, { windowMs: 60 * 60 * 1000, max: 10 }).success) {
      return NextResponse.json({ error: "Too many set-up attempts. Please try again in an hour." }, { status: 429 });
    }
    const setup = await beginMfaSetup(user.id, authRequestMeta(req.headers));
    return NextResponse.json(
      { success: true, otpauthUri: setup.otpauthUri, secret: setup.secret, qrDataUrl: setup.qrDataUrl },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: clientErrorMessage(err, "We could not start two-factor set-up. Please try again.") },
      { status: clientErrorStatus(err, 500) }
    );
  }
}
