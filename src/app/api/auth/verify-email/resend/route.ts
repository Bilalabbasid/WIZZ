import { NextRequest, NextResponse } from "next/server";
import { clientErrorMessage, clientErrorStatus } from "@/lib/api-error";
import { authRequestMeta, getCurrentUser } from "@/lib/auth";
import { isEmailConfigured, sendAccountEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { createEmailVerification } from "../../_lib/tokens";

export const dynamic = "force-dynamic";

/** POST /api/auth/verify-email/resend — emails a new verification link to the signed-in user. */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    if (user.isEmailVerified) {
      return NextResponse.json({ success: true, alreadyVerified: true, message: "Your email is already verified." });
    }
    if (!isEmailConfigured() && process.env.NODE_ENV === "production") {
      console.warn("[email] SMTP is not configured; verification email not sent.");
      return NextResponse.json(
        { error: "We can't send emails right now. You can keep shopping; please try again later." },
        { status: 503 }
      );
    }
    const limit = checkRateLimit(`verify_resend_${user.id}`, { windowMs: 60 * 60 * 1000, max: 3 });
    if (!limit.success) {
      return NextResponse.json(
        { error: "We've already sent a few links. Please check your inbox (and spam) or try again in an hour." },
        { status: 429, headers: { "Retry-After": Math.ceil(limit.resetMs / 1000).toString() } }
      );
    }

    const message = await createEmailVerification(user.id, authRequestMeta(req.headers));
    if (message && !(await sendAccountEmail(message)) && isEmailConfigured()) {
      return NextResponse.json({ error: "We couldn't send the email. Please try again in a few minutes." }, { status: 502 });
    }
    return NextResponse.json({ success: true, message: `We've sent a verification link to ${user.email}.` });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: clientErrorMessage(err, "We could not send a verification email. Please try again.") },
      { status: clientErrorStatus(err, 500) }
    );
  }
}
