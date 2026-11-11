import { prisma } from "@/lib/db";
import {
  Prisma,
  CustomerOrderStatus,
  PaymentStatus,
  SellerOrderStatus,
  RefundStatus,
  CodCollectionStatus,
  CodRemittanceStatus,
  SettlementStatus,
  SettlementEntryType,
} from "@prisma/client";
import { returnOrderStock } from "../inventory/services";
import { assertSellerTransition, recomputeCustomerOrderStatus } from "./lifecycle";

export async function getOrderById(orderId: string) {
  return prisma.customerOrder.findUnique({
    where: { id: orderId },
    include: {
      sellerOrders: {
        include: {
          sellerOrg: true,
          items: true,
          shipments: { include: { events: true } },
          returnRequests: { include: { items: true } },
          settlementLedgers: true,
        },
      },
      paymentAttempts: true,
      refunds: true,
      codRecords: true,
      customerUser: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
    },
  });
}

export async function getOrderByNumber(orderNumber: string) {
  return prisma.customerOrder.findUnique({
    where: { orderNumber },
    include: {
      sellerOrders: {
        include: {
          sellerOrg: true,
          items: true,
          shipments: { include: { events: true } },
          returnRequests: { include: { items: true } },
          settlementLedgers: true,
        },
      },
      paymentAttempts: true,
      refunds: true,
      codRecords: true,
    },
  });
}

export async function getUserOrders(userId: string) {
  return prisma.customerOrder.findMany({
    where: { customerUserId: userId },
    orderBy: { createdAt: "desc" },
    include: {
      sellerOrders: {
        include: {
          sellerOrg: true,
          items: true,
          shipments: true,
        },
      },
    },
  });
}

