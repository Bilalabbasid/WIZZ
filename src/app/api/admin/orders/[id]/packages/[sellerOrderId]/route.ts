import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { clientErrorMessage, clientErrorStatus } from "@/lib/api-error";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";
import { cancelSellerSuborder } from "@/modules/orders/services";
import { markSellerOrderDelivered } from "@/modules/orders/lifecycle";

const bodySchema = z.object({
  action: z.enum(["MARK_DELIVERED", "CANCEL"]),
  reason: z.string().trim().max(300).optional(),
});

/**
 * Admin actions on one seller package of an order:
 *   MARK_DELIVERED - courier confirmed delivery (package must be dispatched)
 *   CANCEL         - cancel before dispatch (restock, reverse seller credit, pending refund if paid)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sellerOrderId: string }> }
) {
  try {
    const user = await requireRole([UserRole.PLATFORM_SUPER_ADMIN, UserRole.PLATFORM_SUPPORT]);
    const { id, sellerOrderId } = await params;
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Choose MARK_DELIVERED or CANCEL." }, { status: 400 });

    const pkg = await prisma.sellerOrder.findFirst({ where: { id: sellerOrderId, customerOrderId: id }, select: { id: true } });
    if (!pkg) return NextResponse.json({ error: "That package is not part of this order." }, { status: 404 });

    if (parsed.data.action === "CANCEL") {
      const reason = parsed.data.reason || "";
      if (reason.length < 3) return NextResponse.json({ error: "Enter a cancellation reason." }, { status: 400 });
      await cancelSellerSuborder(sellerOrderId, `Cancelled by platform: ${reason}`, user.id);
    } else {
      await prisma.$transaction(async (tx) => {
        await markSellerOrderDelivered(tx, sellerOrderId, parsed.data.reason || "Delivery confirmed by platform");
        await tx.auditEvent.create({
          data: {
            actorUserId: user.id,
            entityType: "SellerOrder",
            entityId: sellerOrderId,
            action: "MARK_DELIVERED",
            detailsJson: JSON.stringify({ customerOrderId: id }),
          },
        });
      });
    }

    const updated = await prisma.sellerOrder.findUniqueOrThrow({ where: { id: sellerOrderId } });
    return NextResponse.json({ success: true, sellerOrder: updated });
  } catch (err: unknown) {
    return NextResponse.json({ error: clientErrorMessage(err, "Could not update the package.") }, { status: clientErrorStatus(err) });
  }
}
