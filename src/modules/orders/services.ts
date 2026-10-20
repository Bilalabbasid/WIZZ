import { prisma } from "@/lib/db";
import {
  CustomerOrderStatus,
  PaymentStatus,
  SellerOrderStatus,
  InventoryAdjustmentReason,
  RefundStatus,
  CodCollectionStatus,
  CodRemittanceStatus,
  SettlementStatus,
  SettlementEntryType,
} from "@prisma/client";
import { releaseStockReservation } from "../inventory/services";
import { SITE_CONFIG } from "@/lib/config";

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

export async function updateCustomerOrderStatus(
  orderId: string,
  status: CustomerOrderStatus,
  actorUserId?: string
) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.customerOrder.update({
      where: { id: orderId },
      data: { status },
    });

    if (actorUserId) {
      await tx.auditEvent.create({
        data: {
          actorUserId,
          entityType: "CustomerOrder",
          entityId: orderId,
          action: "STATUS_CHANGE",
          detailsJson: JSON.stringify({ newStatus: status }),
        },
      });
    }

    return updated;
  });
}

/**
 * Cancels a single seller suborder package independently within a multi-seller customer order.
 * - Releases/restocks inventory for that suborder's items.
 * - If order was paid, issues an auditable refund record for the suborder amount.
 * - Reverses the seller's escrow hold and resets netSellerPayable to 0.
 * - If all suborders are cancelled, cancels the overall customer order.
 */
export async function cancelSellerSuborder(
  sellerOrderId: string,
  reason: string,
  actorUserId?: string
) {
  const sellerOrder = await prisma.sellerOrder.findUnique({
    where: { id: sellerOrderId },
    include: {
      customerOrder: {
        include: {
          sellerOrders: true,
        },
      },
      items: true,
      shipments: true,
    },
  });

  if (!sellerOrder) {
    throw new Error("Seller order not found.");
  }

  if (sellerOrder.status === SellerOrderStatus.CANCELLED) {
    return sellerOrder;
  }

  // Prevent cancellation if suborder has already been dispatched
  const hasShipped = sellerOrder.shipments.some((s) => s.status !== "LABEL_CREATED");
  if (hasShipped || sellerOrder.status === SellerOrderStatus.DISPATCHED || sellerOrder.status === SellerOrderStatus.DELIVERED) {
    throw new Error("Suborder has already been dispatched and cannot be cancelled directly. Initiate a return request instead.");
  }

  return prisma.$transaction(async (tx) => {
    // 1. Restock inventory or release active reservations for each item
    for (const item of sellerOrder.items) {
      if (item.variantId) {
        // Check for active reservations
        const activeRes = await tx.inventoryReservation.findFirst({
          where: { variantId: item.variantId, status: "ACTIVE" },
        });

        if (activeRes) {
          await releaseStockReservation(activeRes.id);
        } else {
          // If already committed, increment availableUnits
          await tx.inventoryLevel.update({
            where: { variantId: item.variantId },
            data: { availableUnits: { increment: item.quantity } },
          });

          await tx.inventoryAdjustment.create({
            data: {
              variantId: item.variantId,
              sellerOrgId: sellerOrder.sellerOrgId,
              actorUserId: actorUserId || null,
              deltaUnits: item.quantity,
              balanceAfter: 0,
              reasonCode: InventoryAdjustmentReason.PURCHASE, // Compensating stock restock
              notes: `Cancelled suborder #${sellerOrder.sellerOrderNumber}: ${reason}`,
            },
          });
        }
      }
    }

    // 2. Mark seller suborder as CANCELLED with 0 net payable
    const updatedSellerOrder = await tx.sellerOrder.update({
      where: { id: sellerOrderId },
      data: {
        status: SellerOrderStatus.CANCELLED,
        netSellerPayableMinor: 0,
      },
    });

    // 3. Reverse any SettlementLedger escrow records
    await tx.settlementLedger.updateMany({
      where: { sellerOrderId, status: { in: [SettlementStatus.PENDING, SettlementStatus.IN_ESCROW] } },
      data: {
        status: SettlementStatus.REVERSED,
        holdReason: `Suborder cancelled: ${reason}`,
      },
    });

    // 4. If customer already paid, issue refund record for this suborder
    const isPaid = sellerOrder.customerOrder.paymentStatus === PaymentStatus.PAID;
    if (isPaid && sellerOrder.totalMinor > 0) {
      await tx.refund.create({
        data: {
          customerOrderId: sellerOrder.customerOrderId,
          sellerOrderId: sellerOrder.id,
          amountMinor: sellerOrder.totalMinor,
          currency: sellerOrder.customerOrder.currency,
          status: RefundStatus.SUCCEEDED,
          reason: `Suborder ${sellerOrder.sellerOrderNumber} cancelled: ${reason}`,
          externalRefundRef: `REF_CAN_${Date.now()}`,
        },
      });
    }

    // 5. Update overall CustomerOrder state
    const allSiblingOrders = sellerOrder.customerOrder.sellerOrders;
    const remainingActive = allSiblingOrders.filter(
      (so) => so.id !== sellerOrderId && so.status !== SellerOrderStatus.CANCELLED
    );

    if (remainingActive.length === 0) {
      // All suborders in customer order are now cancelled
      await tx.customerOrder.update({
        where: { id: sellerOrder.customerOrderId },
        data: {
          status: CustomerOrderStatus.CANCELLED,
          paymentStatus: isPaid ? PaymentStatus.REFUNDED : PaymentStatus.UNPAID,
          notes: `Entire order cancelled. Last suborder #${sellerOrder.sellerOrderNumber} cancelled: ${reason}`,
        },
      });
    }

    // 6. Audit log
    await tx.auditEvent.create({
      data: {
        actorUserId: actorUserId || null,
        entityType: "SellerOrder",
        entityId: sellerOrderId,
        action: "SUBORDER_CANCELLATION",
        detailsJson: JSON.stringify({
          customerOrderId: sellerOrder.customerOrderId,
          sellerOrderNumber: sellerOrder.sellerOrderNumber,
          refundIssuedMinor: isPaid ? sellerOrder.totalMinor : 0,
          reason,
        }),
      },
    });

    return updatedSellerOrder;
  });
}

