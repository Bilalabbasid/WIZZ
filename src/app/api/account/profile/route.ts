import { NextRequest, NextResponse } from "next/server";
import { clientErrorMessage, clientErrorStatus } from "@/lib/api-error";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatZodError, profileUpdateSchema, zodFieldErrors } from "@/lib/validation";

export const dynamic = "force-dynamic";

// PATCH /api/account/profile - update the signed-in user's name and phone
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Please sign in to update your profile." }, { status: 401 });
    }

    let body: unknown = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }

    const parsed = profileUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error), fieldErrors: zodFieldErrors(parsed.error) },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        phone: parsed.data.phone,
      },
      select: { firstName: true, lastName: true, phone: true },
    });

    return NextResponse.json({ success: true, profile: updated });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: clientErrorMessage(err, "We could not update your profile.") },
      { status: clientErrorStatus(err, 500) }
    );
  }
}
