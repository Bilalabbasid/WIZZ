import { NextRequest, NextResponse, after } from "next/server";
import { authRequestMeta, emailAuditFields } from "@/lib/auth";
import { sendAccountEmail } from "@/lib/email";
import { checkRateLimit, clientIpFrom } from "@/lib/rate-limit";
import { PASSWORD_RESET_GENERIC_MESSAGE, requestPasswordReset } from "../../_lib/tokens";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * POST /api/auth/password-reset/request { email }
 * Always answers with the same message whether or not the account exists. The email is
 * sent after the response (so timing doesn't reveal the account either). When SMTP isn't
 * configured the server logs a warning and the response stays the same.
 */
export async function POST(req: NextRequest) {
  const ok = () => NextResponse.json({ success: true, message: PASSWORD_RESET_GENERIC_MESSAGE }, { headers: NO_STORE });
  try {
    const ip = clientIpFrom(req.headers);
    const ipLimit = checkRateLimit(`pwreset_ip_${ip}`, { windowMs: 15 * 60 * 1000, max: 5 });
    if (!ipLimit.success) {
      return NextResponse.json(
        { error: "Too many reset requests. Please wait 15 minutes and try again." },
        { status: 429, headers: { ...NO_STORE, "Retry-After": Math.ceil(ipLimit.resetMs / 1000).toString() } }
      );
    }

    const body = await req.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.toLowerCase().trim() : "";
    if (!email || !/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400, headers: NO_STORE });
    }

    // Per-address limit: silently ignore extra requests (same response, no extra emails).
    const { emailHash } = emailAuditFields(email);
    if (!checkRateLimit(`pwreset_email_${emailHash}`, { windowMs: 60 * 60 * 1000, max: 3 }).success) {
      return ok();
    }

    const message = await requestPasswordReset(email, authRequestMeta(req.headers));
    if (message) {
      after(async () => {
        await sendAccountEmail(message);
      });
    }
    return ok();
  } catch (err: unknown) {
    // Never reveal failures that could depend on whether the account exists.
    console.error("[auth] password reset request failed:", err instanceof Error ? err.message : err);
    return ok();
  }
}
