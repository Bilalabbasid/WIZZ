import { prisma } from "@/lib/db";
import { ShipmentStatus, SellerOrderStatus, CustomerOrderStatus } from "@prisma/client";

export async function createShipment(
  sellerOrderId: string,
  carrierName: string,
  trackingNumber: string,
  trackingUrl?: string
) {
  return prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.create({
      data: {
        sellerOrderId,
        carrierName,
        trackingNumber,
        trackingUrl: trackingUrl || null,
        status: ShipmentStatus.LABEL_CREATED,
        events: {
          create: {
            status: ShipmentStatus.LABEL_CREATED,
            note: `Shipping label created with ${carrierName}. Tracking: ${trackingNumber}`,
          },
        },
      },
    });

    // Update seller order status to DISPATCHED
    await tx.sellerOrder.update({
      where: { id: sellerOrderId },
      data: { status: SellerOrderStatus.DISPATCHED },
    });

    // Check if customer order should be marked PARTIALLY_SHIPPED or SHIPPED
    const sellerOrder = await tx.sellerOrder.findUnique({
      where: { id: sellerOrderId },
      select: { customerOrderId: true },
    });

    if (sellerOrder) {
      await tx.customerOrder.update({
        where: { id: sellerOrder.customerOrderId },
        data: { status: CustomerOrderStatus.SHIPPED },
      });
    }

    return shipment;
  });
}

export async function addShipmentMilestone(
  shipmentId: string,
  status: ShipmentStatus,
  location?: string,
  note?: string
) {
  return prisma.$transaction(async (tx) => {
    await tx.shipmentEvent.create({
      data: {
        shipmentId,
        status,
        location: location || null,
        note: note || null,
      },
    });

    const isDelivered = status === ShipmentStatus.DELIVERED;

    const shipment = await tx.shipment.update({
      where: { id: shipmentId },
      data: {
        status,
        deliveredAt: isDelivered ? new Date() : undefined,
      },
      include: { sellerOrder: true },
    });

    if (isDelivered) {
      await tx.sellerOrder.update({
        where: { id: shipment.sellerOrderId },
        data: { status: SellerOrderStatus.DELIVERED },
      });
    }

    return shipment;
  });
}
