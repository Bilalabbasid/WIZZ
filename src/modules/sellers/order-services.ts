import { prisma } from "@/lib/db";
import {
  Prisma,
  PayoutRequestStatus,
  SellerOrderStatus,
  ShipmentStatus,
  SettlementStatus,
  SettlementEntryType,
} from "@prisma/client";
import { BANK_CHANGE_PAYOUT_HOLD_HOURS, maskStoredIban, payoutHoldUntil, storedIbanLast4 } from "./services";
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

/* ------------------------------------------------------------------ */
/* Seller balances                                                     */
/* ------------------------------------------------------------------ */

/** Prefix of the ADJUSTMENT credit that restores a failed (bounced) payout: "REV_<bank reference>". */
export const PAYOUT_REVERSAL_PREFIX = "REV_";

type Db = Prisma.TransactionClient | typeof prisma;

export interface SellerBalances {
  /** Ledger entries still PENDING (e.g. awaiting payment). */
  pendingMinor: number;
  /** Paid orders not yet delivered (IN_ESCROW). */
  inEscrowMinor: number;
  /** Entries on hold for a dispute or return (HELD). */
  heldMinor: number;
  /** Σ ELIGIBLE entries: delivered-order credits, refund debits, restored failed payouts. */
  eligibleMinor: number;
  /** Legacy: credits marked SETTLED by the retired direct-payout flow (no longer produced). */
  settledCreditsMinor: number;
  /** Σ |MANUAL_PAYOUT| debits not REVERSED: everything confirmed as transferred (gross, incl. bounced). */
  paidOutMinor: number;
  /** Σ "REV_" adjustment credits: bounced payouts returned to the balance (already inside eligibleMinor). */
  reversedPayoutsMinor: number;
  /** eligible + settledCredits − paidOut: what the platform owes the seller right now. */
  ledgerBalanceMinor: number;
  /** Σ PayoutRequests in REQUESTED: amounts waiting for the second finance admin to confirm. */
  reservedMinor: number;
  /** ledgerBalance − reserved: the most a new payout request may be for. Negative when refunds exceed credits. */
  availableMinor: number;
  payoutCount: number;
  openRequestCount: number;
}

/**
 * The single balance function used by the seller statement, the admin payout views and every
 * payout write (inside the write's transaction, after the SellerOrg row lock).
 *
 * Scheme (ledger rows are append-only; amountMinor is never updated after insert):
 *   ledgerBalance = Σ amountMinor of entries with status ELIGIBLE or SETTLED
 *                 = Σ ELIGIBLE (credits, refund debits, "REV_" restorations of failed payouts)
 *                 + Σ legacy SETTLED credits (from the retired split-and-settle payout flow)
 *                 + Σ MANUAL_PAYOUT debits (negative, status SETTLED; never REVERSED: a failed
 *                   transfer is undone by a separate ELIGIBLE "REV_" ADJUSTMENT credit)
 *   available     = ledgerBalance − Σ PayoutRequest.amountMinor in REQUESTED (reserved)
 * Credits stay ELIGIBLE after being paid; each confirmed payout reduces the figure exactly once
 * through its own debit row. PENDING / IN_ESCROW / HELD / REVERSED rows are never payable.
 */
export async function getSellerBalances(sellerOrgId: string, db: Db = prisma): Promise<SellerBalances> {
  const [groups, reversalAgg, reservedAgg] = await Promise.all([
    db.settlementLedger.groupBy({
      by: ["status", "entryType"],
      where: { sellerOrgId },
      _sum: { amountMinor: true },
      _count: { _all: true },
    }),
    db.settlementLedger.aggregate({
      where: {
        sellerOrgId,
        entryType: SettlementEntryType.ADJUSTMENT,
        status: SettlementStatus.ELIGIBLE,
        referenceId: { startsWith: PAYOUT_REVERSAL_PREFIX },
      },
      _sum: { amountMinor: true },
    }),
    db.payoutRequest.aggregate({
      where: { sellerOrgId, status: PayoutRequestStatus.REQUESTED },
      _sum: { amountMinor: true },
      _count: { _all: true },
    }),
  ]);

  let pendingMinor = 0;
  let inEscrowMinor = 0;
  let heldMinor = 0;
  let eligibleMinor = 0;
  let settledCreditsMinor = 0;
  let paidOutMinor = 0;
  let payoutCount = 0;
  for (const g of groups) {
    const sum = g._sum.amountMinor ?? 0;
    if (g.entryType === SettlementEntryType.MANUAL_PAYOUT) {
      if (g.status !== SettlementStatus.REVERSED) {
        paidOutMinor += -sum;
        payoutCount += g._count._all;
      }
      continue;
    }
    if (g.status === SettlementStatus.PENDING) pendingMinor += sum;
    else if (g.status === SettlementStatus.IN_ESCROW) inEscrowMinor += sum;
    else if (g.status === SettlementStatus.HELD) heldMinor += sum;
    else if (g.status === SettlementStatus.ELIGIBLE) eligibleMinor += sum;
    else if (g.status === SettlementStatus.SETTLED) settledCreditsMinor += sum;
  }
  const reservedMinor = reservedAgg._sum.amountMinor ?? 0;
  const ledgerBalanceMinor = eligibleMinor + settledCreditsMinor - paidOutMinor;
  return {
    pendingMinor,
    inEscrowMinor,
    heldMinor,
    eligibleMinor,
    settledCreditsMinor,
    paidOutMinor,
    reversedPayoutsMinor: reversalAgg._sum.amountMinor ?? 0,
    ledgerBalanceMinor,
    reservedMinor,
    availableMinor: ledgerBalanceMinor - reservedMinor,
    payoutCount,
    openRequestCount: reservedAgg._count._all,
  };
}

