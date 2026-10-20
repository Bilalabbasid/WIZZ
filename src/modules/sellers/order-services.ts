import { prisma } from "@/lib/db";
import {
  SellerOrderStatus,
  ShipmentStatus,
  ReturnStatus,
  CustomerOrderStatus,
  InventoryAdjustmentReason,
  RefundStatus,
  SettlementStatus,
  SettlementEntryType,
} from "@prisma/client";
import { SITE_CONFIG } from "@/lib/config";

/**
 * Lists seller-specific orders strictly belonging to a seller organization.
 */
export async function getSellerOrders(
  sellerOrgId: string,
  options: {
    status?: SellerOrderStatus;
    page?: number;
    limit?: number;
  } = {}
) {
  const { status, page = 1, limit = 20 } = options;
  const where: Record<string, unknown> = {
    sellerOrgId,
  };

  if (status) {
    where.status = status;
  }

  const [orders, total] = await Promise.all([
    prisma.sellerOrder.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        customerOrder: {
          select: {
            orderNumber: true,
            customerEmail: true,
            customerPhone: true,
            shippingAddressJson: true,
            paymentStatus: true,
            currency: true,
          },
        },
        items: true,
        shipments: {
          include: { events: { orderBy: { eventTimestamp: "desc" } } },
        },
        returnRequests: true,
      },
    }),
    prisma.sellerOrder.count({ where }),
  ]);

  return { orders, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/**
 * Retrieves a single seller order strictly scoped to the seller organization.
 */
export async function getSellerOrderById(sellerOrgId: string, sellerOrderId: string) {
  const order = await prisma.sellerOrder.findUnique({
    where: { id: sellerOrderId },
    include: {
      customerOrder: true,
      items: {
        include: {
          variant: { include: { product: true } },
        },
      },
      shipments: {
        include: { events: { orderBy: { eventTimestamp: "desc" } } },
      },
      returnRequests: {
        include: { items: { include: { orderItem: true } } },
      },
      settlementLedgers: true,
    },
  });

  if (!order || order.sellerOrgId !== sellerOrgId) {
    throw new Error(`FORBIDDEN: Seller order ${sellerOrderId} not found or does not belong to your organization.`);
  }

  return order;
}

/**
 * Updates packing and fulfillment status of a seller order.
 * If order is marked DELIVERED and paid, transitions escrow holds to ELIGIBLE.
 */
export async function updateSellerOrderStatus(
  sellerOrgId: string,
  sellerOrderId: string,
  status: SellerOrderStatus,
  actorUserId?: string
) {
  const order = await getSellerOrderById(sellerOrgId, sellerOrderId);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.sellerOrder.update({
      where: { id: sellerOrderId },
      data: { status },
    });

    // When order is DELIVERED and paid, transition settlement escrow to ELIGIBLE
    if (status === SellerOrderStatus.DELIVERED && order.customerOrder.paymentStatus === "PAID") {
      const existingLedger = await tx.settlementLedger.findFirst({
        where: { sellerOrderId, entryType: SettlementEntryType.ORDER_CREDIT },
      });

      if (existingLedger) {
        await tx.settlementLedger.update({
          where: { id: existingLedger.id },
          data: {
            status: SettlementStatus.ELIGIBLE,
            eligibleAt: new Date(),
          },
        });
      } else {
        await tx.settlementLedger.create({
          data: {
            sellerOrgId,
            sellerOrderId,
            entryType: SettlementEntryType.ORDER_CREDIT,
            amountMinor: order.netSellerPayableMinor,
            balanceAfterMinor: order.netSellerPayableMinor,
            status: SettlementStatus.ELIGIBLE,
            eligibleAt: new Date(),
            description: `Settlement credit for delivered package #${order.sellerOrderNumber}`,
          },
        });
      }
    }

    if (actorUserId) {
      await tx.auditEvent.create({
        data: {
          actorUserId,
          entityType: "SellerOrder",
          entityId: sellerOrderId,
          action: "UPDATE_STATUS",
          detailsJson: JSON.stringify({ sellerOrgId, fromStatus: order.status, toStatus: status }),
        },
      });
    }

    return updated;
  });
}

