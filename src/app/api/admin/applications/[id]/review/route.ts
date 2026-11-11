import { NextRequest, NextResponse } from "next/server";
import { clientErrorMessage, clientErrorStatus } from "@/lib/api-error";
import { requireRole } from "@/lib/auth";
import { UserRole } from "@prisma/client";
import { reviewSellerApplication } from "@/modules/sellers/services";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireRole([
      UserRole.PLATFORM_SUPER_ADMIN,
      UserRole.PLATFORM_SUPPORT,
    ]);

    const { id } = await params;
    const { decision, feedbackNote } = await req.json();

    if (!["APPROVED", "REJECTED", "CHANGES_REQUESTED"].includes(decision)) {
      return NextResponse.json({ error: "Invalid review decision." }, { status: 400 });
    }

    const application = await reviewSellerApplication(
      id,
      admin.id,
      decision,
      feedbackNote
    );

    return NextResponse.json({ success: true, application });
  } catch (err: unknown) {
    const message = clientErrorMessage(err, "Error reviewing application");
    return NextResponse.json({ error: message }, { status: clientErrorStatus(err) });
  }
}
