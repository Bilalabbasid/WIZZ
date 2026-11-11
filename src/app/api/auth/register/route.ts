import { NextRequest, NextResponse } from "next/server";
import { clientErrorMessage, clientErrorStatus } from "@/lib/api-error";
import { registrationSchema, zodFieldErrors } from "@/lib/validation";
import { prisma } from "@/lib/db";
import { hashPassword, createSessionToken } from "@/lib/auth";
import { SITE_CONFIG } from "@/lib/config";
import { cookies } from "next/headers";
import { claimGuestCart } from "@/lib/cart-session";
import { Prisma, UserRole } from "@prisma/client";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown-ip";
    const limitResult = checkRateLimit(`register_${clientIp}`, { windowMs: 600000, max: 10 });
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

    const body = await req.json().catch(() => null);
    const parsed = registrationSchema.safeParse(body ?? {});
    if (!parsed.success) {
      const fieldErrors = zodFieldErrors(parsed.error);
      // Default zod wording for missing names is not customer friendly.
      if (fieldErrors.firstName) fieldErrors.firstName = "Enter your first name (up to 60 characters).";
      if (fieldErrors.lastName) fieldErrors.lastName = "Enter your last name (up to 60 characters).";
      if (fieldErrors.email) fieldErrors.email = "Enter a valid email address.";
      const summary = Object.values(fieldErrors).join(" ");
      return NextResponse.json({ error: summary || "Please check the form and try again.", fieldErrors }, { status: 400 });
    }
    const { email: cleanEmail, password, firstName, lastName, phone } = parsed.data;

    const existing = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existing) {
      return NextResponse.json(
        {
          error: "An account with this email address already exists. Sign in instead.",
          fieldErrors: { email: "An account with this email address already exists." },
        },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        passwordHash,
        firstName,
        lastName,
        phone: phone ?? null,
        role: UserRole.CUSTOMER,
        isEmailVerified: true,
      },
    });

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
    // Two simultaneous sign-ups with the same email: the unique index wins the race.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "An account with this email address already exists. Sign in instead." },
        { status: 409 }
      );
    }
    const message = clientErrorMessage(err, "We could not create your account. Please try again.");
    return NextResponse.json({ error: message }, { status: clientErrorStatus(err, 500) });
  }
}