/**
 * Dispatches a shipment with carrier and tracking number.
 * Updates the seller order to DISPATCHED.
 */
export async function createSellerShipment(
  sellerOrgId: string,
  sellerOrderId: string,
  input: {
    carrierName: string;
    trackingNumber: string;
    trackingUrl?: string;
  },
  actorUserId?: string
) {
  await getSellerOrderById(sellerOrgId, sellerOrderId);

  return prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.create({
      data: {
        sellerOrderId,
        carrierName: input.carrierName,
        trackingNumber: input.trackingNumber,
        trackingUrl: input.trackingUrl || null,
        status: ShipmentStatus.LABEL_CREATED,
        shippedAt: new Date(),
        events: {
          create: {
            status: ShipmentStatus.LABEL_CREATED,
            note: `Waybill created for ${input.carrierName}. Tracking #: ${input.trackingNumber}`,
          },
        },
      },
    });

    // Update seller order
    await tx.sellerOrder.update({
      where: { id: sellerOrderId },
      data: { status: SellerOrderStatus.DISPATCHED },
    });

    // Update customer order status
    const so = await tx.sellerOrder.findUnique({
      where: { id: sellerOrderId },
      select: { customerOrderId: true },
    });

    if (so) {
      await tx.customerOrder.update({
        where: { id: so.customerOrderId },
        data: { status: CustomerOrderStatus.SHIPPED },
      });
    }

    if (actorUserId) {
      await tx.auditEvent.create({
        data: {
          actorUserId,
          entityType: "Shipment",
          entityId: shipment.id,
          action: "CREATE_SHIPMENT",
          detailsJson: JSON.stringify({ sellerOrderId, ...input }),
        },
      });
    }

    return shipment;
  });
}

/**
 * Retrieves all returns filed against orders belonging to a seller organization.
 */
export async function getSellerReturns(sellerOrgId: string) {
  return prisma.returnRequest.findMany({
    where: {
      sellerOrder: { sellerOrgId },
    },
    orderBy: { createdAt: "desc" },
    include: {
      sellerOrder: {
        select: {
          sellerOrderNumber: true,
          customerOrder: { select: { orderNumber: true, customerEmail: true } },
        },
      },
      items: {
        include: { orderItem: true },
      },
    },
  });
}

/**
 * Resolves a return request: approves or rejects, executes restocking, and updates financial ledgers.
 */
