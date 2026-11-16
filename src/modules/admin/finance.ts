import {
  PayoutRequestStatus,
  Prisma,
  RefundStatus,
  SellerMembershipRole,
  SellerOperationalStatus,
  SettlementEntryType,
  SettlementStatus,
  UserRole,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isFirstPartySeller } from "@/lib/config";
import { getSellerBalances, PAYOUT_REVERSAL_PREFIX } from "@/modules/sellers/order-services";
import {
  BANK_CHANGE_PAYOUT_HOLD_HOURS,
  formatPkTime,
  maskStoredIban,
  payoutHoldUntil,
  readStoredIban,
  storedIbanLast4,
} from "@/modules/sellers/services";
import { ADMIN_PAGE_SIZE, AdminRuleError, writeAdminAudit } from "./http";

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
/* Seller payouts: maker-checker PayoutRequest flow                     */
/* ------------------------------------------------------------------ */
/*
 * Payouts are manual bank transfers made by WIZZ.PK finance outside the app. Flow:
 *   1. A finance admin REQUESTS a payout (amount is reserved against the available balance).
 *   2. A DIFFERENT finance admin makes the bank transfer and CONFIRMS it with the bank reference:
 *      only then is the MANUAL_PAYOUT ledger debit written (status SETTLED).
 *   3. A request can be REJECTED before confirmation (reservation released), and a confirmed payout
 *      the bank returned is marked FAILED once, which writes an ELIGIBLE "REV_<ref>" credit.
 * Every write locks the SellerOrg row (FOR UPDATE) and recomputes balances with getSellerBalances
 * inside the same transaction; status changes are conditional updates so a double click or a
 * concurrent request can never pay twice. Full IBANs never appear in requests, ledger rows,
 * audit events or notifications (last 4 digits only).
 */

export const PAYOUT_LIMITS = {
  /** Largest single payout (Rs 2,000,000). Larger amounts are split into separate requests. */
  maxSingleMinor: 200_000_000,
  /** Confirmed payouts per seller in any rolling 24 hours. */
  maxApprovedPer24h: 3,
  /** Open (unconfirmed) requests per seller. */
  maxOpenRequestsPerSeller: 1,
  bankChangeHoldHours: BANK_CHANGE_PAYOUT_HOLD_HOURS,
} as const;

const FINANCE_ROLES: UserRole[] = [UserRole.PLATFORM_SUPER_ADMIN, UserRole.PLATFORM_FINANCE_ADMIN];
const DAY_MS = 24 * 60 * 60 * 1000;
const TX_OPTIONS = { maxWait: 10000, timeout: 20000 };

type Tx = Prisma.TransactionClient;
export type AuditMeta = { ipAddress: string | null; userAgent: string | null };