/**
 * Customer requests cancellation of their order.
 * If multiple suborders exist, cancels all eligible unfulfilled suborders.
 */
export async function requestOrderCancellation(orderId: string, userId: string, reason: string) {
  const order = await prisma.customerOrder.findUnique({
    where: { id: orderId },
    include: { sellerOrders: { include: { shipments: true } } },
  });

  if (!order) {
    throw new Error("Order not found.");
  }

  if (order.customerUserId !== userId) {
    throw new Error("FORBIDDEN: You can only cancel your own orders.");
  }

  // Only allow cancellation prior to shipment dispatch
  const hasShipped = order.sellerOrders.some((so) =>
    so.shipments.some((s) => s.status !== "LABEL_CREATED")
  );

  if (hasShipped || order.status === CustomerOrderStatus.SHIPPED || order.status === CustomerOrderStatus.DELIVERED) {
    throw new Error("Order has already been dispatched and cannot be cancelled directly. Please initiate a return instead.");
  }

  return prisma.$transaction(async (tx) => {
    await tx.customerOrder.update({
      where: { id: orderId },
      data: {
        status: CustomerOrderStatus.CANCELLED,
        notes: `Cancelled by customer: ${reason}`,
      },
    });

    await tx.sellerOrder.updateMany({
      where: { customerOrderId: orderId },
      data: { status: SellerOrderStatus.CANCELLED, netSellerPayableMinor: 0 },
    });

    await tx.settlementLedger.updateMany({
      where: { sellerOrder: { customerOrderId: orderId } },
      data: { status: SettlementStatus.REVERSED, holdReason: `Customer cancelled: ${reason}` },
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: userId,
        entityType: "CustomerOrder",
        entityId: orderId,
        action: "CUSTOMER_CANCELLATION",
        detailsJson: JSON.stringify({ reason }),
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
 * Reconciles COD order payment using remittance reference.
 * Maintained for backward compatibility.
 */
export async function reconcileCodPayment(
  orderId: string,
  remittanceRef: string,
  actorUserId?: string
) {
  const order = await prisma.customerOrder.findUnique({
    where: { id: orderId },
    include: { codRecords: true, sellerOrders: true },
  });

  if (!order) {
    throw new Error("Order not found.");
  }

  if (order.paymentStatus === PaymentStatus.PAID) {
    throw new Error("Order is already marked as PAID.");
  }

  let existingNotes: Record<string, unknown> = {};
  try {
    existingNotes = order.notes ? JSON.parse(order.notes) : {};
  } catch {
    existingNotes = { rawNotes: order.notes };
  }

  const updatedNotes = {
    ...existingNotes,
    paymentMethod: "CASH_ON_DELIVERY",
    codStatus: "REMITTED_AND_RECONCILED",
    courierRemittanceRef: remittanceRef,
    reconciledAt: new Date().toISOString(),
  };

  return prisma.$transaction(async (tx) => {
    const updatedOrder = await tx.customerOrder.update({
      where: { id: orderId },
      data: {
        paymentStatus: PaymentStatus.PAID,
        notes: JSON.stringify(updatedNotes),
      },
    });

    // Update any COD records
    await tx.codRemittanceRecord.updateMany({
      where: { customerOrderId: orderId },
      data: {
        collectionStatus: CodCollectionStatus.COLLECTED_BY_COURIER,
        remittanceStatus: CodRemittanceStatus.RECONCILED,
        courierRemittanceRef: remittanceRef,
        amountRemittedMinor: order.totalMinor,
        reconciledAt: new Date(),
      },
    });

    // Transition or initialize seller settlement ledgers to ELIGIBLE
    for (const so of order.sellerOrders) {
      const existingLedger = await tx.settlementLedger.findFirst({
        where: { sellerOrderId: so.id, entryType: SettlementEntryType.ORDER_CREDIT },
      });

      if (existingLedger) {
        await tx.settlementLedger.update({
          where: { id: existingLedger.id },
          data: {
            status: SettlementStatus.ELIGIBLE,
            eligibleAt: new Date(),
            holdReason: null,
          },
        });
      } else {
        await tx.settlementLedger.create({
          data: {
            sellerOrgId: so.sellerOrgId,
            sellerOrderId: so.id,
            entryType: SettlementEntryType.ORDER_CREDIT,
            amountMinor: so.netSellerPayableMinor,
            balanceAfterMinor: so.netSellerPayableMinor,
            status: SettlementStatus.ELIGIBLE,
            eligibleAt: new Date(),
            description: `Reconciled COD remittance for package #${so.sellerOrderNumber}`,
          },
        });
      }
    }

    if (actorUserId) {
      await tx.auditEvent.create({
        data: {
          actorUserId,
          entityType: "CustomerOrder",
          entityId: orderId,
          action: "COD_RECONCILIATION",
          detailsJson: JSON.stringify({
            remittanceRef,
            amountMinor: order.totalMinor,
            currency: order.currency,
          }),
        },
      });
    }

    return updatedOrder;
  });
}
