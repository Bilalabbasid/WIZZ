import { NextRequest, NextResponse } from "next/server";
import { clientErrorMessage, clientErrorStatus } from "@/lib/api-error";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";
import { createShipment } from "@/modules/fulfillment/services";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole([UserRole.PLATFORM_SUPER_ADMIN, UserRole.PLATFORM_SUPPORT]);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { sellerOrderId, carrierName, trackingNumber, trackingUrl } = body as Record<string, string | undefined>;

    if (!sellerOrderId || !carrierName || !trackingNumber) {
      return NextResponse.json({ error: "Choose the package, courier and tracking number." }, { status: 400 });
    }

    // The package must belong to the order in the URL
    const pkg = await prisma.sellerOrder.findFirst({ where: { id: sellerOrderId, customerOrderId: id }, select: { id: true } });
    if (!pkg) return NextResponse.json({ error: "That package is not part of this order." }, { status: 404 });

    const shipment = await createShipment(sellerOrderId, carrierName, trackingNumber, trackingUrl, user.id);
    return NextResponse.json({ success: true, shipment });
  } catch (err: unknown) {
    return NextResponse.json({ error: clientErrorMessage(err, "Could not create the shipment.") }, { status: clientErrorStatus(err) });
  }
}