export async function resolveSellerReturn(
  sellerOrgId: string,
  returnRequestId: string,
  decision: "APPROVED" | "REJECTED",
  inspectionResult?: string,
  actorUserId?: string
) {
  const returnReq = await prisma.returnRequest.findUnique({
    where: { id: returnRequestId },
    include: {
      sellerOrder: true,
      items: { include: { orderItem: true } },
    },
  });

  if (!returnReq || returnReq.sellerOrder.sellerOrgId !== sellerOrgId) {
    throw new Error("FORBIDDEN: Return request does not belong to your seller organization.");
  }

  const toStatus = decision === "APPROVED" ? ReturnStatus.APPROVED : ReturnStatus.REJECTED;

  return prisma.$transaction(async (tx) => {
    // 1. Update inspection notes
    if (inspectionResult) {
      for (const it of returnReq.items) {
        await tx.returnItem.update({
          where: { id: it.id },
          data: { inspectionResult },
        });
      }
    }

    // 2. If approved, restock inventory, generate refund, and adjust seller payable & commission
    if (decision === "APPROVED") {
      let refundAmountMinor = 0;
      let totalCommissionReversedMinor = 0;

      for (const item of returnReq.items) {
        const itemQuantity = item.quantity;
        const totalPurchasedQty = item.orderItem.quantity || 1;
        const discountShare = Math.round((item.orderItem.discountMinor * itemQuantity) / totalPurchasedQty);
        const lineRefund = (item.orderItem.unitPriceMinor * itemQuantity) - discountShare;
        refundAmountMinor += lineRefund;

        const commissionReversal = Math.round((lineRefund * item.orderItem.commissionRatePercent) / 100);
        totalCommissionReversedMinor += commissionReversal;

        if (item.orderItem.variantId) {
          await tx.inventoryLevel.update({
            where: { variantId: item.orderItem.variantId },
            data: { availableUnits: { increment: itemQuantity } },
          });

          await tx.inventoryAdjustment.create({
            data: {
              variantId: item.orderItem.variantId,
              sellerOrgId,
              actorUserId,
              deltaUnits: itemQuantity,
              balanceAfter: 0,
              reasonCode: InventoryAdjustmentReason.RETURN_RESTOCK,
              notes: `Merchant approved return #${returnRequestId}. ${inspectionResult || ""}`,
            },
          });
        }
      }

      const totalSellerDebit = refundAmountMinor - totalCommissionReversedMinor;

      // Customer Refund record
      await tx.refund.create({
        data: {
          customerOrderId: returnReq.sellerOrder.customerOrderId,
          sellerOrderId: returnReq.sellerOrderId,
          amountMinor: refundAmountMinor,
          currency: SITE_CONFIG.defaultCurrency,
          status: RefundStatus.SUCCEEDED,
          reason: `Seller approved return #${returnRequestId}`,
          externalRefundRef: `RET_REF_${Date.now()}`,
        },
      });

      // Update seller order net payable and commission snapshots
      await tx.sellerOrder.update({
        where: { id: returnReq.sellerOrderId },
        data: {
          netSellerPayableMinor: { decrement: totalSellerDebit },
          platformCommissionMinor: { decrement: totalCommissionReversedMinor },
        },
      });

      // Financial double-entry adjustments
      await tx.settlementLedger.create({
        data: {
          sellerOrgId,
          sellerOrderId: returnReq.sellerOrderId,
          entryType: SettlementEntryType.REFUND_DEBIT,
          amountMinor: -totalSellerDebit,
          balanceAfterMinor: 0,
          status: SettlementStatus.SETTLED,
          description: `Debit adjustment for return #${returnRequestId}`,
          referenceId: `RET_REF_${returnRequestId}`,
          actorUserId,
        },
      });

      await tx.settlementLedger.create({
        data: {
          sellerOrgId,
          sellerOrderId: returnReq.sellerOrderId,
          entryType: SettlementEntryType.COMMISSION_REVERSAL_CREDIT,
          amountMinor: totalCommissionReversedMinor,
          balanceAfterMinor: 0,
          status: SettlementStatus.SETTLED,
          description: `Platform commission credit for return #${returnRequestId}`,
          referenceId: `RET_COMM_${returnRequestId}`,
          actorUserId,
        },
      });
    }

    const updated = await tx.returnRequest.update({
      where: { id: returnRequestId },
      data: {
        status: toStatus,
        resolvedAt: new Date(),
        returnShippingLabelUrl: decision === "APPROVED" ? `/shipping/labels/return-${returnRequestId}.pdf` : null,
      },
    });

    if (actorUserId) {
      await tx.auditEvent.create({
        data: {
          actorUserId,
          entityType: "ReturnRequest",
          entityId: returnRequestId,
          action: `RETURN_${decision}`,
          detailsJson: JSON.stringify({ inspectionResult }),
        },
      });
    }

    return updated;
  });
}

/**
 * Places an escrow hold on a seller order settlement (e.g., active return request, dispute, fraud check).
 */