function rs(minor: number): string {
  return `Rs ${(minor / 100).toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;
}

const bankReferenceSchema = z
  .string({ error: "Enter the bank transfer reference." })
  .trim()
  .min(3, "Enter the bank transfer reference (3-120 characters).")
  .max(120, "The bank reference can be at most 120 characters.")
  .regex(/^[A-Za-z0-9 /_.:-]+$/, "Reference may contain letters, digits, spaces and / _ . : - only.");

const optionalSellerId = z.string().trim().min(1).max(64).optional();

export const payoutRequestBodySchema = z.object({
  amountMinor: z
    .number({ error: "Amount must be a number of paisa." })
    .int("Amount must be in whole paisa.")
    .positive("Amount must be greater than zero.")
    .max(10_000_000_000),
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : undefined)),
  idempotencyKey: z.string({ error: "idempotencyKey is required." }).uuid("idempotencyKey must be a UUID."),
});

export const createPayoutRequestSchema = payoutRequestBodySchema.extend({
  sellerOrgId: z.string({ error: "Choose the seller." }).trim().min(1).max(64),
});

export const approvePayoutSchema = z.object({ bankReference: bankReferenceSchema, sellerOrgId: optionalSellerId });
export const rejectPayoutSchema = z.object({
  note: z.string({ error: "Add a note." }).trim().min(3, "Say why the payout is rejected (at least 3 characters).").max(500),
  sellerOrgId: optionalSellerId,
});
export const failPayoutSchema = z.object({
  reason: z.string({ error: "Add the failure reason." }).trim().min(5, "Describe why the transfer failed (at least 5 characters).").max(500),
  sellerOrgId: optionalSellerId,
});
export const revealBankSchema = z.object({ reason: z.string().trim().max(300).optional() });

/** Service-level role check (routes check too): the acting user must be a super or finance admin. */
async function assertFinanceActor(db: Tx, userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user || !FINANCE_ROLES.includes(user.role)) {
    throw new AdminRuleError("Only super admins and finance admins can manage seller payouts.", 403);
  }
}

async function lockSellerOrg(tx: Tx, sellerOrgId: string) {
  await tx.$queryRaw`SELECT id FROM "SellerOrg" WHERE id = ${sellerOrgId} FOR UPDATE`;
}

/** Preconditions for paying a seller, checked on the locked org row. */
async function loadPayableSeller(tx: Tx, sellerOrgId: string, now: Date) {
  const org = await tx.sellerOrg.findUnique({
    where: { id: sellerOrgId },
    select: {
      id: true,
      slug: true,
      name: true,
      operationalStatus: true,
      bankName: true,
      bankAccountTitle: true,
      bankIban: true,
      bankDetailsChangedAt: true,
    },
  });
  if (!org) throw new AdminRuleError("Seller not found.", 404);
  if (isFirstPartySeller(org)) {
    throw new AdminRuleError("WIZZ.PK Direct is the first-party store; it does not receive seller payouts.", 409);
  }
  if (org.operationalStatus !== SellerOperationalStatus.ACTIVE) {
    throw new AdminRuleError(`Payouts are made only to ACTIVE sellers (this seller is ${org.operationalStatus}).`, 409);
  }
  const ibanLast4 = storedIbanLast4(org.bankIban);
  if (!org.bankName || !org.bankAccountTitle || !ibanLast4) {
    throw new AdminRuleError("The seller has no complete payout bank account on file.", 409);
  }
  const holdUntil = payoutHoldUntil(org.bankDetailsChangedAt, now);
  if (holdUntil) {
    throw new AdminRuleError(
      `The seller's bank account changed recently; payouts resume at ${formatPkTime(holdUntil)} (Pakistan time).`,
      409
    );
  }
  return { org, ibanLast4 };
}

async function assertApprovalVelocity(tx: Tx, sellerOrgId: string, now: Date) {
  const approvedLastDay = await tx.payoutRequest.count({
    where: {
      sellerOrgId,
      status: { in: [PayoutRequestStatus.APPROVED_PAID, PayoutRequestStatus.FAILED] },
      decidedAt: { gte: new Date(now.getTime() - DAY_MS) },
    },
  });
  if (approvedLastDay >= PAYOUT_LIMITS.maxApprovedPer24h) {
    throw new AdminRuleError(
      `This seller already received ${PAYOUT_LIMITS.maxApprovedPer24h} payouts in the last 24 hours. Try again later or contact a super admin.`,
      409
    );
  }
}

