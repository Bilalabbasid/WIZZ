import { NextRequest, NextResponse } from "next/server";
import { clientErrorMessage } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import { verifyPassword, createSessionToken } from "@/lib/auth";
import { SITE_CONFIG } from "@/lib/config";
import { cookies } from "next/headers";
import { claimGuestCart } from "@/lib/cart-session";
import { checkRateLimit, resetRateLimit, clientIpFrom } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
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
        { status: 429, headers: { "Retry-After": Math.ceil(accountLimit.resetMs / 1000).toString() } }
      );
    }
    if (!limitResult.success) {
      return NextResponse.json(
        { error: "Too many login attempts. Please wait a minute before trying again." },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(limitResult.resetMs / 1000).toString(),
          },
        }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    // Reset rate limit upon successful authentication
    resetRateLimit(rateLimitKey);

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
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  } catch (err: unknown) {
    const message = clientErrorMessage(err, "Error during authentication");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
