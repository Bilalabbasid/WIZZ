import { prisma } from "@/lib/db";
import {
  SellerOrderStatus,
  ShipmentStatus,
  SettlementStatus,
  SettlementEntryType,
} from "@prisma/client";
import { cancelSellerSuborder } from "@/modules/orders/services";
import { assertSellerTransition, markSellerOrderDelivered, recomputeCustomerOrderStatus } from "@/modules/orders/lifecycle";
import { transitionReturnRequest } from "@/modules/returns/services";

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
      // Only this package's delivery details: no billing address, parent totals
      // (which would reveal other sellers' amounts), coupon or customer account id.
      customerOrder: {
        select: {
          id: true,
          orderNumber: true,
          customerEmail: true,
          customerPhone: true,
          shippingAddressJson: true,
          status: true,
          paymentStatus: true,
          currency: true,
          createdAt: true,
        },
      },
      items: {
        include: {
          variant: { include: { product: { select: { id: true, title: true, slug: true } } } },
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
 * Moves a seller package along its lifecycle (see modules/orders/lifecycle.ts):
 * CONFIRMED <-> PACKING, DISPATCHED -> DELIVERED, or cancel before dispatch.
 * DISPATCHED is set only by createSellerShipment.
 */
export async function updateSellerOrderStatus(
  sellerOrgId: string,
  sellerOrderId: string,
  status: SellerOrderStatus,
  actorUserId?: string,
  reason?: string
) {
  if (!Object.values(SellerOrderStatus).includes(status)) {
    throw new Error("VALIDATION: Unknown order status.");
  }
  const order = await getSellerOrderById(sellerOrgId, sellerOrderId);

  if (status === SellerOrderStatus.DISPATCHED) {
    throw new Error("VALIDATION: Add the courier and tracking number to dispatch this package.");
  }
  assertSellerTransition(order.status, status);

  if (status === SellerOrderStatus.CANCELLED) {
    const cleanReason = String(reason || "").trim();
    if (cleanReason.length < 3) throw new Error("VALIDATION: Tell the customer why this package is being cancelled.");
    await cancelSellerSuborder(sellerOrderId, `Cancelled by seller: ${cleanReason.slice(0, 300)}`, actorUserId);
    return prisma.sellerOrder.findUniqueOrThrow({ where: { id: sellerOrderId } });
  }

  return prisma.$transaction(async (tx) => {
    if (status === SellerOrderStatus.DELIVERED) {
      await markSellerOrderDelivered(tx, sellerOrderId, "Marked delivered by seller");
    } else {
      const flipped = await tx.sellerOrder.updateMany({
        where: { id: sellerOrderId, status: order.status },
        data: { status },
      });
      if (flipped.count === 0) throw new Error("VALIDATION: This package was updated by someone else. Refresh and try again.");
      await recomputeCustomerOrderStatus(tx, order.customerOrderId);
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

    return tx.sellerOrder.findUniqueOrThrow({ where: { id: sellerOrderId } });
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
  const carrierName = String(input.carrierName || "").trim();
  const trackingNumber = String(input.trackingNumber || "").trim();
  const trackingUrl = String(input.trackingUrl || "").trim();
  if (carrierName.length < 2 || carrierName.length > 60) throw new Error("VALIDATION: Choose the courier.");
  if (!/^[A-Za-z0-9-]{4,40}$/.test(trackingNumber)) {
    throw new Error("VALIDATION: Enter the courier's tracking number (4-40 letters, digits or dashes).");
  }
  if (trackingUrl && !/^https:\/\/[^\s]+$/i.test(trackingUrl)) {
    throw new Error("VALIDATION: The tracking link must start with https://");
  }

  const order = await getSellerOrderById(sellerOrgId, sellerOrderId);
  assertSellerTransition(order.status, SellerOrderStatus.DISPATCHED);

  return prisma.$transaction(async (tx) => {
    // Conditional flip: a double click cannot create two shipments
    const flipped = await tx.sellerOrder.updateMany({
      where: { id: sellerOrderId, status: { in: [SellerOrderStatus.CONFIRMED, SellerOrderStatus.PACKING] } },
      data: { status: SellerOrderStatus.DISPATCHED },
    });
    if (flipped.count === 0) throw new Error("VALIDATION: This package has already been dispatched or cancelled.");

    const shipment = await tx.shipment.create({
      data: {
        sellerOrderId,
        carrierName,
        trackingNumber,
        trackingUrl: trackingUrl || null,
        status: ShipmentStatus.IN_TRANSIT,
        shippedAt: new Date(),
        events: {
          create: {
            status: ShipmentStatus.IN_TRANSIT,
            note: `Handed to ${carrierName}. Tracking number ${trackingNumber}.`,
          },
        },
      },
    });

    // The COD collection record follows the real courier and tracking number
    await tx.codRemittanceRecord.updateMany({
      where: { sellerOrderId },
      data: { courierName: carrierName, trackingNumber },
    });

    await recomputeCustomerOrderStatus(tx, order.customerOrderId);

    if (actorUserId) {
      await tx.auditEvent.create({
        data: {
          actorUserId,
          entityType: "Shipment",
          entityId: shipment.id,
          action: "CREATE_SHIPMENT",
          detailsJson: JSON.stringify({ sellerOrderId, carrierName, trackingNumber, trackingUrl: trackingUrl || null }),
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
 * Seller reviews a return (approve / reject) or confirms the goods came back (restock).
 * Refunds are recorded by platform finance, not the seller.
 */
export async function resolveSellerReturn(
  sellerOrgId: string,
  returnRequestId: string,
  decision: "APPROVED" | "REJECTED" | "RECEIVED",
  inspectionResult?: string,
  actorUserId?: string
) {
  const action = decision === "APPROVED" ? "APPROVE" : decision === "REJECTED" ? "REJECT" : "MARK_RECEIVED";
  return transitionReturnRequest(returnRequestId, action, { sellerOrgId, note: inspectionResult, actorUserId });
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

  return prisma.$transaction(async (tx) => {
    // Serialize payouts per seller: lock the org row, then read the eligible balance
    await tx.$queryRaw`SELECT id FROM "SellerOrg" WHERE id = ${sellerOrgId} FOR UPDATE`;
    const ref = String(bankTransactionRef || "").trim();
    if (ref.length < 3 || ref.length > 120) {
      throw new Error("VALIDATION: Enter the bank transfer reference (3-120 characters).");
    }
    const duplicate = await tx.settlementLedger.findFirst({
      where: { sellerOrgId, entryType: SettlementEntryType.MANUAL_PAYOUT, referenceId: ref },
      select: { id: true },
    });
    if (duplicate) throw new Error("VALIDATION: A payout with this bank reference was already recorded for this seller.");
    const eligibleEntries = await tx.settlementLedger.findMany({
      where: { sellerOrgId, status: SettlementStatus.ELIGIBLE },
      orderBy: { amountMinor: "asc" }, // debits (negative) first so they net against credits
    });
    const totalEligibleMinor = eligibleEntries.reduce((sum, e) => sum + e.amountMinor, 0);
    if (payoutAmountMinor > totalEligibleMinor) {
      throw new Error(
        `VALIDATION: Requested payout PKR ${payoutAmountMinor / 100} exceeds the eligible balance PKR ${totalEligibleMinor / 100}.`
      );
    }

    // 1. Mark eligible entries as SETTLED up to payoutAmountMinor
    let remainingToSettle = payoutAmountMinor;
    for (const entry of eligibleEntries) {
      if (entry.amountMinor < 0) {
        // Debits (refunds) are netted into this payout
        await tx.settlementLedger.update({
          where: { id: entry.id },
          data: { status: SettlementStatus.SETTLED, settledAt: new Date() },
        });
        remainingToSettle -= entry.amountMinor;
        continue;
      }
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
    // Same lock as payouts: a reversal can only be recorded once
    await tx.$queryRaw`SELECT id FROM "SellerOrg" WHERE id = ${sellerOrgId} FOR UPDATE`;
    const alreadyReversed = await tx.settlementLedger.findFirst({
      where: { sellerOrgId, entryType: SettlementEntryType.ADJUSTMENT, referenceId: `REV_${payoutReferenceId}` },
      select: { id: true },
    });
    if (alreadyReversed) throw new Error("VALIDATION: This payout has already been marked as failed.");

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
      // Rate snapshotted on the order lines at checkout (rate changes never rewrite history)
      commissionRatePercent: o.items[0]?.commissionRatePercent ?? sellerOrg.commissionRatePercent,
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