async function notifySellerAdmins(tx: Tx, sellerOrgId: string, title: string, message: string) {
  const admins = await tx.sellerMembership.findMany({
    where: { sellerOrgId, isActive: true, role: { in: [SellerMembershipRole.OWNER, SellerMembershipRole.ADMIN] } },
    select: { userId: true },
  });
  for (const m of admins) {
    await tx.notification.create({
      data: { userId: m.userId, sellerOrgId, title, message, type: "PAYOUT", linkUrl: "/seller/portal/settlements" },
    });
  }
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

function statusLabel(status: PayoutRequestStatus): string {
  switch (status) {
    case PayoutRequestStatus.APPROVED_PAID:
      return "confirmed as paid";
    case PayoutRequestStatus.REJECTED:
      return "rejected";
    case PayoutRequestStatus.FAILED:
      return "marked as failed";
    default:
      return "waiting for confirmation";
  }
}

type PayoutRequestRow = Awaited<ReturnType<typeof prisma.payoutRequest.findUniqueOrThrow>>;

function assertSameRequest(existing: PayoutRequestRow, sellerOrgId: string, amountMinor: number) {
  if (existing.sellerOrgId !== sellerOrgId || existing.amountMinor !== amountMinor) {
    throw new AdminRuleError("This idempotency key was already used for a different payout request.", 409);
  }
}

/**
 * Step 1 (maker): reserve a payout for a seller. Idempotent on `idempotencyKey`: the same key
 * returns the same request (never a second one); reusing a key for different data is refused.
 */
export async function createPayoutRequest(
  sellerOrgId: string,
  actorUserId: string,
  input: { amountMinor: number; idempotencyKey: string; notes?: string },
  meta?: AuditMeta
): Promise<{ request: PayoutRequestRow; replayed: boolean }> {
  const replay = await prisma.payoutRequest.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (replay) {
    assertSameRequest(replay, sellerOrgId, input.amountMinor);
    return { request: replay, replayed: true };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await assertFinanceActor(tx, actorUserId);
      await lockSellerOrg(tx, sellerOrgId);

      // A concurrent call with the same key may have committed while we waited for the lock
      const raced = await tx.payoutRequest.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (raced) {
        assertSameRequest(raced, sellerOrgId, input.amountMinor);
        return { request: raced, replayed: true };
      }

      const now = new Date();
      const { ibanLast4 } = await loadPayableSeller(tx, sellerOrgId, now);

      if (input.amountMinor > PAYOUT_LIMITS.maxSingleMinor) {
        throw new AdminRuleError(
          `A single payout can be at most ${rs(PAYOUT_LIMITS.maxSingleMinor)}. Split it into smaller payouts or contact a super admin.`,
          409
        );
      }
      const open = await tx.payoutRequest.count({ where: { sellerOrgId, status: PayoutRequestStatus.REQUESTED } });
      if (open >= PAYOUT_LIMITS.maxOpenRequestsPerSeller) {
        throw new AdminRuleError("This seller already has a payout waiting for confirmation. Confirm or reject it first.", 409);
      }
      await assertApprovalVelocity(tx, sellerOrgId, now);

      const balances = await getSellerBalances(sellerOrgId, tx);
      if (input.amountMinor > balances.availableMinor) {
        throw new AdminRuleError(
          `The amount exceeds the seller's available balance of ${rs(Math.max(0, balances.availableMinor))}.`,
          409
        );
      }

      const request = await tx.payoutRequest.create({
        data: {
          sellerOrgId,
          amountMinor: input.amountMinor,
          requestedById: actorUserId,
          bankIbanLast4: ibanLast4,
          notes: input.notes ?? null,
          idempotencyKey: input.idempotencyKey,
        },
      });
      await writeAdminAudit(tx, {
        actorUserId,
        entityType: "PayoutRequest",
        entityId: request.id,
        action: "PAYOUT_REQUESTED",
        details: {
          sellerOrgId,
          payoutRequestId: request.id,
          amountMinor: input.amountMinor,
          bankIbanLast4: ibanLast4,
          availableBeforeMinor: balances.availableMinor,
          notes: input.notes ?? null,
        },
        meta,
      });
      return { request, replayed: false };
    }, TX_OPTIONS);
  } catch (err) {
    if (isUniqueViolation(err)) {
      const existing = await prisma.payoutRequest.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) {
        assertSameRequest(existing, sellerOrgId, input.amountMinor);
        return { request: existing, replayed: true };
      }
    }
    throw err;
  }
}

