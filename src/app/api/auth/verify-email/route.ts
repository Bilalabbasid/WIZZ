import { NextRequest, NextResponse } from "next/server";
import { clientErrorMessage, clientErrorStatus } from "@/lib/api-error";
import { authRequestMeta } from "@/lib/auth";
import { checkRateLimit, clientIpFrom } from "@/lib/rate-limit";
import { confirmEmailVerification } from "../_lib/tokens";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/verify-email { token } — confirms the address from the emailed link.
 * The /verify-email page posts here from the browser, so link scanners that only GET the
 * page don't use up the token.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = clientIpFrom(req.headers);
    if (!checkRateLimit(`verify_email_${ip}`, { windowMs: 15 * 60 * 1000, max: 20 }).success) {
      return NextResponse.json({ error: "Too many attempts. Please wait 15 minutes and try again." }, { status: 429 });
    }
    const body = await req.json().catch(() => null);
    await confirmEmailVerification(body?.token, authRequestMeta(req.headers));
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: clientErrorMessage(err, "We could not verify your email. Please try again.") },
      { status: clientErrorStatus(err, 500) }
    );
  }
}
