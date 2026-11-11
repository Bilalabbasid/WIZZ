import { Prisma, RefundStatus, SettlementEntryType, SettlementStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isFirstPartySeller } from "@/lib/config";
import { processManualSellerSettlement, recordFailedPayoutAdjustment } from "@/modules/sellers/order-services";
import { ADMIN_PAGE_SIZE, AdminRuleError } from "./http";

/* ------------------------------------------------------------------ */
/* Refunds                                                             */
/* ------------------------------------------------------------------ */

export const REFUND_STATUS_VALUES = Object.values(RefundStatus);

export async function listRefunds({ status, q, page }: { status: RefundStatus | null; q: string; page: number }) {
  const where: Prisma.RefundWhereInput = {};
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { customerOrder: { orderNumber: { contains: q, mode: "insensitive" } } },
      { externalRefundRef: { contains: q, mode: "insensitive" } },
    ];
  }
  const [total, rows, pendingAgg] = await Promise.all([
    prisma.refund.count({ where }),
    prisma.refund.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        amountMinor: true,
        status: true,
        reason: true,
        externalRefundRef: true,
        createdAt: true,
        sellerOrderId: true,
        customerOrder: { select: { id: true, orderNumber: true, customerEmail: true, paymentStatus: true, status: true } },
      },
    }),
    prisma.refund.aggregate({ where: { status: RefundStatus.PENDING }, _count: true, _sum: { amountMinor: true } }),
  ]);

  // Refund.sellerOrderId has no relation in the schema; resolve package numbers in one query.
  const sellerOrderIds = [...new Set(rows.map((r) => r.sellerOrderId).filter((v): v is string => Boolean(v)))];
  const sellerOrders = sellerOrderIds.length
    ? await prisma.sellerOrder.findMany({
        where: { id: { in: sellerOrderIds } },
        select: { id: true, sellerOrderNumber: true, sellerOrg: { select: { name: true } } },
      })
    : [];
  const soMap = new Map(sellerOrders.map((s) => [s.id, s]));

  return {
    total,
    pendingCount: pendingAgg._count,
    pendingMinor: pendingAgg._sum.amountMinor ?? 0,
    refunds: rows.map((r) => {
      const so = r.sellerOrderId ? soMap.get(r.sellerOrderId) : undefined;
      return {
        ...r,
        sellerOrderNumber: so?.sellerOrderNumber ?? null,
        sellerName: so?.sellerOrg.name ?? null,
      };
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Seller payouts                                                      */
/* ------------------------------------------------------------------ */

const REVERSAL_PREFIX = "REV_";

export async function getSellerPayoutSummary(sellerOrgId: string) {
  const [byStatus, payoutAgg, reversalAgg, entries, org] = await Promise.all([
    prisma.settlementLedger.groupBy({
      by: ["status"],
      where: { sellerOrgId },
      _sum: { amountMinor: true },
    }),
    prisma.settlementLedger.aggregate({
      where: { sellerOrgId, entryType: SettlementEntryType.MANUAL_PAYOUT },
      _sum: { amountMinor: true },
      _count: true,
    }),
    prisma.settlementLedger.aggregate({
      where: { sellerOrgId, entryType: SettlementEntryType.ADJUSTMENT, referenceId: { startsWith: REVERSAL_PREFIX } },
      _sum: { amountMinor: true },
    }),
    prisma.settlementLedger.findMany({
      where: { sellerOrgId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        entryType: true,
        amountMinor: true,
        status: true,
        description: true,
        referenceId: true,
        holdReason: true,
        eligibleAt: true,
        settledAt: true,
        createdAt: true,
        sellerOrder: { select: { sellerOrderNumber: true } },
      },
    }),
    prisma.sellerOrg.findUnique({
      where: { id: sellerOrgId },
      select: { bankName: true, bankAccountTitle: true, bankIban: true },
    }),
  ]);

  const sumFor = (s: SettlementStatus) => byStatus.find((b) => b.status === s)?._sum.amountMinor ?? 0;

  const payoutRefs = entries.filter((e) => e.entryType === SettlementEntryType.MANUAL_PAYOUT && e.referenceId).map((e) => e.referenceId as string);
  const reversed = payoutRefs.length
    ? await prisma.settlementLedger.findMany({
        where: { sellerOrgId, referenceId: { in: payoutRefs.map((r) => `${REVERSAL_PREFIX}${r}`) } },
        select: { referenceId: true },
      })
    : [];
  const reversedRefs = new Set(reversed.map((r) => (r.referenceId ?? "").slice(REVERSAL_PREFIX.length)));

  return {
    eligibleMinor: sumFor(SettlementStatus.ELIGIBLE),
    inEscrowMinor: sumFor(SettlementStatus.IN_ESCROW) + sumFor(SettlementStatus.PENDING),
    heldMinor: sumFor(SettlementStatus.HELD),
    paidOutMinor: Math.abs(payoutAgg._sum.amountMinor ?? 0),
    payoutCount: payoutAgg._count,
    reversedPayoutsMinor: reversalAgg._sum.amountMinor ?? 0,
    bank: org ?? { bankName: null, bankAccountTitle: null, bankIban: null },
    entries: entries.map((e) => ({
      ...e,
      isReversed: e.entryType === SettlementEntryType.MANUAL_PAYOUT && !!e.referenceId && reversedRefs.has(e.referenceId),
    })),
  };
}

export const payoutSchema = z.object({
  payoutAmountMinor: z.number().int("Amount must be in whole paisa.").positive("Amount must be greater than zero.").max(10_000_000_000),
  bankTransactionRef: z
    .string()
    .trim()
    .min(3, "Enter the bank transfer reference.")
    .max(120)
    .regex(/^[A-Za-z0-9 /_.:-]+$/, "Reference may contain letters, digits, spaces and / _ . : - only."),
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export const payoutFailedSchema = z.object({
  payoutReferenceId: z.string().trim().min(1).max(120),
  failureReason: z.string().trim().min(5, "Describe why the payout failed (at least 5 characters).").max(500),
});

async function assertPayableSeller(sellerOrgId: string) {
  const org = await prisma.sellerOrg.findUnique({ where: { id: sellerOrgId }, select: { id: true, slug: true } });
  if (!org) throw new AdminRuleError("Seller not found.", 404);
  if (isFirstPartySeller(org)) {
    throw new AdminRuleError("WIZZ.PK Direct is the first-party store; it does not receive seller payouts.", 409);
  }
  return org;
}

/**
 * Records a manual bank payout that finance has ALREADY made. The sellers service locks the
 * org row, validates the eligible balance, settles ledger entries and writes the audit event.
 */
export async function recordSellerPayout(sellerOrgId: string, actorUserId: string, input: z.infer<typeof payoutSchema>) {
  await assertPayableSeller(sellerOrgId);
  // Payout references identify payouts for later reversal, so they must be unique per seller.
  const duplicate = await prisma.settlementLedger.findFirst({
    where: { sellerOrgId, entryType: SettlementEntryType.MANUAL_PAYOUT, referenceId: input.bankTransactionRef },
    select: { id: true },
  });
  if (duplicate) {
    throw new AdminRuleError("A payout with this bank reference is already recorded for this seller.", 409);
  }
  return processManualSellerSettlement({
    sellerOrgId,
    payoutAmountMinor: input.payoutAmountMinor,
    bankTransactionRef: input.bankTransactionRef,
    notes: input.notes,
    actorUserId,
  });
}

/** Restores the balance of a bounced payout once; the service writes the audit event. */
export async function markSellerPayoutFailed(sellerOrgId: string, actorUserId: string, input: z.infer<typeof payoutFailedSchema>) {
  await assertPayableSeller(sellerOrgId);
  const alreadyReversed = await prisma.settlementLedger.findFirst({
    where: { sellerOrgId, referenceId: `${REVERSAL_PREFIX}${input.payoutReferenceId}` },
    select: { id: true },
  });
  if (alreadyReversed) {
    throw new AdminRuleError("This payout has already been marked as failed and its balance restored.", 409);
  }
  return recordFailedPayoutAdjustment({
    sellerOrgId,
    payoutReferenceId: input.payoutReferenceId,
    failureReason: input.failureReason,
    actorUserId,
  });
}
