import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSellerContextForUser } from "@/modules/sellers/services";
import { createSellerShipment } from "@/modules/sellers/order-services";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const context = await getSellerContextForUser(user.id);
    if (!context?.sellerOrg) {
      return NextResponse.json({ error: "No seller organization found for this user." }, { status: 404 });
    }

    const { id } = await params;
    const body = await req.json();
    const { carrierName, trackingNumber, trackingUrl } = body;

    if (!carrierName || !trackingNumber) {
      return NextResponse.json(
        { error: "carrierName and trackingNumber are required." },
        { status: 400 }
      );
    }

    const shipment = await createSellerShipment(
      context.sellerOrg.id,
      id,
      { carrierName, trackingNumber, trackingUrl },
      user.id
    );

    return NextResponse.json({ success: true, shipment });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error creating shipment";
    const status = message.includes("FORBIDDEN") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
