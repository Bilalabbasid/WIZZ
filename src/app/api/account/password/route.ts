import { NextRequest, NextResponse } from "next/server";
import { clientErrorMessage, clientErrorStatus } from "@/lib/api-error";
import { getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { formatZodError, passwordChangeSchema, zodFieldErrors } from "@/lib/validation";

export const dynamic = "force-dynamic";

// POST /api/account/password - change the signed-in user's password
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Please sign in to change your password." }, { status: 401 });
    }

    // Guard against guessing the current password from a hijacked session.
    if (!checkRateLimit(`pwchange_${user.id}`, { windowMs: 15 * 60 * 1000, max: 5 }).success) {
      return NextResponse.json(
        { error: "Too many password change attempts. Please wait 15 minutes and try again." },
        { status: 429 }
      );
    }

    let body: unknown = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }

    const parsed = passwordChangeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error), fieldErrors: zodFieldErrors(parsed.error) },
        { status: 400 }
      );
    }
    const { currentPassword, newPassword } = parsed.data;

    const record = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
    if (!record || !(await verifyPassword(currentPassword, record.passwordHash))) {
      return NextResponse.json(
        {
          error: "Your current password is incorrect.",
          fieldErrors: { currentPassword: "Your current password is incorrect." },
        },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword || (await verifyPassword(newPassword, record.passwordHash))) {
      return NextResponse.json(
        {
          error: "Choose a new password that is different from your current one.",
          fieldErrors: { newPassword: "Choose a new password that is different from your current one." },
        },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: clientErrorMessage(err, "We could not change your password.") },
      { status: clientErrorStatus(err, 500) }
    );
  }
}
