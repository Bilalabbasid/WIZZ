import { NextRequest, NextResponse } from "next/server";
import { clientErrorMessage, clientErrorStatus } from "@/lib/api-error";
import { registerSellerAccount } from "@/modules/sellers/services";
import { createSessionToken } from "@/lib/auth";
import { SITE_CONFIG } from "@/lib/config";
import { cookies } from "next/headers";
import { claimGuestCart } from "@/lib/cart-session";
import { checkRateLimit, clientIpFrom } from "@/lib/rate-limit";

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

    // Automatically authenticate the new seller with session cookie
    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const cookieStore = await cookies();
    cookieStore.set(SITE_CONFIG.sessionCookieName, token, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * SITE_CONFIG.sessionExpiryDays,
    });
    await claimGuestCart(user.id);

    return NextResponse.json({
      success: true,
      // Never echo the password hash or internal records back to the browser
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
      sellerOrg: { id: sellerOrg.id, name: sellerOrg.name, slug: sellerOrg.slug, operationalStatus: sellerOrg.operationalStatus },
      membership: { role: membership.role },
      application: { id: application.id, status: application.status },
    });
  } catch (err: unknown) {
    const message = clientErrorMessage(err, "Error registering seller");
    return NextResponse.json({ error: message }, { status: clientErrorStatus(err) });
  }
}
