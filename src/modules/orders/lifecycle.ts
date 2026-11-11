/**
 * Order lifecycle rules shared by customer, seller and admin flows.
 *
 * Seller package (SellerOrder) states:
 *   PENDING_PAYMENT -> CONFIRMED (payment captured, or COD placed) -> PACKING -> DISPATCHED -> DELIVERED
 *   Any state before DISPATCHED -> CANCELLED (restocks, reverses escrow, records a pending refund if paid)
 * DISPATCHED is reached only by creating a shipment; DELIVERED only from DISPATCHED.
 *
 * The parent CustomerOrder status is always derived from its packages (recomputeCustomerOrderStatus),
 * never set independently, so customers, sellers and admins see the same state.
 */
import { Prisma, CustomerOrderStatus, SellerOrderStatus, SettlementEntryType, SettlementStatus, ShipmentStatus } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

/** Default return window. The live value is Admin → Settings: getCommerceSettings().returnWindowDays. */
export const RETURN_WINDOW_DAYS = 30;

const SELLER_TRANSITIONS: Record<SellerOrderStatus, SellerOrderStatus[]> = {
  PENDING_PAYMENT: [SellerOrderStatus.CANCELLED],
  CONFIRMED: [SellerOrderStatus.PACKING, SellerOrderStatus.CANCELLED],
  PACKING: [SellerOrderStatus.CONFIRMED, SellerOrderStatus.CANCELLED],
  DISPATCHED: [SellerOrderStatus.DELIVERED],
  DELIVERED: [],
  CANCELLED: [],
};

const STATUS_LABELS: Record<SellerOrderStatus, string> = {
  PENDING_PAYMENT: "awaiting payment",
  CONFIRMED: "confirmed",
  PACKING: "packing",
  DISPATCHED: "dispatched",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
};

export function sellerStatusLabel(status: SellerOrderStatus) {
  return STATUS_LABELS[status];
}

/** Statuses a seller may move a package to from `from` (DISPATCHED is created by a shipment). */
export function allowedSellerTransitions(from: SellerOrderStatus): SellerOrderStatus[] {
  return SELLER_TRANSITIONS[from] ?? [];
}

export function assertSellerTransition(from: SellerOrderStatus, to: SellerOrderStatus) {
  if (from === to) {
    throw new Error(`VALIDATION: This package is already ${STATUS_LABELS[from]}.`);
  }
  if (to === SellerOrderStatus.DISPATCHED) {
    if (from !== SellerOrderStatus.CONFIRMED && from !== SellerOrderStatus.PACKING) {
      throw new Error(`VALIDATION: A ${STATUS_LABELS[from]} package cannot be dispatched.`);
    }
    return;
  }
  if (!allowedSellerTransitions(from).includes(to)) {
    throw new Error(`VALIDATION: A ${STATUS_LABELS[from]} package cannot be changed to ${STATUS_LABELS[to]}.`);
  }
}

/**
 * Derives the parent order status from its seller packages. Orders still awaiting online
 * payment, and refunded orders, are left alone unless every package is cancelled.
 */
export async function recomputeCustomerOrderStatus(tx: TxClient, customerOrderId: string) {
  const order = await tx.customerOrder.findUnique({
    where: { id: customerOrderId },
    select: { status: true, sellerOrders: { select: { status: true } } },
  });
  if (!order) return null;

  const active = order.sellerOrders.filter((s) => s.status !== SellerOrderStatus.CANCELLED);
  let next: CustomerOrderStatus;

  if (active.length === 0) {
    next = CustomerOrderStatus.CANCELLED;
  } else if (order.status === CustomerOrderStatus.PENDING_PAYMENT || order.status === CustomerOrderStatus.REFUNDED) {
    return order.status;
  } else {
    const shipped = active.filter((s) => s.status === SellerOrderStatus.DISPATCHED || s.status === SellerOrderStatus.DELIVERED);
    const delivered = active.filter((s) => s.status === SellerOrderStatus.DELIVERED);
    if (delivered.length === active.length) next = CustomerOrderStatus.DELIVERED;
    else if (shipped.length === active.length) next = CustomerOrderStatus.SHIPPED;
    else if (shipped.length > 0) next = CustomerOrderStatus.PARTIALLY_SHIPPED;
    else next = CustomerOrderStatus.PROCESSING;
  }

  if (next !== order.status) {
    await tx.customerOrder.update({ where: { id: customerOrderId }, data: { status: next } });
  }
  return next;
}

