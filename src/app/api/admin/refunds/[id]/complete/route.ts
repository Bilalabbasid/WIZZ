import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PaymentStatus, RefundStatus, UserRole } from "@prisma/client";
import { clientErrorMessage, clientErrorStatus } from "@/lib/api-error";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  reference: z.string().trim().min(3, "Enter the reference of the refund transfer you made.").max(120),
});

/**
 * Finance confirms a PENDING refund (e.g. from a cancelled paid order) was actually paid,
 * with the bank/wallet transfer reference. When every refund of a fully cancelled order is
 * done, the order's payment status becomes REFUNDED.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole([UserRole.PLATFORM_SUPER_ADMIN, UserRole.PLATFORM_FINANCE_ADMIN]);
    const { id } = await params;
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request." }, { status: 400 });
    }

    const refund = await prisma.$transaction(async (tx) => {
      const flipped = await tx.refund.updateMany({
        where: { id, status: RefundStatus.PENDING },
        data: { status: RefundStatus.SUCCEEDED, externalRefundRef: parsed.data.reference },
      });
      if (flipped.count === 0) {
        throw new Error("VALIDATION: This refund is not pending (already completed or not found).");
      }
      const done = await tx.refund.findUniqueOrThrow({ where: { id } });

      const order = await tx.customerOrder.findUnique({
        where: { id: done.customerOrderId },
        select: { status: true, refunds: { select: { status: true } } },
      });
      if (order && order.status === "CANCELLED" && order.refunds.every((r) => r.status === RefundStatus.SUCCEEDED)) {
        await tx.customerOrder.update({ where: { id: done.customerOrderId }, data: { paymentStatus: PaymentStatus.REFUNDED } });
      }

      await tx.auditEvent.create({
        data: {
          actorUserId: user.id,
          entityType: "Refund",
          entityId: id,
          action: "REFUND_COMPLETED",
          detailsJson: JSON.stringify({ reference: parsed.data.reference, amountMinor: done.amountMinor }),
        },
      });
      return done;
    });

    return NextResponse.json({ success: true, refund });
  } catch (err: unknown) {
    return NextResponse.json({ error: clientErrorMessage(err, "Could not complete the refund.") }, { status: clientErrorStatus(err) });
  }
}
