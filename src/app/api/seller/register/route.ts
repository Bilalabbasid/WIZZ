import { NextRequest, NextResponse, after } from "next/server";
import { clientErrorMessage, clientErrorStatus } from "@/lib/api-error";
import { registerSellerAccount } from "@/modules/sellers/services";
import { authRequestMeta, issueSessionToken, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendAccountEmail } from "@/lib/email";
import { claimGuestCart } from "@/lib/cart-session";
import { checkRateLimit, clientIpFrom } from "@/lib/rate-limit";
import { createEmailVerification } from "@/app/api/auth/_lib/tokens";

export async function POST(req: NextRequest) {
  try {
    const clientIp = clientIpFrom(req.headers);
    const limitResult = checkRateLimit(`seller_register_${clientIp}`, { windowMs: 600000, max: 10 });
    if (!limitResult.success) {
      return NextResponse.json(
        { error: "Too many registration attempts from this IP. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(limitResult.resetMs / 1000).toString(),
          },
        }
      );
    }

    const body = await req.json();
    const { email, password, firstName, lastName, phone, tradingName, legalBusinessName, city, addressLine } = body;

    if (!email || !password || !firstName || !lastName || !tradingName) {
      return NextResponse.json(
        { error: "Email, password, first name, last name, and store trading name are required." },
        { status: 400 }
      );
    }

    const { user, sellerOrg, membership, application } = await registerSellerAccount({
      email,
      password,
      firstName,
      lastName,
      phone,
      tradingName,
      legalBusinessName,
      city,
      addressLine,
    });

    // registerSellerAccount (src/modules/sellers/services.ts) still marks the new user as
    // verified; the user was created just now, so reset it until the emailed link is opened.
    await prisma.user.update({ where: { id: user.id }, data: { isEmailVerified: false } });
    const verification = await createEmailVerification(user.id, authRequestMeta(req.headers)).catch((err) => {
      console.error("[auth] could not create email verification:", err instanceof Error ? err.message : err);
      return null;
    });
    if (verification) {
      after(async () => {
        await sendAccountEmail(verification);
      });
    }

    // Automatically authenticate the new seller with session cookie
    const token = await issueSessionToken(user, { mfa: false });

    const res = NextResponse.json({
      success: true,
      // Never echo the password hash or internal records back to the browser
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
      sellerOrg: { id: sellerOrg.id, name: sellerOrg.name, slug: sellerOrg.slug, operationalStatus: sellerOrg.operationalStatus },
      membership: { role: membership.role },
      application: { id: application.id, status: application.status },
    });
    setSessionCookie(res, token, user.role);
    await claimGuestCart(user.id);
    return res;
  } catch (err: unknown) {
    const message = clientErrorMessage(err, "Error registering seller");
    return NextResponse.json({ error: message }, { status: clientErrorStatus(err) });
  }
}