/** Loads a request (optionally bound to the seller in the URL/body), then locks its seller. */
async function lockRequest(tx: Tx, requestId: string, expectedSellerOrgId?: string) {
  const head = await tx.payoutRequest.findUnique({ where: { id: requestId }, select: { sellerOrgId: true } });
  if (!head || (expectedSellerOrgId && head.sellerOrgId !== expectedSellerOrgId)) {
    throw new AdminRuleError("Payout request not found.", 404);
  }
  await lockSellerOrg(tx, head.sellerOrgId);
  return tx.payoutRequest.findUniqueOrThrow({ where: { id: requestId } });
}

/**
 * Step 2 (checker): a different finance admin confirms the bank transfer was made. Writes the
 * MANUAL_PAYOUT ledger debit and flips the request REQUESTED → APPROVED_PAID in one transaction.
 */
export async function approvePayoutRequest(
  requestId: string,
  actorUserId: string,
  input: z.infer<typeof approvePayoutSchema>,
  meta?: AuditMeta
) {
  const bankReference = input.bankReference.trim();
  try {
    return await prisma.$transaction(async (tx) => {
      await assertFinanceActor(tx, actorUserId);
      const request = await lockRequest(tx, requestId, input.sellerOrgId);
      if (request.status !== PayoutRequestStatus.REQUESTED) {
        throw new AdminRuleError(`This payout request is already ${statusLabel(request.status)}.`, 409);
      }
      if (request.requestedById === actorUserId) {
        throw new AdminRuleError("You requested this payout, so a different finance admin must confirm it.", 403);
      }

      const now = new Date();
      const { org, ibanLast4 } = await loadPayableSeller(tx, request.sellerOrgId, now);
      if (request.bankIbanLast4 !== ibanLast4) {
        throw new AdminRuleError("The seller's bank account changed after this request was made. Reject it and request again.", 409);
      }
      await assertApprovalVelocity(tx, request.sellerOrgId, now);

      const balances = await getSellerBalances(request.sellerOrgId, tx);
      // This request's own reservation is part of `reservedMinor`; add it back before comparing
      const availableForThis = balances.availableMinor + request.amountMinor;
      if (request.amountMinor > availableForThis) {
        throw new AdminRuleError(
          `The seller's available balance (${rs(Math.max(0, availableForThis))}) no longer covers this payout. Reject it and request a smaller amount.`,
          409
        );
      }

      const duplicateRef = await tx.settlementLedger.findFirst({
        where: { sellerOrgId: request.sellerOrgId, entryType: SettlementEntryType.MANUAL_PAYOUT, referenceId: bankReference },
        select: { id: true },
      });
      if (duplicateRef) throw new AdminRuleError("This bank reference is already recorded for this seller.", 409);

      const ledger = await tx.settlementLedger.create({
        data: {
          sellerOrgId: request.sellerOrgId,
          entryType: SettlementEntryType.MANUAL_PAYOUT,
          amountMinor: -request.amountMinor,
          balanceAfterMinor: balances.ledgerBalanceMinor - request.amountMinor,
          status: SettlementStatus.SETTLED,
          description: `Payout to ${org.bankName} •••• ${ibanLast4} (bank ref ${bankReference})`,
          referenceId: bankReference,
          actorUserId,
          settledAt: now,
        },
      });

      const flipped = await tx.payoutRequest.updateMany({
        where: { id: request.id, status: PayoutRequestStatus.REQUESTED },
        data: {
          status: PayoutRequestStatus.APPROVED_PAID,
          decidedById: actorUserId,
          decidedAt: now,
          bankReference,
          ledgerEntryId: ledger.id,
        },
      });
      if (flipped.count === 0) throw new AdminRuleError("This payout request was just decided by someone else.", 409);

      await writeAdminAudit(tx, {
        actorUserId,
        entityType: "PayoutRequest",
        entityId: request.id,
        action: "PAYOUT_APPROVED",
        details: {
          sellerOrgId: request.sellerOrgId,
          payoutRequestId: request.id,
          amountMinor: request.amountMinor,
          bankIbanLast4: ibanLast4,
          bankReference,
          ledgerEntryId: ledger.id,
          requestedById: request.requestedById,
        },
        meta,
      });
      await notifySellerAdmins(
        tx,
        request.sellerOrgId,
        "Payout sent",
        `${rs(request.amountMinor)} was transferred to your ${org.bankName} account •••• ${ibanLast4} (bank reference ${bankReference}).`
      );
      return tx.payoutRequest.findUniqueOrThrow({ where: { id: request.id } });
    }, TX_OPTIONS);
  } catch (err) {
    if (isUniqueViolation(err)) throw new AdminRuleError("This bank reference is already recorded for this seller.", 409);
    throw err;
  }
}