export async function getAllOrders(options: {
  status?: CustomerOrderStatus;
  page?: number;
  limit?: number;
} = {}) {
  const { status, page = 1, limit = 20 } = options;
  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const [orders, total] = await Promise.all([
    prisma.customerOrder.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        customerUser: { select: { firstName: true, lastName: true, email: true } },
        sellerOrders: {
          include: {
            sellerOrg: { select: { name: true } },
            items: true,
            shipments: true,
          },
        },
        paymentAttempts: { take: 1, orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.customerOrder.count({ where }),
  ]);

  return { orders, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/**
 * Cancels one seller package inside a transaction: returns its stock (releases this
 * order's holds or restocks committed units), reverses unsettled seller credit, records a
 * PENDING refund when the customer already paid (finance completes it manually with a
 * reference), and re-derives the parent order status.
 */
async function cancelSuborderInTx(
  tx: Prisma.TransactionClient,
  sellerOrderId: string,
  reason: string,
  actorUserId?: string | null
) {
  const sellerOrder = await tx.sellerOrder.findUnique({
    where: { id: sellerOrderId },
    include: { customerOrder: true, items: true },
  });
  if (!sellerOrder) throw new Error("Seller order not found.");
  if (sellerOrder.status === SellerOrderStatus.CANCELLED) return sellerOrder;

  assertSellerTransition(sellerOrder.status, SellerOrderStatus.CANCELLED);

  // Conditional flip so two concurrent cancellations cannot both restock
  const flipped = await tx.sellerOrder.updateMany({
    where: { id: sellerOrderId, status: sellerOrder.status },
    data: { status: SellerOrderStatus.CANCELLED, netSellerPayableMinor: 0 },
  });
  if (flipped.count === 0) {
    throw new Error("VALIDATION: This package was updated by someone else. Refresh and try again.");
  }

  await returnOrderStock(sellerOrder.customerOrderId, tx, {
    reason: `Package ${sellerOrder.sellerOrderNumber} cancelled: ${reason}`,
    actorUserId,
    onlyVariantQuantities: sellerOrder.items
      .filter((i) => i.variantId)
      .map((i) => ({ variantId: i.variantId as string, quantity: i.quantity, sellerOrgId: sellerOrder.sellerOrgId })),
  });

  await tx.settlementLedger.updateMany({
    where: {
      sellerOrderId,
      status: { in: [SettlementStatus.PENDING, SettlementStatus.IN_ESCROW, SettlementStatus.ELIGIBLE, SettlementStatus.HELD] },
    },
    data: { status: SettlementStatus.REVERSED, holdReason: `Package cancelled: ${reason}` },
  });

  const isPaid = sellerOrder.customerOrder.paymentStatus === PaymentStatus.PAID;
  if (isPaid && sellerOrder.totalMinor > 0) {
    await tx.refund.create({
      data: {
        customerOrderId: sellerOrder.customerOrderId,
        sellerOrderId: sellerOrder.id,
        amountMinor: sellerOrder.totalMinor,
        currency: sellerOrder.customerOrder.currency,
        status: RefundStatus.PENDING,
        reason: `Package ${sellerOrder.sellerOrderNumber} cancelled: ${reason}`,
      },
    });
  }

  await tx.auditEvent.create({
    data: {
      actorUserId: actorUserId || null,
      entityType: "SellerOrder",
      entityId: sellerOrderId,
      action: "SUBORDER_CANCELLATION",
      detailsJson: JSON.stringify({
        customerOrderId: sellerOrder.customerOrderId,
        sellerOrderNumber: sellerOrder.sellerOrderNumber,
        fromStatus: sellerOrder.status,
        pendingRefundMinor: isPaid ? sellerOrder.totalMinor : 0,
        reason,
      }),
    },
  });

  await recomputeCustomerOrderStatus(tx, sellerOrder.customerOrderId);
  return { ...sellerOrder, status: SellerOrderStatus.CANCELLED };
}

/** Cancels a single seller package (seller or admin action). */
export async function cancelSellerSuborder(sellerOrderId: string, reason: string, actorUserId?: string) {
  return prisma.$transaction((tx) => cancelSuborderInTx(tx, sellerOrderId, reason, actorUserId));
}

const CUSTOMER_CANCELLABLE: CustomerOrderStatus[] = [
  CustomerOrderStatus.PENDING_PAYMENT,
  CustomerOrderStatus.PAID,
  CustomerOrderStatus.PROCESSING,
];

/**
 * Customer cancels their whole order. Allowed only while no package has been dispatched.
 * Every package is cancelled (stock returned, credit reversed, refund recorded if paid) and
 * the coupon use is given back.
 */
export async function requestOrderCancellation(orderId: string, userId: string, reason: string) {
  const cleanReason = String(reason || "Customer requested cancellation").slice(0, 300);
  return prisma.$transaction(async (tx) => {
    const order = await tx.customerOrder.findUnique({
      where: { id: orderId },
      include: { sellerOrders: true },
    });
    if (!order) throw new Error("Order not found.");
    if (order.customerUserId !== userId) throw new Error("FORBIDDEN: You can only cancel your own orders.");

    if (!CUSTOMER_CANCELLABLE.includes(order.status)) {
      throw new Error(
        order.status === CustomerOrderStatus.CANCELLED
          ? "VALIDATION: This order is already cancelled."
          : "VALIDATION: This order has already been dispatched, so it can't be cancelled. You can request a return after delivery."
      );
    }
    const dispatched = order.sellerOrders.some(
      (so) => so.status === SellerOrderStatus.DISPATCHED || so.status === SellerOrderStatus.DELIVERED
    );
    if (dispatched) {
      throw new Error("VALIDATION: Part of this order has already been dispatched, so it can't be cancelled. Contact support for help.");
    }

    for (const so of order.sellerOrders) {
      if (so.status !== SellerOrderStatus.CANCELLED) {
        await cancelSuborderInTx(tx, so.id, `Cancelled by customer: ${cleanReason}`, userId);
      }
    }

    await tx.customerOrder.update({
      where: { id: orderId },
      data: { status: CustomerOrderStatus.CANCELLED, notes: `Cancelled by customer: ${cleanReason}` },
    });

    // Give the coupon use back (never below zero)
    if (order.couponCode) {
      await tx.coupon.updateMany({
        where: { code: order.couponCode, timesUsed: { gt: 0 } },
        data: { timesUsed: { decrement: 1 } },
      });
    }

    await tx.auditEvent.create({
      data: {
        actorUserId: userId,
        entityType: "CustomerOrder",
        entityId: orderId,
        action: "CUSTOMER_CANCELLATION",
        detailsJson: JSON.stringify({ reason: cleanReason }),
      },
    });
  });
}

/**
 * Updates Cash on Delivery collection state upon courier physical collection from customer.
 */
export async function recordCodCourierCollection(
  trackingNumber: string,
  amountCollectedMinor: number,
  collectedAt: Date = new Date(),
  courierName?: string
) {
  const record = await prisma.codRemittanceRecord.findFirst({
    where: { trackingNumber },
  });

  if (!record) {
    throw new Error(`COD record with tracking number "${trackingNumber}" not found.`);
  }

  return prisma.codRemittanceRecord.update({
    where: { id: record.id },
    data: {
      collectionStatus: CodCollectionStatus.COLLECTED_BY_COURIER,
      amountCollectedMinor,
      collectedAt,
      courierName: courierName || record.courierName,
    },
  });
}

/**
 * Courier remits collected cash to platform bank account.
 * Reconciles the COD record, marks customer order PAID, and transitions seller escrow to ELIGIBLE.
 */
export async function reconcileCodCourierRemittance(input: {
  trackingNumber: string;
  courierRemittanceRef: string;
  amountRemittedMinor: number;
  bankDepositRef?: string;
  actorUserId?: string;
}) {
  const { trackingNumber, courierRemittanceRef, amountRemittedMinor, bankDepositRef, actorUserId } = input;

  const record = await prisma.codRemittanceRecord.findFirst({
    where: { trackingNumber },
    include: {
      customerOrder: {
        include: { sellerOrders: true },
      },
    },
  });

  if (!record) {
    throw new Error(`COD record with tracking number "${trackingNumber}" not found.`);
  }

  const isExactMatch = amountRemittedMinor >= record.amountExpectedMinor;
  const remittanceStatus = isExactMatch ? CodRemittanceStatus.RECONCILED : CodRemittanceStatus.DISCREPANCY;

  return prisma.$transaction(async (tx) => {
    // 1. Update COD Remittance Record
    const updatedCod = await tx.codRemittanceRecord.update({
      where: { id: record.id },
      data: {
        remittanceStatus,
        amountRemittedMinor,
        courierRemittanceRef,
        bankDepositRef: bankDepositRef || null,
        reconciledAt: new Date(),
        notes: isExactMatch
          ? `Exact COD remittance verified: PKR ${amountRemittedMinor / 100}`
          : `Discrepancy detected: Expected ${record.amountExpectedMinor}, Remitted ${amountRemittedMinor}`,
      },
    });

    // 2. Mark CustomerOrder as PAID
    await tx.customerOrder.update({
      where: { id: record.customerOrderId },
      data: { paymentStatus: PaymentStatus.PAID },
    });

    // 3. Transition linked SellerOrder settlement ledgers to ELIGIBLE
    if (record.sellerOrderId) {
      await tx.settlementLedger.updateMany({
        where: {
          sellerOrderId: record.sellerOrderId,
          status: { in: [SettlementStatus.PENDING, SettlementStatus.IN_ESCROW] },
        },
        data: {
          status: SettlementStatus.ELIGIBLE,
          eligibleAt: new Date(),
          holdReason: null,
        },
      });
    }

    // 4. Audit Log
    if (actorUserId) {
      await tx.auditEvent.create({
        data: {
          actorUserId,
          entityType: "CodRemittanceRecord",
          entityId: record.id,
          action: "COD_REMITTANCE_RECONCILED",
          detailsJson: JSON.stringify({
            trackingNumber,
            amountRemittedMinor,
            courierRemittanceRef,
            bankDepositRef,
          }),
        },
      });
    }

    return updatedCod;
  });
}

/**
 * Admin confirms the courier remitted the cash for a COD order.
 * Requirements: the order is a COD order, not cancelled, not already paid, and every
 * active package has been handed to the courier (cash is collected at delivery).
 * Seller credit becomes payable only for packages already DELIVERED; the rest stay in
 * escrow and are released when they are delivered. Cancelled packages are skipped and
 * dispute holds / reversals are never overridden.
 */
export async function reconcileCodPayment(
  orderId: string,
  remittanceRef: string,
  actorUserId?: string
) {
  const ref = String(remittanceRef || "").trim();
  if (ref.length < 3 || ref.length > 120) {
    throw new Error("VALIDATION: Enter the courier remittance reference (3-120 characters).");
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.customerOrder.findUnique({
      where: { id: orderId },
      include: { codRecords: true, sellerOrders: true },
    });
    if (!order) throw new Error("Order not found.");
    if (order.codRecords.length === 0) {
      throw new Error("VALIDATION: This is not a cash-on-delivery order.");
    }
    if (order.status === CustomerOrderStatus.CANCELLED || order.status === CustomerOrderStatus.REFUNDED) {
      throw new Error("VALIDATION: Cancelled or refunded orders cannot be reconciled.");
    }
    if (order.paymentStatus === PaymentStatus.PAID) {
      throw new Error("VALIDATION: This order is already marked as paid.");
    }

    const active = order.sellerOrders.filter((so) => so.status !== SellerOrderStatus.CANCELLED);
    const notWithCourier = active.filter(
      (so) => so.status !== SellerOrderStatus.DISPATCHED && so.status !== SellerOrderStatus.DELIVERED
    );
    if (notWithCourier.length > 0) {
      throw new Error(
        `VALIDATION: Package ${notWithCourier.map((so) => so.sellerOrderNumber).join(", ")} has not been dispatched yet, so the courier cannot have collected cash for it.`
      );
    }

    const expectedMinor = active.reduce((sum, so) => sum + so.totalMinor, 0);

    let existingNotes: Record<string, unknown> = {};
    try {
      existingNotes = order.notes ? JSON.parse(order.notes) : {};
    } catch {
      existingNotes = { rawNotes: order.notes };
    }

    // Conditional flip: two admins reconciling at once cannot both succeed
    const flipped = await tx.customerOrder.updateMany({
      where: { id: orderId, paymentStatus: { not: PaymentStatus.PAID } },
      data: {
        paymentStatus: PaymentStatus.PAID,
        notes: JSON.stringify({
          ...existingNotes,
          paymentMethod: "CASH_ON_DELIVERY",
          codStatus: "REMITTED_AND_RECONCILED",
          courierRemittanceRef: ref,
          reconciledAt: new Date().toISOString(),
        }),
      },
    });
    if (flipped.count === 0) throw new Error("VALIDATION: This order is already marked as paid.");

    const now = new Date();
    for (const record of order.codRecords) {
      const so = active.find((a) => a.id === record.sellerOrderId);
      if (!so) continue; // cancelled package: nothing was collected
      await tx.codRemittanceRecord.update({
        where: { id: record.id },
        data: {
          collectionStatus: CodCollectionStatus.COLLECTED_BY_COURIER,
          collectedAt: record.collectedAt || now,
          amountCollectedMinor: record.amountExpectedMinor,
          remittanceStatus: CodRemittanceStatus.RECONCILED,
          courierRemittanceRef: ref,
          amountRemittedMinor: record.amountExpectedMinor,
          reconciledAt: now,
        },
      });
    }

    for (const so of active) {
      const delivered = so.status === SellerOrderStatus.DELIVERED;
      const existingLedger = await tx.settlementLedger.findFirst({
        where: { sellerOrderId: so.id, entryType: SettlementEntryType.ORDER_CREDIT },
        orderBy: { createdAt: "asc" },
      });
      if (existingLedger) {
        if (delivered && (existingLedger.status === SettlementStatus.PENDING || existingLedger.status === SettlementStatus.IN_ESCROW)) {
          await tx.settlementLedger.update({
            where: { id: existingLedger.id },
            data: { status: SettlementStatus.ELIGIBLE, eligibleAt: now },
          });
        }
        continue;
      }
      await tx.settlementLedger.create({
        data: {
          sellerOrgId: so.sellerOrgId,
          sellerOrderId: so.id,
          entryType: SettlementEntryType.ORDER_CREDIT,
          amountMinor: so.netSellerPayableMinor,
          balanceAfterMinor: so.netSellerPayableMinor,
          status: delivered ? SettlementStatus.ELIGIBLE : SettlementStatus.IN_ESCROW,
          eligibleAt: delivered ? now : null,
          description: `COD remittance ${ref} for package #${so.sellerOrderNumber}`,
          referenceId: ref,
        },
      });
    }

    await tx.auditEvent.create({
      data: {
        actorUserId: actorUserId || null,
        entityType: "CustomerOrder",
        entityId: orderId,
        action: "COD_RECONCILIATION",
        detailsJson: JSON.stringify({ remittanceRef: ref, amountMinor: expectedMinor, currency: order.currency }),
      },
    });

    return tx.customerOrder.findUniqueOrThrow({ where: { id: orderId } });
  });
}
