/**
 * Customer returns.
 *
 *   SUBMITTED --approve--> APPROVED --mark received (restock)--> RECEIVED --record refund--> REFUNDED
 *   SUBMITTED --reject--> REJECTED
 *
 * Every transition is a conditional update on the current status inside a transaction, so a
 * repeated or concurrent request cannot restock or refund twice. Refunds are never simulated:
 * finance records the refund with the reference of the transfer they actually made.
 */
import { prisma } from "@/lib/db";
import {
  ReturnStatus,
  RefundStatus,
  InventoryAdjustmentReason,
  SellerOrderStatus,
  SettlementStatus,
  SettlementEntryType,
} from "@prisma/client";
import { SITE_CONFIG } from "@/lib/config";
import { deliveredAtOf, lineRefundMinor, notifySellerMembers } from "@/modules/orders/lifecycle";
import { getCommerceSettings } from "@/lib/commerce-settings";

export const RETURN_REASON_CODES = ["DEFECTIVE", "NOT_AS_DESCRIBED", "WRONG_ITEM", "UNWANTED"] as const;
export type ReturnReasonCode = (typeof RETURN_REASON_CODES)[number];

export type ReturnAction = "APPROVE" | "REJECT" | "MARK_RECEIVED" | "RECORD_REFUND";

const OPEN_RETURN_STATUSES: ReturnStatus[] = [
  ReturnStatus.SUBMITTED,
  ReturnStatus.APPROVED,
  ReturnStatus.RECEIVED,
  ReturnStatus.REFUNDED,
];

/**
 * Customer files a return for one order line. The package must be delivered, within the
 * return window, and the quantity must fit what was bought minus earlier open returns.
 */
export async function createReturnRequest(
  sellerOrderId: string,
  customerUserId: string,
  orderItemId: string,
  quantity: number,
  reasonCode: string,
  explanation: string,
  customerOrderId?: string
) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("VALIDATION: Return quantity must be a whole number of at least 1.");
  }
  if (!RETURN_REASON_CODES.includes(reasonCode as ReturnReasonCode)) {
    throw new Error("VALIDATION: Choose a return reason.");
  }
  const cleanExplanation = String(explanation || "").trim().slice(0, 1000);
  const { returnWindowDays } = await getCommerceSettings();

  return prisma.$transaction(async (tx) => {
    const sellerOrder = await tx.sellerOrder.findUnique({
      where: { id: sellerOrderId },
      include: {
        customerOrder: { select: { id: true, customerUserId: true } },
        items: { where: { id: orderItemId } },
        shipments: { select: { deliveredAt: true } },
      },
    });

    if (!sellerOrder || (customerOrderId && sellerOrder.customerOrderId !== customerOrderId)) {
      throw new Error("Order not found.");
    }
    if (sellerOrder.customerOrder.customerUserId !== customerUserId) {
      throw new Error("FORBIDDEN: You can only return items from your own orders.");
    }
    const item = sellerOrder.items[0];
    if (!item) throw new Error("VALIDATION: That item is not part of this package.");

    if (sellerOrder.status !== SellerOrderStatus.DELIVERED) {
      throw new Error("VALIDATION: Returns can be requested once the package has been delivered.");
    }
    const deliveredAt = deliveredAtOf(sellerOrder);
    const windowEnds = deliveredAt.getTime() + returnWindowDays * 24 * 60 * 60 * 1000;
    if (Date.now() > windowEnds) {
      throw new Error(`VALIDATION: The ${returnWindowDays}-day return window for this package has closed.`);
    }

    const earlier = await tx.returnItem.aggregate({
      where: { orderItemId, returnRequest: { status: { in: OPEN_RETURN_STATUSES } } },
      _sum: { quantity: true },
    });
    const alreadyReturned = earlier._sum.quantity || 0;
    const remaining = item.quantity - alreadyReturned;
    if (remaining <= 0) {
      throw new Error("VALIDATION: A return has already been requested for every unit of this item.");
    }
    if (quantity > remaining) {
      throw new Error(`VALIDATION: You can return at most ${remaining} more of this item.`);
    }

    const created = await tx.returnRequest.create({
      data: {
        sellerOrderId,
        customerUserId,
        reasonCode,
        explanation: cleanExplanation || "No details provided",
        status: ReturnStatus.SUBMITTED,
        items: { create: { orderItemId, quantity } },
      },
    });

    // Let the seller know a return is waiting for review
    await notifySellerMembers(tx, sellerOrder.sellerOrgId, {
      title: "New return request",
      message: `A customer requested a return of ${quantity} × ${item.productTitleSnapshot} from package ${sellerOrder.sellerOrderNumber}.`,
      type: "RETURN",
      linkUrl: "/seller/portal/returns",
    });

    return created;
  });
}