/** Rejects an unconfirmed request; its reservation is released. */
export async function rejectPayoutRequest(
  requestId: string,
  actorUserId: string,
  input: z.infer<typeof rejectPayoutSchema>,
  meta?: AuditMeta
) {
  return prisma.$transaction(async (tx) => {
    await assertFinanceActor(tx, actorUserId);
    const request = await lockRequest(tx, requestId, input.sellerOrgId);
    if (request.status !== PayoutRequestStatus.REQUESTED) {
      throw new AdminRuleError(`This payout request is already ${statusLabel(request.status)}.`, 409);
    }
    const now = new Date();
    const flipped = await tx.payoutRequest.updateMany({
      where: { id: request.id, status: PayoutRequestStatus.REQUESTED },
      data: { status: PayoutRequestStatus.REJECTED, decidedById: actorUserId, decidedAt: now, decisionNote: input.note },
    });
    if (flipped.count === 0) throw new AdminRuleError("This payout request was just decided by someone else.", 409);
    await writeAdminAudit(tx, {
      actorUserId,
      entityType: "PayoutRequest",
      entityId: request.id,
      action: "PAYOUT_REJECTED",
      details: {
        sellerOrgId: request.sellerOrgId,
        payoutRequestId: request.id,
        amountMinor: request.amountMinor,
        bankIbanLast4: request.bankIbanLast4,
        note: input.note,
        requestedById: request.requestedById,
      },
      meta,
    });
    return tx.payoutRequest.findUniqueOrThrow({ where: { id: request.id } });
  }, TX_OPTIONS);
}

/**
 * The bank returned a confirmed transfer: APPROVED_PAID → FAILED (once) and an ELIGIBLE
 * "REV_<bank reference>" ADJUSTMENT credit restores the amount to the seller's balance.
 */
export async function markPayoutRequestFailed(
  requestId: string,
  actorUserId: string,
  input: z.infer<typeof failPayoutSchema>,
  meta?: AuditMeta
) {
  return prisma.$transaction(async (tx) => {
    await assertFinanceActor(tx, actorUserId);
    const request = await lockRequest(tx, requestId, input.sellerOrgId);
    if (request.status !== PayoutRequestStatus.APPROVED_PAID || !request.bankReference) {
      throw new AdminRuleError(
        request.status === PayoutRequestStatus.FAILED
          ? "This payout has already been marked as failed."
          : "Only a confirmed payout can be marked as failed.",
        409
      );
    }
    const reversalRef = `${PAYOUT_REVERSAL_PREFIX}${request.bankReference}`;
    const existingReversal = await tx.settlementLedger.findFirst({
      where: { sellerOrgId: request.sellerOrgId, entryType: SettlementEntryType.ADJUSTMENT, referenceId: reversalRef },
      select: { id: true },
    });
    if (existingReversal) throw new AdminRuleError("This payout has already been marked as failed.", 409);

    const now = new Date();
    const flipped = await tx.payoutRequest.updateMany({
      where: { id: request.id, status: PayoutRequestStatus.APPROVED_PAID },
      data: { status: PayoutRequestStatus.FAILED, decisionNote: `Transfer failed: ${input.reason}` },
    });
    if (flipped.count === 0) throw new AdminRuleError("This payout has already been marked as failed.", 409);

    const balances = await getSellerBalances(request.sellerOrgId, tx);
    const adjustment = await tx.settlementLedger.create({
      data: {
        sellerOrgId: request.sellerOrgId,
        entryType: SettlementEntryType.ADJUSTMENT,
        amountMinor: request.amountMinor,
        balanceAfterMinor: balances.ledgerBalanceMinor + request.amountMinor,
        status: SettlementStatus.ELIGIBLE,
        description: `Failed payout ${request.bankReference} returned to balance: ${input.reason}`,
        referenceId: reversalRef,
        actorUserId,
        eligibleAt: now,
      },
    });
    await writeAdminAudit(tx, {
      actorUserId,
      entityType: "PayoutRequest",
      entityId: request.id,
      action: "PAYOUT_FAILED",
      details: {
        sellerOrgId: request.sellerOrgId,
        payoutRequestId: request.id,
        amountMinor: request.amountMinor,
        bankIbanLast4: request.bankIbanLast4,
        bankReference: request.bankReference,
        reversalLedgerEntryId: adjustment.id,
        reason: input.reason,
      },
      meta,
    });
    await notifySellerAdmins(
      tx,
      request.sellerOrgId,
      "Payout returned by the bank",
      `The transfer of ${rs(request.amountMinor)} (bank reference ${request.bankReference}) did not reach your account. The amount is back in your WIZZ.PK balance and will be paid again.`
    );
    return { request: await tx.payoutRequest.findUniqueOrThrow({ where: { id: request.id } }), adjustment };
  }, TX_OPTIONS);
}