/* ------------------------------------------------------------------ */
/* Retired direct payouts (kept only for the legacy test suite)         */
/* ------------------------------------------------------------------ */

function assertLegacyPayoutsAllowed() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("FEATURE_DISABLED: Direct payouts are retired. Use the payout queue (request, then confirmation by a second finance admin).");
  }
}

/**
 * @deprecated Retired single-operator payout. No API route calls this any more: payouts go through
 * PayoutRequest (maker-checker) in modules/admin/finance.ts. Kept so the legacy business-rules
 * suite keeps running; refuses to run in production. Uses the same lock and balance function as
 * the new flow, never mutates existing ledger rows and stores only the last 4 IBAN digits.
 */
export async function processManualSellerSettlement(input: {
  sellerOrgId: string;
  payoutAmountMinor: number;
  bankTransactionRef: string;
  notes?: string;
  actorUserId: string;
}) {
  assertLegacyPayoutsAllowed();
  const { sellerOrgId, payoutAmountMinor, notes, actorUserId } = input;
  if (!Number.isInteger(payoutAmountMinor) || payoutAmountMinor <= 0) {
    throw new Error("VALIDATION: Payout amount must be a whole number of paisa greater than zero.");
  }
  const ref = String(input.bankTransactionRef || "").trim();
  if (ref.length < 3 || ref.length > 120) {
    throw new Error("VALIDATION: Enter the bank transfer reference (3-120 characters).");
  }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "SellerOrg" WHERE id = ${sellerOrgId} FOR UPDATE`;
    const sellerOrg = await tx.sellerOrg.findUnique({
      where: { id: sellerOrgId },
      select: { id: true, name: true, bankName: true, bankIban: true },
    });
    if (!sellerOrg) throw new Error("VALIDATION: Seller organization not found.");
    const duplicate = await tx.settlementLedger.findFirst({
      where: { sellerOrgId, entryType: SettlementEntryType.MANUAL_PAYOUT, referenceId: ref },
      select: { id: true },
    });
    if (duplicate) throw new Error("VALIDATION: A payout with this bank reference was already recorded for this seller.");

    const balances = await getSellerBalances(sellerOrgId, tx);
    if (payoutAmountMinor > balances.availableMinor) {
      throw new Error(
        `VALIDATION: Requested payout PKR ${payoutAmountMinor / 100} exceeds the eligible balance PKR ${balances.availableMinor / 100}.`
      );
    }
    const ibanLast4 = storedIbanLast4(sellerOrg.bankIban);
    const payoutLedger = await tx.settlementLedger.create({
      data: {
        sellerOrgId,
        entryType: SettlementEntryType.MANUAL_PAYOUT,
        amountMinor: -payoutAmountMinor,
        balanceAfterMinor: balances.ledgerBalanceMinor - payoutAmountMinor,
        status: SettlementStatus.SETTLED,
        description: `Manual bank remittance to ${sellerOrg.bankName || "account"}${ibanLast4 ? ` •••• ${ibanLast4}` : ""}: ${ref}${notes ? ` (${notes})` : ""}`,
        referenceId: ref,
        actorUserId,
        settledAt: new Date(),
      },
    });
    await tx.auditEvent.create({
      data: {
        actorUserId,
        entityType: "SettlementLedger",
        entityId: payoutLedger.id,
        action: "MANUAL_PAYOUT_EXECUTED",
        detailsJson: JSON.stringify({
          sellerOrgId,
          payoutAmountMinor,
          bankTransactionRef: ref,
          remainingAvailableMinor: balances.availableMinor - payoutAmountMinor,
          recipientBank: sellerOrg.bankName,
          recipientIbanLast4: ibanLast4,
        }),
      },
    });
    return {
      payoutId: payoutLedger.id,
      sellerOrgId,
      payoutAmountMinor,
      bankTransactionRef: ref,
      remainingEligibleBalanceMinor: balances.availableMinor - payoutAmountMinor,
    };
  });
}

/**
 * @deprecated Retired with processManualSellerSettlement. Payouts made through the payout queue
 * are marked failed with markPayoutRequestFailed (modules/admin/finance.ts); this refuses them.
 */
export async function recordFailedPayoutAdjustment(input: {
  sellerOrgId: string;
  payoutReferenceId: string;
  failureReason: string;
  actorUserId: string;
}) {
  assertLegacyPayoutsAllowed();
  const { sellerOrgId, payoutReferenceId, failureReason, actorUserId } = input;

  return prisma.$transaction(async (tx) => {
    // Same lock as payouts: a reversal can only be recorded once
    await tx.$queryRaw`SELECT id FROM "SellerOrg" WHERE id = ${sellerOrgId} FOR UPDATE`;
    const payoutEntry = await tx.settlementLedger.findFirst({
      where: { sellerOrgId, entryType: SettlementEntryType.MANUAL_PAYOUT, referenceId: payoutReferenceId },
    });
    if (!payoutEntry) throw new Error(`VALIDATION: Payout transaction with reference "${payoutReferenceId}" not found.`);
    const linkedRequest = await tx.payoutRequest.findFirst({ where: { ledgerEntryId: payoutEntry.id }, select: { id: true } });
    if (linkedRequest) throw new Error("VALIDATION: This payout belongs to the payout queue; mark it failed there.");
    const alreadyReversed = await tx.settlementLedger.findFirst({
      where: { sellerOrgId, entryType: SettlementEntryType.ADJUSTMENT, referenceId: `${PAYOUT_REVERSAL_PREFIX}${payoutReferenceId}` },
      select: { id: true },
    });
    if (alreadyReversed) throw new Error("VALIDATION: This payout has already been marked as failed.");

    const restoredAmount = Math.abs(payoutEntry.amountMinor);
    const balances = await getSellerBalances(sellerOrgId, tx);
    const adjustmentLedger = await tx.settlementLedger.create({
      data: {
        sellerOrgId,
        entryType: SettlementEntryType.ADJUSTMENT,
        amountMinor: restoredAmount,
        balanceAfterMinor: balances.ledgerBalanceMinor + restoredAmount,
        status: SettlementStatus.ELIGIBLE,
        description: `Compensating adjustment for bounced/failed payout ${payoutReferenceId}: ${failureReason}`,
        referenceId: `${PAYOUT_REVERSAL_PREFIX}${payoutReferenceId}`,
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
        detailsJson: JSON.stringify({ sellerOrgId, payoutReferenceId, restoredAmountMinor: restoredAmount, failureReason }),
      },
    });

    return adjustmentLedger;
  });
}

/* ------------------------------------------------------------------ */
/* Seller statement                                                    */
/* ------------------------------------------------------------------ */

/** Payout as shown to the seller: no internal notes, operator names or rejected requests. */
export interface SellerPayoutHistoryRow {
  id: string;
  amountMinor: number;
  status: "PROCESSING" | "PAID" | "FAILED";
  requestedAt: Date;
  paidAt: Date | null;
  reference: string | null;
  bankIbanLast4: string | null;
}

/**
 * Commission and settlement statement for a seller organization (seller portal). Balance figures
 * come from getSellerBalances, the same function the admin payout views and payout writes use.
 * The bank account is masked; the full IBAN is never part of the statement.
 */
export async function getSellerSettlementStatement(sellerOrgId: string) {
  const sellerOrg = await prisma.sellerOrg.findUnique({
    where: { id: sellerOrgId },
    select: {
      id: true,
      name: true,
      legalName: true,
      commissionRatePercent: true,
      bankName: true,
      bankAccountTitle: true,
      bankIban: true,
      bankDetailsChangedAt: true,
    },
  });

  if (!sellerOrg) {
    throw new Error("Seller organization not found.");
  }

  const [orders, dbLedgerEntries, balances, payoutRequests, ledgerPayouts] = await Promise.all([
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
      take: 200,
      select: {
        id: true,
        sellerOrderId: true,
        entryType: true,
        amountMinor: true,
        status: true,
        description: true,
        referenceId: true,
        holdReason: true,
        eligibleAt: true,
        settledAt: true,
        createdAt: true,
      },
    }),
    getSellerBalances(sellerOrgId),
    prisma.payoutRequest.findMany({
      where: { sellerOrgId, status: { not: PayoutRequestStatus.REJECTED } },
      orderBy: { requestedAt: "desc" },
      take: 50,
      select: { id: true, amountMinor: true, status: true, requestedAt: true, decidedAt: true, bankReference: true, bankIbanLast4: true, ledgerEntryId: true },
    }),
    prisma.settlementLedger.findMany({
      where: { sellerOrgId, entryType: SettlementEntryType.MANUAL_PAYOUT },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, amountMinor: true, referenceId: true, settledAt: true, createdAt: true },
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

  // Payout history: queue payouts plus legacy direct payouts that have no request
  const linkedLedgerIds = new Set(payoutRequests.map((r) => r.ledgerEntryId).filter((v): v is string => Boolean(v)));
  const legacyOnly = ledgerPayouts.filter((p) => !linkedLedgerIds.has(p.id));
  const legacyRefs = legacyOnly.map((p) => p.referenceId).filter((v): v is string => Boolean(v));
  const legacyReversals = legacyRefs.length
    ? await prisma.settlementLedger.findMany({
        where: {
          sellerOrgId,
          entryType: SettlementEntryType.ADJUSTMENT,
          referenceId: { in: legacyRefs.map((r) => `${PAYOUT_REVERSAL_PREFIX}${r}`) },
        },
        select: { referenceId: true },
      })
    : [];
  const reversedLegacy = new Set(legacyReversals.map((r) => (r.referenceId ?? "").slice(PAYOUT_REVERSAL_PREFIX.length)));
  const payouts: SellerPayoutHistoryRow[] = [
    ...payoutRequests.map((r): SellerPayoutHistoryRow => ({
      id: r.id,
      amountMinor: r.amountMinor,
      status: r.status === PayoutRequestStatus.APPROVED_PAID ? "PAID" : r.status === PayoutRequestStatus.FAILED ? "FAILED" : "PROCESSING",
      requestedAt: r.requestedAt,
      paidAt: r.status === PayoutRequestStatus.REQUESTED ? null : r.decidedAt,
      reference: r.status === PayoutRequestStatus.REQUESTED ? null : r.bankReference,
      bankIbanLast4: r.bankIbanLast4,
    })),
    ...legacyOnly.map((p): SellerPayoutHistoryRow => ({
      id: p.id,
      amountMinor: Math.abs(p.amountMinor),
      status: p.referenceId && reversedLegacy.has(p.referenceId) ? "FAILED" : "PAID",
      requestedAt: p.createdAt,
      paidAt: p.settledAt ?? p.createdAt,
      reference: p.referenceId,
      bankIbanLast4: null,
    })),
  ].sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());

  return {
    sellerOrg: {
      id: sellerOrg.id,
      name: sellerOrg.name,
      legalName: sellerOrg.legalName,
      commissionRatePercent: sellerOrg.commissionRatePercent,
      bankName: sellerOrg.bankName,
      bankAccountTitle: sellerOrg.bankAccountTitle,
      bankIban: maskStoredIban(sellerOrg.bankIban),
      bankIbanLast4: storedIbanLast4(sellerOrg.bankIban),
      bankDetailsChangedAt: sellerOrg.bankDetailsChangedAt,
      payoutHoldUntil: payoutHoldUntil(sellerOrg.bankDetailsChangedAt),
      payoutHoldHours: BANK_CHANGE_PAYOUT_HOLD_HOURS,
    },
    balances,
    summary: {
      totalGrossGmvMinor,
      totalPlatformCommissionMinor,
      totalShippingMinor,
      totalNetPayableMinor,
      /** Net transferred: confirmed payouts minus bounced ones. */
      settledPaidMinor: balances.paidOutMinor - balances.reversedPayoutsMinor,
      pendingEscrowMinor: balances.pendingMinor + balances.inEscrowMinor,
      /** Same figure finance can request a payout for (available = ledger balance − reserved). */
      eligibleForPayoutMinor: balances.availableMinor,
      heldDisputeMinor: balances.heldMinor,
      availablePayoutBalanceMinor: Math.max(0, balances.availableMinor),
      orderCount: orders.length,
    },
    ledgers: orderLedgers,
    ledgerEntries: dbLedgerEntries,
    payouts,
  };
}
