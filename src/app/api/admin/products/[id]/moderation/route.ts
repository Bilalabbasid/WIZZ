import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { UserRole } from "@prisma/client";
import {
  approveProductModeration,
  rejectProductModeration,
} from "@/modules/sellers/catalog-services";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireRole([
      UserRole.PLATFORM_SUPER_ADMIN,
      UserRole.PLATFORM_CATALOG_ADMIN,
    ]);

    const { id } = await params;
    const { action, reason, notes } = await req.json();

    if (!action || !["APPROVE", "REJECT", "REQUEST_CHANGES"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Supported actions: APPROVE, REJECT, REQUEST_CHANGES." },
        { status: 400 }
      );
    }

    if (action === "APPROVE") {
      const product = await approveProductModeration(id, admin.id, notes);
      return NextResponse.json({ success: true, action: "APPROVED", product });
    }

    if (action === "REJECT" || action === "REQUEST_CHANGES") {
      if (!reason || reason.trim().length === 0) {
        return NextResponse.json(
          { error: "Reason is required when rejecting or requesting changes." },
          { status: 400 }
        );
      }

      const isChangeRequest = action === "REQUEST_CHANGES";
      const product = await rejectProductModeration(id, reason, isChangeRequest, admin.id);
      return NextResponse.json({
        success: true,
        action: isChangeRequest ? "CHANGES_REQUESTED" : "REJECTED",
        product,
      });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error processing moderation review";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