/**
 * The only way to read a full IBAN: an explicit, audited reveal by a super or finance admin
 * (the finance admin making the transfer needs it). TODO(auth): also require an MFA-verified
 * session once the auth module exposes the `mfa` claim.
 */
export async function revealSellerBankDetails(sellerOrgId: string, actorUserId: string, reason: string | undefined, meta?: AuditMeta) {
  return prisma.$transaction(async (tx) => {
    await assertFinanceActor(tx, actorUserId);
    const org = await tx.sellerOrg.findUnique({
      where: { id: sellerOrgId },
      select: { id: true, bankName: true, bankAccountTitle: true, bankIban: true },
    });
    if (!org) throw new AdminRuleError("Seller not found.", 404);
    if (!org.bankIban) throw new AdminRuleError("This seller has no bank account on file.", 404);
    const iban = readStoredIban(org.bankIban);
    if (!iban) {
      throw new AdminRuleError("The account number cannot be decrypted on this server (encryption key missing or changed).", 500);
    }
    await writeAdminAudit(tx, {
      actorUserId,
      entityType: "SellerOrg",
      entityId: sellerOrgId,
      action: "BANK_DETAILS_REVEALED",
      details: { sellerOrgId, bankIbanLast4: storedIbanLast4(org.bankIban), reason: reason || null },
      meta,
    });
    return { bankName: org.bankName, bankAccountTitle: org.bankAccountTitle, bankIban: iban };
  });
}

/* ------------------------------------------------------------------ */
/* Payout read models                                                  */
/* ------------------------------------------------------------------ */

async function userLabels(ids: Array<string | null | undefined>) {
  const unique = [...new Set(ids.filter((v): v is string => Boolean(v)))];
  if (!unique.length) return new Map<string, string>();
  const users = await prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, email: true } });
  return new Map(users.map((u) => [u.id, u.email]));
}

const REQUEST_SELECT = {
  id: true,
  sellerOrgId: true,
  amountMinor: true,
  status: true,
  requestedById: true,
  decidedById: true,
  bankReference: true,
  bankIbanLast4: true,
  notes: true,
  decisionNote: true,
  requestedAt: true,
  decidedAt: true,
} as const;