export async function holdSellerSettlement(
  sellerOrderId: string,
  reason: string,
  actorUserId?: string
) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.settlementLedger.updateMany({
      where: { sellerOrderId, status: { in: [SettlementStatus.IN_ESCROW, SettlementStatus.ELIGIBLE] } },
      data: {
        status: SettlementStatus.HELD,
        holdReason: reason,
      },
    });

    if (actorUserId) {
      await tx.auditEvent.create({
        data: {
          actorUserId,
          entityType: "SellerOrder",
          entityId: sellerOrderId,
          action: "SETTLEMENT_HOLD_PLACED",
          detailsJson: JSON.stringify({ reason }),
        },
      });
    }

    return updated;
  });
}

/**
 * Releases an escrow hold on a seller order settlement once dispute is resolved.
 */
export async function releaseSellerSettlementHold(
  sellerOrderId: string,
  actorUserId?: string
) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.settlementLedger.updateMany({
      where: { sellerOrderId, status: SettlementStatus.HELD },
      data: {
        status: SettlementStatus.ELIGIBLE,
        holdReason: null,
        eligibleAt: new Date(),
      },
    });

    if (actorUserId) {
      await tx.auditEvent.create({
        data: {
          actorUserId,
          entityType: "SellerOrder",
          entityId: sellerOrderId,
          action: "SETTLEMENT_HOLD_RELEASED",
          detailsJson: JSON.stringify({ sellerOrderId }),
        },
      });
    }

    return updated;
  });
}

/**
 * Auditable manual settlement payout workflow.
 * Automated bank transfers are strictly disabled unless provider is explicitly configured.
 * Checks eligible balance, creates payout ledger entry, and logs financial audit event.
 */
export async function processManualSellerSettlement(input: {
  sellerOrgId: string;
  payoutAmountMinor: number;
  bankTransactionRef: string;
  notes?: string;
  actorUserId: string;
}) {
  const { sellerOrgId, payoutAmountMinor, bankTransactionRef, notes, actorUserId } = input;

  if (payoutAmountMinor <= 0) {
    throw new Error("Payout amount must be greater than zero.");
  }

  const sellerOrg = await prisma.sellerOrg.findUnique({
    where: { id: sellerOrgId },
  });

  if (!sellerOrg) {
    throw new Error("Seller organization not found.");
  }

  // Calculate current eligible net balance for payout:
  const eligibleEntries = await prisma.settlementLedger.findMany({
    where: { sellerOrgId, status: SettlementStatus.ELIGIBLE },
  });

  const totalEligibleMinor = eligibleEntries.reduce((sum, e) => sum + e.amountMinor, 0);

  if (payoutAmountMinor > totalEligibleMinor) {
    throw new Error(
      `INSUFFICIENT_SETTLED_FUNDS: Requested payout PKR ${payoutAmountMinor / 100} exceeds eligible balance PKR ${totalEligibleMinor / 100}.`
    );
  }

  return prisma.$transaction(async (tx) => {
    // 1. Mark eligible entries as SETTLED up to payoutAmountMinor
    let remainingToSettle = payoutAmountMinor;
    for (const entry of eligibleEntries) {
      if (remainingToSettle <= 0) break;
      if (entry.amountMinor <= remainingToSettle) {
        await tx.settlementLedger.update({
          where: { id: entry.id },
          data: { status: SettlementStatus.SETTLED, settledAt: new Date() },
        });
        remainingToSettle -= entry.amountMinor;
      } else {
        await tx.settlementLedger.update({
          where: { id: entry.id },
          data: { amountMinor: entry.amountMinor - remainingToSettle },
        });
        await tx.settlementLedger.create({
          data: {
            sellerOrgId,
            sellerOrderId: entry.sellerOrderId,
            entryType: entry.entryType,
            amountMinor: remainingToSettle,
            balanceAfterMinor: 0,
            status: SettlementStatus.SETTLED,
            description: entry.description,
            settledAt: new Date(),
          },
        });
        remainingToSettle = 0;
      }
    }

    // 2. Record debit payout transaction
    const payoutLedger = await tx.settlementLedger.create({
      data: {
        sellerOrgId,
        entryType: SettlementEntryType.MANUAL_PAYOUT,
        amountMinor: -payoutAmountMinor,
        balanceAfterMinor: totalEligibleMinor - payoutAmountMinor,
        status: SettlementStatus.SETTLED,
        description: `Manual bank remittance to ${sellerOrg.bankName || "Account"}: ${bankTransactionRef}${notes ? ` (${notes})` : ""}`,
        referenceId: bankTransactionRef,
        actorUserId,
        settledAt: new Date(),
      },
    });

    // 3. Create immutable financial audit event
    await tx.auditEvent.create({
      data: {
        actorUserId,
        entityType: "SettlementLedger",
        entityId: payoutLedger.id,
        action: "MANUAL_PAYOUT_EXECUTED",
        detailsJson: JSON.stringify({
          sellerOrgId,
          sellerName: sellerOrg.name,
          payoutAmountMinor,
          bankTransactionRef,
          remainingEligibleBalanceMinor: totalEligibleMinor - payoutAmountMinor,
          recipientBank: sellerOrg.bankName,
          recipientAccountTitle: sellerOrg.bankAccountTitle,
          recipientIban: sellerOrg.bankIban,
        }),
      },
    });

    return {
      payoutId: payoutLedger.id,
      sellerOrgId,
      payoutAmountMinor,
      bankTransactionRef,
      remainingEligibleBalanceMinor: totalEligibleMinor - payoutAmountMinor,
    };
  });
}