/**
 * Makes a delivered package's seller credit payable. Online orders already have an escrow
 * credit from payment capture; COD credits are created at courier remittance reconciliation,
 * which also checks delivery, so only paid orders are touched here.
 */
export async function releaseDeliveredEscrow(
  tx: TxClient,
  sellerOrder: { id: string; sellerOrgId: string; sellerOrderNumber: string; netSellerPayableMinor: number },
  isPaid: boolean
) {
  if (!isPaid) return;
  const credit = await tx.settlementLedger.findFirst({
    where: { sellerOrderId: sellerOrder.id, entryType: SettlementEntryType.ORDER_CREDIT },
    orderBy: { createdAt: "asc" },
  });
  if (credit) {
    // Never override a dispute hold, a reversal or an already settled entry
    if (credit.status === SettlementStatus.IN_ESCROW || credit.status === SettlementStatus.PENDING) {
      await tx.settlementLedger.update({
        where: { id: credit.id },
        data: { status: SettlementStatus.ELIGIBLE, eligibleAt: new Date() },
      });
    }
    return;
  }
  await tx.settlementLedger.create({
    data: {
      sellerOrgId: sellerOrder.sellerOrgId,
      sellerOrderId: sellerOrder.id,
      entryType: SettlementEntryType.ORDER_CREDIT,
      amountMinor: sellerOrder.netSellerPayableMinor,
      balanceAfterMinor: sellerOrder.netSellerPayableMinor,
      status: SettlementStatus.ELIGIBLE,
      eligibleAt: new Date(),
      description: `Settlement credit for delivered package #${sellerOrder.sellerOrderNumber}`,
    },
  });
}

/** Marks a dispatched package delivered: shipment, package, escrow and parent order together. */
export async function markSellerOrderDelivered(tx: TxClient, sellerOrderId: string, note?: string) {
  const so = await tx.sellerOrder.findUnique({
    where: { id: sellerOrderId },
    include: {
      shipments: { orderBy: { createdAt: "desc" } },
      customerOrder: { select: { paymentStatus: true } },
    },
  });
  if (!so) throw new Error("Seller order not found.");
  assertSellerTransition(so.status, SellerOrderStatus.DELIVERED);
  const shipment = so.shipments[0];
  if (!shipment) throw new Error("VALIDATION: Create a shipment before marking this package delivered.");

  const flipped = await tx.sellerOrder.updateMany({
    where: { id: so.id, status: SellerOrderStatus.DISPATCHED },
    data: { status: SellerOrderStatus.DELIVERED },
  });
  if (flipped.count === 0) throw new Error("VALIDATION: This package was updated by someone else. Refresh and try again.");

  const now = new Date();
  await tx.shipment.update({
    where: { id: shipment.id },
    data: {
      status: ShipmentStatus.DELIVERED,
      deliveredAt: now,
      events: { create: { status: ShipmentStatus.DELIVERED, note: note || "Delivered to customer", eventTimestamp: now } },
    },
  });

  await releaseDeliveredEscrow(tx, so, so.customerOrder.paymentStatus === "PAID");
  await recomputeCustomerOrderStatus(tx, so.customerOrderId);
  return so;
}

/** When the package was delivered (latest shipment delivery time, else last package update). */
export function deliveredAtOf(so: { updatedAt: Date; shipments?: Array<{ deliveredAt: Date | null }> }) {
  const times = (so.shipments || []).map((s) => s.deliveredAt?.getTime() || 0).filter(Boolean);
  return times.length ? new Date(Math.max(...times)) : so.updatedAt;
}

/** Refund owed for returning `quantity` units of an order line (its discount share removed). */
export function lineRefundMinor(orderItem: { unitPriceMinor: number; discountMinor: number; quantity: number }, quantity: number) {
  const purchased = orderItem.quantity || 1;
  const discountShare = Math.round((orderItem.discountMinor * quantity) / purchased);
  return orderItem.unitPriceMinor * quantity - discountShare;
}

/** Sends an in-app notification to every active member of a seller organization. */
export async function notifySellerMembers(
  tx: TxClient,
  sellerOrgId: string,
  n: { title: string; message: string; type: "ORDER" | "RETURN" | "INVENTORY" | "INFO"; linkUrl?: string }
) {
  const members = await tx.sellerMembership.findMany({
    where: { sellerOrgId, isActive: true },
    select: { userId: true },
  });
  if (members.length === 0) return;
  await tx.notification.createMany({
    data: members.map((m) => ({ userId: m.userId, sellerOrgId, ...n })),
  });
}