type TransitionOptions = {
  actorUserId?: string | null;
  /** When set, the return must belong to this seller (seller-portal callers). */
  sellerOrgId?: string;
  note?: string;
  refundReference?: string;
};

const FROM_STATUS: Record<ReturnAction, ReturnStatus> = {
  APPROVE: ReturnStatus.SUBMITTED,
  REJECT: ReturnStatus.SUBMITTED,
  MARK_RECEIVED: ReturnStatus.APPROVED,
  RECORD_REFUND: ReturnStatus.RECEIVED,
};

const TO_STATUS: Record<ReturnAction, ReturnStatus> = {
  APPROVE: ReturnStatus.APPROVED,
  REJECT: ReturnStatus.REJECTED,
  MARK_RECEIVED: ReturnStatus.RECEIVED,
  RECORD_REFUND: ReturnStatus.REFUNDED,
};

const STATUS_WORD: Record<ReturnStatus, string> = {
  SUBMITTED: "waiting for review",
  APPROVED: "approved",
  REJECTED: "rejected",
  RECEIVED: "received",
  REFUNDED: "refunded",
};

/** Moves a return one step along its lifecycle. See the module comment for the allowed steps. */
export async function transitionReturnRequest(returnRequestId: string, action: ReturnAction, opts: TransitionOptions = {}) {
  const note = opts.note ? String(opts.note).trim().slice(0, 1000) : undefined;
  const refundReference = opts.refundReference ? String(opts.refundReference).trim() : "";
  if (action === "RECORD_REFUND" && (refundReference.length < 3 || refundReference.length > 120)) {
    throw new Error("VALIDATION: Enter the reference of the refund transfer you made (3-120 characters).");
  }

  return prisma.$transaction(async (tx) => {
    const returnReq = await tx.returnRequest.findUnique({
      where: { id: returnRequestId },
      include: {
        sellerOrder: { include: { customerOrder: { select: { id: true, currency: true, orderNumber: true } } } },
        items: { include: { orderItem: true } },
      },
    });
    if (!returnReq) throw new Error("Return request not found.");
    if (opts.sellerOrgId && returnReq.sellerOrder.sellerOrgId !== opts.sellerOrgId) {
      throw new Error("FORBIDDEN: This return does not belong to your store.");
    }

    const from = FROM_STATUS[action];
    if (returnReq.status !== from) {
      throw new Error(`VALIDATION: This return is ${STATUS_WORD[returnReq.status]}, so it cannot be ${action === "RECORD_REFUND" ? "refunded" : STATUS_WORD[TO_STATUS[action]]} now.`);
    }

    const flipped = await tx.returnRequest.updateMany({
      where: { id: returnRequestId, status: from },
      data: {
        status: TO_STATUS[action],
        ...(action === "APPROVE" || action === "REJECT" ? { resolvedAt: new Date() } : {}),
      },
    });
    if (flipped.count === 0) {
      throw new Error("VALIDATION: This return was updated by someone else. Refresh and try again.");
    }

    if (note) {
      await tx.returnItem.updateMany({ where: { returnRequestId }, data: { inspectionResult: note } });
    }

    const sellerOrgId = returnReq.sellerOrder.sellerOrgId;
    let refundAmountMinor = 0;

    if (action === "MARK_RECEIVED") {
      // Goods are back with the seller: put them back on sale
      for (const item of returnReq.items) {
        if (!item.orderItem.variantId) continue;
        const level = await tx.inventoryLevel.update({
          where: { variantId: item.orderItem.variantId },
          data: { availableUnits: { increment: item.quantity } },
        });
        await tx.inventoryAdjustment.create({
          data: {
            variantId: item.orderItem.variantId,
            sellerOrgId,
            actorUserId: opts.actorUserId || null,
            deltaUnits: item.quantity,
            balanceAfter: level.availableUnits,
            reasonCode: InventoryAdjustmentReason.RETURN_RESTOCK,
            notes: `Returned goods received (return ${returnRequestId})${note ? `: ${note}` : ""}`,
          },
        });
      }
    }

    if (action === "RECORD_REFUND") {
      let sellerDebitMinor = 0;
      let commissionReversedMinor = 0;
      for (const item of returnReq.items) {
        const lineRefund = lineRefundMinor(item.orderItem, item.quantity);
        const commission = Math.round((lineRefund * item.orderItem.commissionRatePercent) / 100);
        refundAmountMinor += lineRefund;
        commissionReversedMinor += commission;
        sellerDebitMinor += lineRefund - commission;
      }

      await tx.refund.create({
        data: {
          customerOrderId: returnReq.sellerOrder.customerOrderId,
          sellerOrderId: returnReq.sellerOrderId,
          amountMinor: refundAmountMinor,
          currency: returnReq.sellerOrder.customerOrder.currency || SITE_CONFIG.defaultCurrency,
          status: RefundStatus.SUCCEEDED,
          reason: `Return ${returnRequestId}`,
          externalRefundRef: refundReference,
        },
      });

      await tx.sellerOrder.update({
        where: { id: returnReq.sellerOrderId },
        data: {
          netSellerPayableMinor: { decrement: sellerDebitMinor },
          platformCommissionMinor: { decrement: commissionReversedMinor },
        },
      });

      // One net debit against the seller's payable balance. The seller only ever had the
      // net (after-commission) amount credited, so the platform absorbs the commission part.
      // ELIGIBLE so it reduces the next payout; a payout already made becomes a negative balance.
      await tx.settlementLedger.create({
        data: {
          sellerOrgId,
          sellerOrderId: returnReq.sellerOrderId,
          entryType: SettlementEntryType.REFUND_DEBIT,
          amountMinor: -sellerDebitMinor,
          balanceAfterMinor: 0,
          status: SettlementStatus.ELIGIBLE,
          eligibleAt: new Date(),
          description: `Refund for return ${returnRequestId} (order ${returnReq.sellerOrder.customerOrder.orderNumber})`,
          referenceId: refundReference,
          actorUserId: opts.actorUserId || null,
        },
      });
    }

    if (action === "APPROVE" || action === "REJECT") {
      await tx.notification.create({
        data: {
          userId: returnReq.customerUserId,
          title: action === "APPROVE" ? "Return approved" : "Return not approved",
          message:
            action === "APPROVE"
              ? `Your return for order ${returnReq.sellerOrder.customerOrder.orderNumber} was approved. Please send the item back to the seller.`
              : `Your return for order ${returnReq.sellerOrder.customerOrder.orderNumber} was not approved.${note ? ` Reason: ${note}` : ""}`,
          type: "RETURN",
          linkUrl: `/orders/${returnReq.sellerOrder.customerOrderId}`,
        },
      });
    }

    await tx.auditEvent.create({
      data: {
        actorUserId: opts.actorUserId || null,
        entityType: "ReturnRequest",
        entityId: returnRequestId,
        action: `RETURN_${action}`,
        detailsJson: JSON.stringify({
          fromStatus: from,
          toStatus: TO_STATUS[action],
          note,
          refundReference: refundReference || undefined,
          refundAmountMinor: refundAmountMinor || undefined,
        }),
      },
    });

    return tx.returnRequest.findUniqueOrThrow({ where: { id: returnRequestId } });
  });
}

/** @deprecated Use transitionReturnRequest. Kept for older callers and tests. */
export async function reviewReturnRequest(returnRequestId: string, decision: "APPROVED" | "REJECTED", notes?: string) {
  return transitionReturnRequest(returnRequestId, decision === "APPROVED" ? "APPROVE" : "REJECT", { note: notes });
}