/**
 * Reverses a failed or bounced manual bank payout with compensating adjustment.
 */
export async function recordFailedPayoutAdjustment(input: {
  sellerOrgId: string;
  payoutReferenceId: string;
  failureReason: string;
  actorUserId: string;
}) {
  const { sellerOrgId, payoutReferenceId, failureReason, actorUserId } = input;

  const payoutEntry = await prisma.settlementLedger.findFirst({
    where: {
      sellerOrgId,
      entryType: SettlementEntryType.MANUAL_PAYOUT,
      referenceId: payoutReferenceId,
    },
  });

  if (!payoutEntry) {
    throw new Error(`Payout transaction with reference "${payoutReferenceId}" not found.`);
  }

  const restoredAmount = Math.abs(payoutEntry.amountMinor);

  return prisma.$transaction(async (tx) => {
    const adjustmentLedger = await tx.settlementLedger.create({
      data: {
        sellerOrgId,
        entryType: SettlementEntryType.ADJUSTMENT,
        amountMinor: restoredAmount,
        balanceAfterMinor: restoredAmount,
        status: SettlementStatus.ELIGIBLE,
        description: `Compensating adjustment for bounced/failed payout ${payoutReferenceId}: ${failureReason}`,
        referenceId: `REV_${payoutReferenceId}`,
        actorUserId,
        eligibleAt: new Date(),
      },
    });

    await tx.auditEvent.create({
      data: {
        actorUserId,
        entityType: "SettlementLedger",
        entityId: adjustmentLedger.id,
        action: "PAYOUT_REVERSAL_ADJUSTMENT",
        detailsJson: JSON.stringify({
          sellerOrgId,
          payoutReferenceId,
          restoredAmountMinor: restoredAmount,
          failureReason,
        }),
      },
    });

    return adjustmentLedger;
  });
}

/**
 * Generates a full commission and settlement ledger statement for a seller organization.
 */
