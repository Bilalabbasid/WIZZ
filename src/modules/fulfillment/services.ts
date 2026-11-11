import { prisma } from "@/lib/db";
import { ShipmentStatus } from "@prisma/client";
import { createSellerShipment } from "@/modules/sellers/order-services";
import { markSellerOrderDelivered } from "@/modules/orders/lifecycle";

/**
 * Platform-side dispatch (admin, or the first-party store team) for any seller package.
 * Uses the same rules as the seller portal: only CONFIRMED/PACKING packages, one shipment.
 */
export async function createShipment(
  sellerOrderId: string,
  carrierName: string,
  trackingNumber: string,
  trackingUrl?: string,
  actorUserId?: string
) {
  const so = await prisma.sellerOrder.findUnique({ where: { id: sellerOrderId }, select: { sellerOrgId: true } });
  if (!so) throw new Error("Seller order not found.");
  return createSellerShipment(so.sellerOrgId, sellerOrderId, { carrierName, trackingNumber, trackingUrl }, actorUserId);
}

const MILESTONES: ShipmentStatus[] = [
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.OUT_FOR_DELIVERY,
  ShipmentStatus.DELIVERED,
  ShipmentStatus.FAILED_DELIVERY,
];

/**
 * Records a courier tracking update. DELIVERED also completes the package (escrow release,
 * parent order status) through markSellerOrderDelivered.
 */
export async function addShipmentMilestone(
  shipmentId: string,
  status: ShipmentStatus,
  location?: string,
  note?: string
) {
  if (!MILESTONES.includes(status)) throw new Error("VALIDATION: Unknown shipment update.");
  return prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findUnique({ where: { id: shipmentId } });
    if (!shipment) throw new Error("Shipment not found.");
    if (shipment.status === ShipmentStatus.DELIVERED) {
      throw new Error("VALIDATION: This shipment has already been delivered.");
    }

    if (status === ShipmentStatus.DELIVERED) {
      await markSellerOrderDelivered(tx, shipment.sellerOrderId, note || (location ? `Delivered (${location})` : undefined));
      return tx.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
    }

    return tx.shipment.update({
      where: { id: shipmentId },
      data: {
        status,
        events: { create: { status, location: location || null, note: note || null } },
      },
    });
  });
}
