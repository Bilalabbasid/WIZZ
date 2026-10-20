import { NextRequest, NextResponse } from "next/server";
import { registerSellerAccount } from "@/modules/sellers/services";
import { createSessionToken } from "@/lib/auth";
import { SITE_CONFIG } from "@/lib/config";
import { cookies } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown-ip";
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

    return NextResponse.json({
      success: true,
      user,
      sellerOrg,
      membership,
      application,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error registering seller";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