export async function getSellerSettlementStatement(sellerOrgId: string) {
  const sellerOrg = await prisma.sellerOrg.findUnique({
    where: { id: sellerOrgId },
  });

  if (!sellerOrg) {
    throw new Error("Seller organization not found.");
  }

  const [orders, dbLedgerEntries] = await Promise.all([
    prisma.sellerOrder.findMany({
      where: { sellerOrgId },
      orderBy: { createdAt: "desc" },
      include: {
        customerOrder: {
          select: {
            orderNumber: true,
            paymentStatus: true,
            createdAt: true,
          },
        },
        items: true,
      },
    }),
    prisma.settlementLedger.findMany({
      where: { sellerOrgId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  let totalGrossGmvMinor = 0;
  let totalPlatformCommissionMinor = 0;
  let totalShippingMinor = 0;
  let totalNetPayableMinor = 0;

  const orderLedgers = orders.map((o) => {
    const isCancelled = o.status === SellerOrderStatus.CANCELLED;
    const isDelivered = o.status === SellerOrderStatus.DELIVERED;
    const isPaid = o.customerOrder.paymentStatus === "PAID";

    if (!isCancelled) {
      totalGrossGmvMinor += o.totalMinor;
      totalPlatformCommissionMinor += o.platformCommissionMinor;
      totalShippingMinor += o.shippingMinor;
      totalNetPayableMinor += o.netSellerPayableMinor;
    }

    // Settlement state per order:
    const settlementStatus = isCancelled
      ? "CANCELLED"
      : isDelivered && isPaid
      ? "ELIGIBLE_FOR_PAYOUT"
      : "IN_ESCROW_HOLD";

    return {
      sellerOrderId: o.id,
      sellerOrderNumber: o.sellerOrderNumber,
      customerOrderNumber: o.customerOrder.orderNumber,
      orderStatus: o.status,
      paymentStatus: o.customerOrder.paymentStatus,
      subtotalMinor: o.subtotalMinor,
      shippingMinor: o.shippingMinor,
      totalMinor: o.totalMinor,
      commissionRatePercent: sellerOrg.commissionRatePercent,
      platformCommissionMinor: o.platformCommissionMinor,
      netSellerPayableMinor: o.netSellerPayableMinor,
      settlementStatus,
      createdAt: o.createdAt,
    };
  });

  // Calculate ledger financial metrics
  let eligibleForPayoutMinor = 0;
  let inEscrowHoldMinor = 0;
  let heldDisputeMinor = 0;
  let settledPaidMinor = 0;

  for (const entry of dbLedgerEntries) {
    if (entry.status === SettlementStatus.ELIGIBLE) {
      eligibleForPayoutMinor += entry.amountMinor;
    } else if (entry.status === SettlementStatus.IN_ESCROW) {
      inEscrowHoldMinor += entry.amountMinor;
    } else if (entry.status === SettlementStatus.HELD) {
      heldDisputeMinor += entry.amountMinor;
    } else if (entry.entryType === SettlementEntryType.MANUAL_PAYOUT && entry.status === SettlementStatus.SETTLED) {
      settledPaidMinor += Math.abs(entry.amountMinor);
    }
  }

  // Fallback to order-level calculations if DB entries not yet materialized
  if (dbLedgerEntries.length === 0) {
    inEscrowHoldMinor = totalNetPayableMinor;
  }

  return {
    sellerOrg: {
      id: sellerOrg.id,
      name: sellerOrg.name,
      legalName: sellerOrg.legalName,
      commissionRatePercent: sellerOrg.commissionRatePercent,
      bankName: sellerOrg.bankName,
      bankAccountTitle: sellerOrg.bankAccountTitle,
      bankIban: sellerOrg.bankIban,
    },
    summary: {
      totalGrossGmvMinor,
      totalPlatformCommissionMinor,
      totalShippingMinor,
      totalNetPayableMinor,
      settledPaidMinor,
      pendingEscrowMinor: inEscrowHoldMinor,
      eligibleForPayoutMinor,
      heldDisputeMinor,
      availablePayoutBalanceMinor: Math.max(0, eligibleForPayoutMinor),
      orderCount: orders.length,
    },
    ledgers: orderLedgers,
    ledgerEntries: dbLedgerEntries,
  };
}
