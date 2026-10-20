import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { UserRole } from "@prisma/client";
import { createShipment } from "@/modules/fulfillment/services";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole([
      UserRole.PLATFORM_SUPER_ADMIN,
      UserRole.PLATFORM_SUPPORT,
    ]);

    const { sellerOrderId, carrierName, trackingNumber, trackingUrl } = await req.json();

    if (!sellerOrderId || !carrierName || !trackingNumber) {
      return NextResponse.json(
        { error: "sellerOrderId, carrierName, and trackingNumber are required." },
        { status: 400 }
      );
    }

    const shipment = await createShipment(
      sellerOrderId,
      carrierName,
      trackingNumber,
      trackingUrl
    );

    return NextResponse.json({ success: true, shipment });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error creating shipment";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