/** Admin seller page: balances (same function as the seller statement), bank (masked), requests, ledger. */
export async function getSellerPayoutSummary(sellerOrgId: string) {
  const [balances, entries, org, requests, bankChanges] = await Promise.all([
    getSellerBalances(sellerOrgId),
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
      select: { bankName: true, bankAccountTitle: true, bankIban: true, bankDetailsChangedAt: true, operationalStatus: true },
    }),
    prisma.payoutRequest.findMany({
      where: { sellerOrgId },
      orderBy: [{ requestedAt: "desc" }],
      take: 30,
      select: REQUEST_SELECT,
    }),
    prisma.bankAccountChange.findMany({
      where: { sellerOrgId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, createdAt: true, actorUserId: true, bankName: true, previousIbanLast4: true, newIbanLast4: true },
    }),
  ]);

  const labels = await userLabels([
    ...requests.flatMap((r) => [r.requestedById, r.decidedById]),
    ...bankChanges.map((c) => c.actorUserId),
  ]);
  const sortedRequests = [...requests].sort((a, b) => {
    const ao = a.status === PayoutRequestStatus.REQUESTED ? 0 : 1;
    const bo = b.status === PayoutRequestStatus.REQUESTED ? 0 : 1;
    return ao - bo || b.requestedAt.getTime() - a.requestedAt.getTime();
  });

  return {
    ...balances,
    // Kept for older UI: "eligible to pay" now means available (ledger balance − reserved)
    eligibleToPayMinor: balances.availableMinor,
    bank: {
      bankName: org?.bankName ?? null,
      bankAccountTitle: org?.bankAccountTitle ?? null,
      bankIbanMasked: maskStoredIban(org?.bankIban),
      bankIbanLast4: storedIbanLast4(org?.bankIban),
      bankDetailsChangedAt: org?.bankDetailsChangedAt ?? null,
      payoutHoldUntil: payoutHoldUntil(org?.bankDetailsChangedAt),
    },
    sellerStatus: org?.operationalStatus ?? null,
    limits: PAYOUT_LIMITS,
    requests: sortedRequests.map((r) => ({
      ...r,
      requestedBy: labels.get(r.requestedById) ?? "unknown",
      decidedBy: r.decidedById ? labels.get(r.decidedById) ?? "unknown" : null,
    })),
    bankChanges: bankChanges.map((c) => ({
      ...c,
      changedBy: c.actorUserId ? labels.get(c.actorUserId) ?? "unknown" : "system",
    })),
    entries,
  };
}

export const PAYOUT_STATUS_VALUES = Object.values(PayoutRequestStatus);

/** /admin/payouts: the confirmation queue (REQUESTED first) and payout history. */
export async function listPayoutRequests({ status, q, page }: { status: PayoutRequestStatus | null; q: string; page: number }) {
  const where: Prisma.PayoutRequestWhereInput = {};
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { sellerOrg: { name: { contains: q, mode: "insensitive" } } },
      { bankReference: { contains: q, mode: "insensitive" } },
    ];
  }
  const [total, rows, openAgg] = await Promise.all([
    prisma.payoutRequest.count({ where }),
    prisma.payoutRequest.findMany({
      where,
      orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      select: { ...REQUEST_SELECT, sellerOrg: { select: { id: true, name: true, slug: true, bankName: true } } },
    }),
    prisma.payoutRequest.aggregate({
      where: { status: PayoutRequestStatus.REQUESTED },
      _count: { _all: true },
      _sum: { amountMinor: true },
    }),
  ]);
  const labels = await userLabels(rows.flatMap((r) => [r.requestedById, r.decidedById]));
  // REQUESTED sorts first (enum order); keep it explicit in case the enum order changes
  const sorted = [...rows].sort((a, b) => {
    const ao = a.status === PayoutRequestStatus.REQUESTED ? 0 : 1;
    const bo = b.status === PayoutRequestStatus.REQUESTED ? 0 : 1;
    return ao - bo || b.requestedAt.getTime() - a.requestedAt.getTime();
  });
  return {
    total,
    openCount: openAgg._count._all,
    openMinor: openAgg._sum.amountMinor ?? 0,
    requests: sorted.map((r) => ({
      ...r,
      requestedBy: labels.get(r.requestedById) ?? "unknown",
      decidedBy: r.decidedById ? labels.get(r.decidedById) ?? "unknown" : null,
    })),
  };
}
