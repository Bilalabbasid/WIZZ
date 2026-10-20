import { prisma } from "@/lib/db";
import {
  ReturnStatus,
  RefundStatus,
  InventoryAdjustmentReason,
  SettlementStatus,
  SettlementEntryType,
} from "@prisma/client";
import { SITE_CONFIG } from "@/lib/config";

export async function createReturnRequest(
  sellerOrderId: string,
  customerUserId: string,
  orderItemId: string,
  quantity: number,
  reasonCode: string,
  explanation: string
) {
  const sellerOrder = await prisma.sellerOrder.findUnique({
    where: { id: sellerOrderId },
    include: {
      customerOrder: true,
      items: { where: { id: orderItemId } },
    },
  });

  if (!sellerOrder) {
    throw new Error("Order not found.");
  }

  if (sellerOrder.customerOrder.customerUserId !== customerUserId) {
    throw new Error("FORBIDDEN: You can only return items from your own orders.");
  }

  const item = sellerOrder.items[0];
  if (!item) {
    throw new Error("Order item not found in this seller order.");
  }

  if (quantity > item.quantity) {
    throw new Error("Return quantity cannot exceed purchased quantity.");
  }

  return prisma.$transaction(async (tx) => {
    const returnRequest = await tx.returnRequest.create({
      data: {
        sellerOrderId,
        customerUserId,
        reasonCode,
        explanation,
        status: ReturnStatus.SUBMITTED,
        items: {
          create: {
            orderItemId,
            quantity,
          },
        },
      },
    });

    return returnRequest;
  });
}

export async function reviewReturnRequest(
  returnRequestId: string,
  decision: "APPROVED" | "REJECTED",
  notes?: string
) {
  const status = decision === "APPROVED" ? ReturnStatus.APPROVED : ReturnStatus.REJECTED;

  return prisma.returnRequest.update({
    where: { id: returnRequestId },
    data: {
      status,
      resolvedAt: new Date(),
      returnShippingLabelUrl: decision === "APPROVED" ? `/shipping/labels/return-${returnRequestId}.pdf` : null,
    },
  });
}

export async function processReturnRestockAndRefund(returnRequestId: string) {
  const returnReq = await prisma.returnRequest.findUnique({
    where: { id: returnRequestId },
    include: {
      sellerOrder: { include: { customerOrder: true } },
      items: { include: { orderItem: true } },
    },
  });

  if (!returnReq || returnReq.status !== ReturnStatus.APPROVED) {
    throw new Error("Return request is not approved or not found.");
  }

  return prisma.$transaction(async (tx) => {
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

      // Restock inventory if variant still exists
      if (item.orderItem.variantId) {
        await tx.inventoryLevel.update({
          where: { variantId: item.orderItem.variantId },
          data: { availableUnits: { increment: itemQuantity } },
        });

        await tx.inventoryAdjustment.create({
          data: {
            variantId: item.orderItem.variantId,
            sellerOrgId: returnReq.sellerOrder.sellerOrgId,
            deltaUnits: itemQuantity,
            balanceAfter: 0,
            reasonCode: InventoryAdjustmentReason.RETURN_RESTOCK,
            notes: `Restocked from return request ${returnRequestId}`,
          },
        });
      }
    }

    const totalSellerDebit = refundAmountMinor - totalCommissionReversedMinor;

    // 1. Record customer refund
    await tx.refund.create({
      data: {
        customerOrderId: returnReq.sellerOrder.customerOrderId,
        sellerOrderId: returnReq.sellerOrderId,
        amountMinor: refundAmountMinor,
        currency: SITE_CONFIG.defaultCurrency,
        status: RefundStatus.SUCCEEDED,
        reason: `Processed return request ${returnRequestId}`,
        externalRefundRef: `REF_${Date.now()}`,
      },
    });

    // 2. Adjust seller order payable and commission snapshots
    await tx.sellerOrder.update({
      where: { id: returnReq.sellerOrderId },
      data: {
        netSellerPayableMinor: { decrement: totalSellerDebit },
        platformCommissionMinor: { decrement: totalCommissionReversedMinor },
      },
    });

    // 3. Record double-entry settlement adjustments
    await tx.settlementLedger.create({
      data: {
        sellerOrgId: returnReq.sellerOrder.sellerOrgId,
        sellerOrderId: returnReq.sellerOrderId,
        entryType: SettlementEntryType.REFUND_DEBIT,
        amountMinor: -totalSellerDebit,
        balanceAfterMinor: 0,
        status: SettlementStatus.SETTLED,
        description: `Debit adjustment for return #${returnRequestId}`,
        referenceId: `RET_REF_${returnRequestId}`,
      },
    });

    await tx.settlementLedger.create({
      data: {
        sellerOrgId: returnReq.sellerOrder.sellerOrgId,
        sellerOrderId: returnReq.sellerOrderId,
        entryType: SettlementEntryType.COMMISSION_REVERSAL_CREDIT,
        amountMinor: totalCommissionReversedMinor,
        balanceAfterMinor: 0,
        status: SettlementStatus.SETTLED,
        description: `Commission reversal credit for return #${returnRequestId}`,
        referenceId: `RET_COMM_${returnRequestId}`,
      },
    });

    // 4. Mark return completed
    await tx.returnRequest.update({
      where: { id: returnRequestId },
      data: { status: ReturnStatus.REFUNDED },
    });

    return {
      refunded: true,
      amountMinor: refundAmountMinor,
      commissionReversedMinor: totalCommissionReversedMinor,
      sellerDebitMinor: totalSellerDebit,
    };
  });
}
