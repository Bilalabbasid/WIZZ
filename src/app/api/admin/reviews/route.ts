import { NextResponse } from "next/server";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { moderateReview } from "@/modules/reviews/services";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const user = await requireRole([
      "PLATFORM_SUPER_ADMIN",
      "PLATFORM_CATALOG_ADMIN",
      "PLATFORM_SUPPORT",
    ]);


    const body = await req.json();
    const { reviewId, isApproved } = body;

    if (!reviewId || typeof isApproved !== "boolean") {
      return NextResponse.json(
        { error: "reviewId and isApproved (boolean) are required." },
        { status: 400 }
      );
    }

    const updated = await moderateReview(reviewId, isApproved);

    // Record audit event
    await prisma.auditEvent.create({
      data: {
        actorUserId: user!.id,
        entityType: "Review",
        entityId: reviewId,
        action: isApproved ? "REVIEW_APPROVED" : "REVIEW_REJECTED",
        detailsJson: JSON.stringify({ reviewId, isApproved }),
      },
    });

    return NextResponse.json({ success: true, review: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to moderate review" },
      { status: 403 }
    );
  }
}
