import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { notifySellerMembers } from "@/modules/orders/lifecycle";
import {
  CustomerOrderStatus,
  PaymentStatus,
  SellerOrderStatus,
  PaymentAttemptStatus,
  PaymentAttemptProvider,
  SettlementStatus,
  SettlementEntryType,
  RefundStatus,
  WebhookEventStatus,
} from "@prisma/client";
import { commitOrderReservations, createStockReservation, returnOrderStock } from "../inventory/services";
import { isSandboxPaymentEnabled } from "@/lib/payment-methods";
import { recordRiskEvent } from "@/modules/risk/services";
import { RISK_RULES } from "@/modules/risk/config";

/**
 * Payment lifecycle.
 *
 * Invariants:
 * - Only a verified provider result (sandbox adapter capture, signed webhook, or the
 *   reconciliation job re-applying a recorded SUCCEEDED attempt) can mark an order PAID.
 *   No HTTP endpoint accepts a payment status from the browser.
 * - Applying a payment is one transaction under a row lock on the order: attempt, order,
 *   seller packages, stock commit and seller escrow change together or not at all.
 * - A payment is applied only to the order's own online attempt, for exactly its amount and
 *   currency. COD orders are never paid by online events.
 * - Money that arrives for a cancelled order or a FAILED/CANCELLED attempt never revives it:
 *   the event is recorded and a PENDING refund is created for finance.
 */

type TxClient = Prisma.TransactionClient;

const TX_OPTS = { timeout: 20000, maxWait: 10000 } as const;

export interface PaymentExecutionResult {
  success: boolean;
  transactionRef: string;
  errorMessage?: string;
}

export interface IPaymentProvider {
  authorizeAndCapture(
    amountMinor: number,
    currency: string,
    orderNumber: string,
    metadata?: Record<string, unknown>
  ): Promise<PaymentExecutionResult>;
  verifyWebhookSignature(rawBody: string, signature: string): boolean;
}

/**
 * Returns the configured webhook signing secret. There is deliberately NO
 * fallback value in production: an unset secret must reject every webhook rather
 * than accept signatures made with a publicly known default.
 */
function webhookSecret(): string | null {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret || secret.length < 16 || secret.startsWith("change_me")) {
    // Development convenience only; never in production.
    if (process.env.NODE_ENV !== "production") {
      return "local_dev_webhook_signing_secret_998877";
    }
    return null;
  }
  return secret;
}

/**
 * Sandboxed Test Payment Adapter for Local Development & Testing.
 * It is the only implemented provider; it is blocked in production by
 * isSandboxPaymentEnabled().
 */
class LocalSandboxPaymentProvider implements IPaymentProvider {
  async authorizeAndCapture(
    _amountMinor: number,
    _currency: string,
    orderNumber: string
  ): Promise<PaymentExecutionResult> {
    if (!isSandboxPaymentEnabled()) {
      return {
        success: false,
        transactionRef: `SANDBOX_DISABLED_${orderNumber}`,
        errorMessage: "The sandbox payment adapter is disabled in production.",
      };
    }
    return {
      success: true,
      transactionRef: `SANDBOX_TX_${orderNumber}_${Date.now()}`,
    };
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const secret = webhookSecret();
    if (!secret || !signature || typeof signature !== "string") return false;
    const expectedSig = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    const provided = signature.trim().toLowerCase();
    if (expectedSig.length !== provided.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(provided));
  }
}

export const paymentProvider: IPaymentProvider = new LocalSandboxPaymentProvider();

/**
 * Signs a webhook body the way the sandbox "provider" does. For local tooling and tests only;
 * refuses to run in production so the signing secret can never be used to mint events there.
 */
export function signSandboxWebhook(rawBody: string): string {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Sandbox webhook signing is not available in production.");
  }
  const secret = webhookSecret();
  if (!secret) throw new Error("PAYMENT_WEBHOOK_SECRET is not configured.");
  return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

export interface MarkPaidResult {
  success: boolean;
  alreadyPaid?: boolean;
  /** Payment arrived for an order that was already cancelled / could not be fulfilled: needs a manual refund. */
  requiresRefund?: boolean;
  transactionRef?: string;
  orderNumber: string;
}

interface PaymentInput {
  /** Identifies the PaymentAttempt this payment belongs to (the checkout idempotency key). */
  idempotencyKey?: string;
  transactionRef: string;
  /** Kept for backwards compatibility; the provider is taken from the order's own attempt. */
  provider?: PaymentAttemptProvider;
  amountMinor?: number;
  currency?: string;
  gatewayPayload?: unknown;
  source?: "sandbox" | "webhook" | "reconciliation" | "internal";
}

type ApplyOutcome =
  | { kind: "PAID"; orderNumber: string; transactionRef: string }
  | { kind: "ALREADY_PAID"; orderNumber: string; transactionRef: string }
  | { kind: "REFUND_REQUIRED"; orderNumber: string; transactionRef: string; refundCreated: boolean }
  | { kind: "REJECTED"; code: string; reason: string; orderNumber?: string };

async function lockOrderRow(tx: TxClient, orderId: string) {
  await tx.$queryRaw`SELECT id FROM "CustomerOrder" WHERE id = ${orderId} FOR UPDATE`;
}

const CLOSED_ATTEMPT: PaymentAttemptStatus[] = [PaymentAttemptStatus.FAILED, PaymentAttemptStatus.CANCELLED];

/**
 * Records a verified payment for an order. Idempotent and safe against concurrent
 * webhook + redirect + reconciliation processing: the order row is locked and the PAID
 * transition happens exactly once, inside one transaction.
 *
 * Only a verified provider event (or the sandbox adapter's own capture result)
 * may call this. A success-page redirect never does.
 */
export async function markOrderPaid(orderId: string, input: PaymentInput): Promise<MarkPaidResult> {
  const out = await prisma.$transaction((tx) => applyPayment(tx, orderId, input), TX_OPTS);
  return outcomeToResult(out);
}

function outcomeToResult(out: ApplyOutcome): MarkPaidResult {
  switch (out.kind) {
    case "PAID":
      return { success: true, orderNumber: out.orderNumber, transactionRef: out.transactionRef };
    case "ALREADY_PAID":
      return { success: true, alreadyPaid: true, orderNumber: out.orderNumber, transactionRef: out.transactionRef };
    case "REFUND_REQUIRED":
      return { success: true, requiresRefund: true, orderNumber: out.orderNumber, transactionRef: out.transactionRef };
    case "REJECTED":
      throw new Error(`${out.code}: ${out.reason}`);
  }
}

async function applyPayment(tx: TxClient, orderId: string, input: PaymentInput): Promise<ApplyOutcome> {
  await lockOrderRow(tx, orderId);

  const order = await tx.customerOrder.findUnique({
    where: { id: orderId },
    include: { sellerOrders: { include: { items: true } }, paymentAttempts: true },
  });
  if (!order) return { kind: "REJECTED", code: "PAYMENT_ORDER_NOT_FOUND", reason: "Order not found." };

  // 1. Resolve the attempt this payment belongs to.
  let attempt = input.idempotencyKey
    ? await tx.paymentAttempt.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
    : null;
  if (attempt && attempt.customerOrderId !== order.id) {
    return { kind: "REJECTED", code: "PAYMENT_ORDER_MISMATCH", reason: "The payment reference belongs to a different order.", orderNumber: order.orderNumber };
  }
  if (attempt && attempt.provider === PaymentAttemptProvider.COD) {
    return { kind: "REJECTED", code: "PAYMENT_NOT_ONLINE_ORDER", reason: "Cash-on-delivery orders cannot be paid by an online payment event.", orderNumber: order.orderNumber };
  }
  const onlineAttempts = order.paymentAttempts.filter((a) => a.provider !== PaymentAttemptProvider.COD);
  if (!attempt) {
    attempt =
      onlineAttempts.find((a) => a.status === PaymentAttemptStatus.SUCCEEDED && a.transactionRef === input.transactionRef) ??
      onlineAttempts.find((a) => a.status === PaymentAttemptStatus.PENDING) ??
      null;
  }
  if (!attempt && onlineAttempts.length === 0) {
    return { kind: "REJECTED", code: "PAYMENT_NOT_ONLINE_ORDER", reason: "This order has no online payment attempt.", orderNumber: order.orderNumber };
  }

  // 2. Amount, currency and order must match exactly what the server asked for.
  const expectedAmount = attempt ? attempt.amountMinor : order.totalMinor;
  const expectedCurrency = (attempt ? attempt.currency : order.currency).toUpperCase();
  if (attempt && attempt.amountMinor !== order.totalMinor) {
    return { kind: "REJECTED", code: "PAYMENT_AMOUNT_MISMATCH", reason: `Payment attempt amount ${attempt.amountMinor} differs from order total ${order.totalMinor}.`, orderNumber: order.orderNumber };
  }
  if (input.amountMinor !== undefined && input.amountMinor !== expectedAmount) {
    return { kind: "REJECTED", code: "PAYMENT_AMOUNT_MISMATCH", reason: `Provider reported ${input.amountMinor} but ${expectedAmount} was requested.`, orderNumber: order.orderNumber };
  }
  if (input.currency !== undefined && String(input.currency).toUpperCase() !== expectedCurrency) {
    return { kind: "REJECTED", code: "PAYMENT_CURRENCY_MISMATCH", reason: `Provider reported currency ${input.currency} but ${expectedCurrency} was requested.`, orderNumber: order.orderNumber };
  }

  if (order.paymentStatus === PaymentStatus.PAID || order.paymentStatus === PaymentStatus.REFUNDED) {
    return { kind: "ALREADY_PAID", orderNumber: order.orderNumber, transactionRef: input.transactionRef };
  }

  // 3. Money for an order that can no longer be fulfilled: record it and flag a refund.
  const lateReason =
    order.status === CustomerOrderStatus.CANCELLED
      ? "ORDER_CANCELLED"
      : !attempt
        ? "NO_OPEN_ATTEMPT"
        : CLOSED_ATTEMPT.includes(attempt.status)
          ? `ATTEMPT_${attempt.status}`
          : null;
  if (lateReason) return recordLatePayment(tx, order, attempt, input, lateReason);

  if (order.status !== CustomerOrderStatus.PENDING_PAYMENT) {
    return { kind: "REJECTED", code: "PAYMENT_STATE_INVALID", reason: `Order is ${order.status}, not awaiting payment.`, orderNumber: order.orderNumber };
  }

  // 4. Every item needs stock tied to this order. After a long delay the hold may have expired;
  // check availability first (rows locked) so a shortage cancels cleanly instead of aborting.
  const existingRes = await tx.inventoryReservation.findMany({
    where: { orderId: order.id, status: { in: ["ACTIVE", "COMMITTED"] } },
  });
  const covered = new Map<string, number>();
  for (const r of existingRes) covered.set(r.variantId, (covered.get(r.variantId) || 0) + r.reservedUnits);
  const needed = new Map<string, number>();
  for (const so of order.sellerOrders) {
    if (so.status === SellerOrderStatus.CANCELLED) continue;
    for (const item of so.items) {
      if (item.variantId) needed.set(item.variantId, (needed.get(item.variantId) || 0) + item.quantity);
    }
  }
  const missingLines = [...needed.entries()]
    .map(([variantId, qty]) => [variantId, qty - (covered.get(variantId) || 0)] as const)
    .filter(([, missing]) => missing > 0)
    .sort(([a], [b]) => a.localeCompare(b));
  for (const [variantId, missing] of missingLines) {
    const rows = await tx.$queryRaw<Array<{ availableUnits: number; reservedUnits: number }>>`
      SELECT "availableUnits", "reservedUnits" FROM "InventoryLevel" WHERE "variantId" = ${variantId} FOR UPDATE
    `;
    if (!rows[0] || rows[0].availableUnits - rows[0].reservedUnits < missing) {
      await cancelUnpaidOrder(tx, order.id, "Payment arrived after the stock hold expired and the items sold out; order cancelled, refund required.", PaymentAttemptStatus.CANCELLED, { ignoreSucceededAttempts: true });
      return recordLatePayment(tx, order, attempt, input, "STOCK_UNAVAILABLE");
    }
  }
  for (const [variantId, missing] of missingLines) {
    await createStockReservation(variantId, missing, undefined, order.id, 1, tx);
  }

  // 5. Apply: attempt, stock, order, packages, escrow.
  const gatewayJson = input.gatewayPayload ? JSON.stringify(input.gatewayPayload).slice(0, 20000) : undefined;
  const marked = await tx.paymentAttempt.updateMany({
    where: { id: attempt!.id, status: { in: [PaymentAttemptStatus.PENDING, PaymentAttemptStatus.SUCCEEDED] } },
    data: { status: PaymentAttemptStatus.SUCCEEDED, transactionRef: input.transactionRef, ...(gatewayJson ? { rawGatewayResponseJson: gatewayJson } : {}) },
  });
  if (marked.count !== 1) {
    // The attempt was closed concurrently; abort so the caller retries and takes the late-payment path.
    throw new Error("PAYMENT_ATTEMPT_STATE_CHANGED: The payment attempt changed while being applied. Retry.");
  }

  await commitOrderReservations(order.id, tx);

  await tx.customerOrder.update({
    where: { id: order.id },
    data: { paymentStatus: PaymentStatus.PAID, status: CustomerOrderStatus.PROCESSING },
  });

  await tx.sellerOrder.updateMany({
    where: { customerOrderId: order.id, status: SellerOrderStatus.PENDING_PAYMENT },
    data: { status: SellerOrderStatus.CONFIRMED },
  });

  for (const so of order.sellerOrders) {
    if (so.status === SellerOrderStatus.CANCELLED) {
      // The customer paid the full order total, including a package cancelled before payment.
      const prior = await tx.refund.aggregate({
        where: { sellerOrderId: so.id, status: { not: RefundStatus.FAILED } },
        _sum: { amountMinor: true },
      });
      const owed = so.totalMinor - (prior._sum.amountMinor || 0);
      if (owed > 0) {
        await tx.refund.create({
          data: {
            customerOrderId: order.id,
            sellerOrderId: so.id,
            paymentAttemptId: attempt!.id,
            amountMinor: owed,
            currency: order.currency,
            status: RefundStatus.PENDING,
            reason: `Package ${so.sellerOrderNumber} was cancelled before payment ${input.transactionRef} was captured.`,
          },
        });
      }
      continue;
    }
    await notifySellerMembers(tx, so.sellerOrgId, {
      title: "New paid order to fulfil",
      message: `Package ${so.sellerOrderNumber} has been paid online. Pack and dispatch it from Orders.`,
      type: "ORDER",
      linkUrl: `/seller/portal/orders/${so.id}`,
    });
    const existingLedger = await tx.settlementLedger.findFirst({
      where: { sellerOrderId: so.id, entryType: SettlementEntryType.ORDER_CREDIT },
    });
    if (existingLedger) continue;
    await tx.settlementLedger.create({
      data: {
        sellerOrgId: so.sellerOrgId,
        sellerOrderId: so.id,
        entryType: SettlementEntryType.ORDER_CREDIT,
        amountMinor: so.netSellerPayableMinor,
        balanceAfterMinor: so.netSellerPayableMinor,
        status: SettlementStatus.IN_ESCROW,
        description: `Escrow hold for order package #${so.sellerOrderNumber}`,
        holdReason: "Awaiting fulfillment and delivery",
      },
    });
  }

  await tx.auditEvent.create({
    data: {
      entityType: "CustomerOrder",
      entityId: order.id,
      action: "PAYMENT_CAPTURED",
      detailsJson: JSON.stringify({
        source: input.source ?? "internal",
        attemptId: attempt!.id,
        transactionRef: input.transactionRef,
        amountMinor: expectedAmount,
        currency: expectedCurrency,
      }),
    },
  });

  return { kind: "PAID", orderNumber: order.orderNumber, transactionRef: input.transactionRef };
}

async function recordLatePayment(
  tx: TxClient,
  order: { id: string; orderNumber: string; totalMinor: number; currency: string },
  attempt: { id: string; amountMinor: number } | null,
  input: PaymentInput,
  reason: string
): Promise<ApplyOutcome> {
  const amount = input.amountMinor ?? attempt?.amountMinor ?? order.totalMinor;
  const prefix = `LATE_PAYMENT ${input.transactionRef}`;
  const existing = await tx.refund.findFirst({
    where: {
      customerOrderId: order.id,
      OR: [
        { reason: { startsWith: prefix } },
        ...(attempt ? [{ paymentAttemptId: attempt.id, reason: { startsWith: "LATE_PAYMENT" } }] : []),
      ],
    },
  });
  if (!existing) {
    await tx.refund.create({
      data: {
        customerOrderId: order.id,
        paymentAttemptId: attempt?.id ?? null,
        amountMinor: amount,
        currency: (input.currency || order.currency).toUpperCase(),
        status: RefundStatus.PENDING,
        reason: `${prefix}: payment received after the order could no longer be fulfilled (${reason}). Refund it via the payment provider.`,
      },
    });
    await tx.auditEvent.create({
      data: {
        entityType: "CustomerOrder",
        entityId: order.id,
        action: "PAYMENT_AFTER_CANCELLATION",
        detailsJson: JSON.stringify({ transactionRef: input.transactionRef, amountMinor: amount, reason, attemptId: attempt?.id ?? null, source: input.source ?? "internal" }),
      },
    });
  }
  return { kind: "REFUND_REQUIRED", orderNumber: order.orderNumber, transactionRef: input.transactionRef, refundCreated: !existing };
}

/**
 * Cancels an unpaid online order that is still awaiting payment: releases stock, restores
 * coupon usage and closes pending attempts. Never touches a paid order, a COD order (those
 * are PROCESSING from placement), or an order with a recorded successful capture that has
 * not been applied yet (the reconciliation job applies it instead).
 */
export async function cancelUnpaidOrder(
  tx: TxClient,
  orderId: string,
  reason: string,
  attemptStatus: PaymentAttemptStatus = PaymentAttemptStatus.CANCELLED,
  opts: { ignoreSucceededAttempts?: boolean } = {}
) {
  await lockOrderRow(tx, orderId);
  const order = await tx.customerOrder.findUnique({ where: { id: orderId }, include: { paymentAttempts: true } });
  if (!order) return { cancelled: false };
  if (
    order.paymentStatus === PaymentStatus.PAID ||
    order.paymentStatus === PaymentStatus.REFUNDED ||
    order.status !== CustomerOrderStatus.PENDING_PAYMENT
  ) {
    return { cancelled: false };
  }
  if (!opts.ignoreSucceededAttempts && order.paymentAttempts.some((a) => a.status === PaymentAttemptStatus.SUCCEEDED)) {
    return { cancelled: false, reason: "PAYMENT_SUCCEEDED_NOT_APPLIED" };
  }

  await returnOrderStock(order.id, tx, { reason });

  await tx.customerOrder.update({
    where: { id: order.id },
    data: {
      status: CustomerOrderStatus.CANCELLED,
      paymentStatus: attemptStatus === PaymentAttemptStatus.FAILED ? PaymentStatus.FAILED : PaymentStatus.UNPAID,
      notes: reason,
    },
  });
  await tx.sellerOrder.updateMany({
    where: { customerOrderId: order.id },
    data: { status: SellerOrderStatus.CANCELLED, netSellerPayableMinor: 0 },
  });
  await tx.paymentAttempt.updateMany({
    where: { customerOrderId: order.id, status: PaymentAttemptStatus.PENDING },
    data: { status: attemptStatus },
  });
  if (order.couponCode) {
    await tx.coupon.updateMany({
      where: { code: order.couponCode, timesUsed: { gt: 0 } },
      data: { timesUsed: { decrement: 1 } },
    });
  }
  await tx.auditEvent.create({
    data: {
      entityType: "CustomerOrder",
      entityId: order.id,
      action: "UNPAID_ORDER_CANCELLED",
      detailsJson: JSON.stringify({ reason }),
    },
  });
  return { cancelled: true };
}

/**
 * Sweeper: online-payment orders still PENDING_PAYMENT past the reservation window
 * are cancelled and their stock is returned (timeout handling). Orders with a recorded
 * successful capture are skipped: reconcilePayments() applies those.
 */
export async function cancelExpiredUnpaidOrders(graceMinutes = 30) {
  const cutoff = new Date(Date.now() - graceMinutes * 60 * 1000);
  const stale = await prisma.customerOrder.findMany({
    where: {
      status: CustomerOrderStatus.PENDING_PAYMENT,
      paymentStatus: PaymentStatus.UNPAID,
      createdAt: { lt: cutoff },
      paymentAttempts: { none: { status: PaymentAttemptStatus.SUCCEEDED } },
    },
    select: { id: true },
    take: 100,
  });
  let cancelled = 0;
  for (const o of stale) {
    const r = await prisma.$transaction(
      (tx) => cancelUnpaidOrder(tx, o.id, "Payment not completed in time; order cancelled automatically."),
      TX_OPTS
    );
    if (r.cancelled) cancelled++;
  }
  return { cancelled };
}

/** The checkout payment method of an order, derived from its own payment attempts. */
export async function getOrderPaymentMethod(orderId: string): Promise<"CASH_ON_DELIVERY" | "ONLINE_SANDBOX"> {
  const cod = await prisma.paymentAttempt.findFirst({
    where: { customerOrderId: orderId, provider: PaymentAttemptProvider.COD },
    select: { id: true },
  });
  return cod ? "CASH_ON_DELIVERY" : "ONLINE_SANDBOX";
}

/**
 * Sandbox capture used by the checkout route in non-production environments.
 *
 * - Server-enforced: refuses when the sandbox adapter is disabled (always in production).
 * - Only the caller's own order, only while it awaits online payment, only for the amount the
 *   server recorded on the order's own LOCAL_SANDBOX attempt.
 * - The provider's success is written to the attempt BEFORE it is applied, so a crash in
 *   between leaves a SUCCEEDED attempt that reconcilePayments() applies later.
 */
export async function executeOrderPayment(
  orderId: string,
  idempotencyKey: string,
  caller?: { userId?: string | null }
) {
  if (!isSandboxPaymentEnabled()) {
    throw new Error("PAYMENT_METHOD_UNAVAILABLE: Online payment is not available.");
  }

  const order = await prisma.customerOrder.findUnique({ where: { id: orderId }, include: { paymentAttempts: true } });
  if (!order) throw new Error("Order not found.");
  if (caller && (order.customerUserId ?? null) !== (caller.userId ?? null)) {
    throw new Error("FORBIDDEN: You can only pay for your own orders.");
  }

  if (order.paymentStatus === PaymentStatus.PAID) {
    return { success: true, message: "Order is already paid.", orderNumber: order.orderNumber };
  }
  if (order.status !== CustomerOrderStatus.PENDING_PAYMENT || order.paymentStatus !== PaymentStatus.UNPAID) {
    throw new Error("VALIDATION: This order is not awaiting online payment.");
  }

  let attempt = order.paymentAttempts.find((a) => a.idempotencyKey === idempotencyKey) ?? null;
  if (attempt && attempt.provider !== PaymentAttemptProvider.LOCAL_SANDBOX) {
    throw new Error("VALIDATION: This order is not an online-payment order.");
  }
  if (!attempt) {
    attempt =
      order.paymentAttempts.find(
        (a) => a.provider === PaymentAttemptProvider.LOCAL_SANDBOX && a.status === PaymentAttemptStatus.PENDING
      ) ?? null;
  }
  if (!attempt) throw new Error("VALIDATION: This order has no open online payment.");
  if (CLOSED_ATTEMPT.includes(attempt.status)) {
    return {
      success: false,
      orderNumber: order.orderNumber,
      message: "This payment attempt did not go through. Please place your order again.",
    };
  }
  if (attempt.amountMinor !== order.totalMinor || attempt.currency !== order.currency) {
    throw new Error("PAYMENT_AMOUNT_MISMATCH: The payment amount does not match the order total.");
  }

  let transactionRef = attempt.transactionRef || "";
  if (attempt.status === PaymentAttemptStatus.PENDING) {
    const result = await paymentProvider.authorizeAndCapture(attempt.amountMinor, attempt.currency, order.orderNumber, {
      attemptId: attempt.id,
      idempotencyKey: attempt.idempotencyKey,
    });

    if (!result.success) {
      await prisma.paymentAttempt.updateMany({
        where: { id: attempt.id, status: PaymentAttemptStatus.PENDING },
        data: { status: PaymentAttemptStatus.FAILED, transactionRef: result.transactionRef },
      });
      return { success: false, transactionRef: result.transactionRef, orderNumber: order.orderNumber, message: result.errorMessage };
    }

    // Durably record the provider's success before applying it.
    const recorded = await prisma.paymentAttempt.updateMany({
      where: { id: attempt.id, status: PaymentAttemptStatus.PENDING },
      data: { status: PaymentAttemptStatus.SUCCEEDED, transactionRef: result.transactionRef },
    });
    transactionRef = result.transactionRef;
    if (recorded.count !== 1) {
      const fresh = await prisma.paymentAttempt.findUnique({ where: { id: attempt.id } });
      if (fresh?.status !== PaymentAttemptStatus.SUCCEEDED) {
        return { success: false, orderNumber: order.orderNumber, message: "The payment state changed. Please refresh the order page." };
      }
      transactionRef = fresh.transactionRef || transactionRef;
    }
  }

  try {
    const paid = await markOrderPaid(orderId, {
      idempotencyKey: attempt.idempotencyKey,
      transactionRef,
      amountMinor: attempt.amountMinor,
      currency: attempt.currency,
      source: "sandbox",
    });
    return {
      success: paid.success && !paid.requiresRefund,
      requiresRefund: paid.requiresRefund || undefined,
      transactionRef,
      orderNumber: paid.orderNumber,
    };
  } catch (err) {
    // The capture is recorded on the attempt; the maintenance job applies it.
    console.error("[payments] capture recorded but not applied yet", orderId, err instanceof Error ? err.message : err);
    return {
      success: true,
      pendingConfirmation: true,
      transactionRef,
      orderNumber: order.orderNumber,
      message: "Payment received. Your order will be confirmed shortly.",
    };
  }
}

// ---------------------------------------------------------------------------------------------
// Refund guard and chargebacks
// ---------------------------------------------------------------------------------------------

/**
 * Guard for every customer refund: the order must be paid (an unpaid COD order has nothing to
 * refund) and the sum of non-failed refunds may never exceed what was paid for the order, nor
 * for the seller package when one is given. Call inside the transaction that creates the refund.
 */
export async function assertRefundWithinPaid(
  tx: TxClient,
  input: {
    customerOrderId: string;
    sellerOrderId?: string | null;
    amountMinor: number;
    excludeRefundId?: string;
    /** false only for system refunds of money that arrived for an unpaid/cancelled order (LATE_PAYMENT). */
    requirePaid?: boolean;
  }
) {
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error("VALIDATION: Refund amount must be a positive whole amount.");
  }
  const order = await tx.customerOrder.findUnique({
    where: { id: input.customerOrderId },
    select: { paymentStatus: true, totalMinor: true, sellerOrders: { select: { id: true, totalMinor: true } } },
  });
  if (!order) throw new Error("Order not found.");
  if (order.paymentStatus === PaymentStatus.REFUNDED) {
    throw new Error("VALIDATION: This order has already been fully refunded.");
  }
  if (input.requirePaid !== false && order.paymentStatus !== PaymentStatus.PAID) {
    throw new Error("VALIDATION: This order has not been paid yet, so there is nothing to refund.");
  }
  const refunds = await tx.refund.findMany({
    where: {
      customerOrderId: input.customerOrderId,
      status: { not: RefundStatus.FAILED },
      ...(input.excludeRefundId ? { id: { not: input.excludeRefundId } } : {}),
    },
    select: { amountMinor: true, sellerOrderId: true },
  });
  const orderRefunded = refunds.reduce((s, r) => s + r.amountMinor, 0);
  if (orderRefunded + input.amountMinor > order.totalMinor) {
    throw new Error(
      `VALIDATION: This refund would exceed the amount paid. At most Rs. ${(Math.max(0, order.totalMinor - orderRefunded) / 100).toLocaleString("en-PK")} can still be refunded on this order.`
    );
  }
  let remainingPackageMinor: number | null = null;
  if (input.sellerOrderId) {
    const pkg = order.sellerOrders.find((s) => s.id === input.sellerOrderId);
    if (!pkg) throw new Error("VALIDATION: That package is not part of this order.");
    const pkgRefunded = refunds.filter((r) => r.sellerOrderId === pkg.id).reduce((s, r) => s + r.amountMinor, 0);
    if (pkgRefunded + input.amountMinor > pkg.totalMinor) {
      throw new Error(
        `VALIDATION: This refund would exceed what was paid for the package. At most Rs. ${(Math.max(0, pkg.totalMinor - pkgRefunded) / 100).toLocaleString("en-PK")} can still be refunded for it.`
      );
    }
    remainingPackageMinor = pkg.totalMinor - pkgRefunded - input.amountMinor;
  }
  return { remainingOrderMinor: order.totalMinor - orderRefunded - input.amountMinor, remainingPackageMinor };
}

/** Splits `amount` across parts in proportion to their weights; the parts sum exactly to `amount`. */
function allocateProRata(amount: number, parts: Array<{ id: string; weight: number }>) {
  const result = new Map<string, number>();
  const total = parts.reduce((s, p) => s + p.weight, 0);
  if (amount <= 0 || total <= 0) {
    parts.forEach((p) => result.set(p.id, 0));
    return result;
  }
  let allocated = 0;
  for (const p of parts) {
    const share = Math.floor((p.weight * amount) / total);
    result.set(p.id, share);
    allocated += share;
  }
  const sorted = [...parts].sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
  for (let i = 0; allocated < amount; i = (i + 1) % sorted.length) {
    result.set(sorted[i].id, (result.get(sorted[i].id) || 0) + 1);
    allocated++;
  }
  return result;
}

export type ChargebackResult =
  | { ok: true; alreadyRecorded: true; refundId: string }
  | {
      ok: true;
      alreadyRecorded: false;
      refundId: string;
      sellerDebits: Array<{ sellerOrderId: string; sellerOrgId: string; debitMinor: number; ledgerEntryId: string | null }>;
      overRefundedMinor: number;
    }
  | { ok: false; reason: string };

/**
 * Records a card chargeback / payment dispute (idempotent by provider reference):
 *  - a SUCCEEDED Refund (the network already pulled the money back), ref "CHARGEBACK:<ref>";
 *  - per seller package, a HELD negative ADJUSTMENT ledger entry for the seller's share
 *    (net of commission, like return refunds), and unsettled package credits are put on HOLD;
 *  - a CHARGEBACK_RECORDED audit event and a RISK_CHARGEBACK review flag.
 * Finance later either releases the holds (dispute won: reverse the ADJUSTMENT) or makes the
 * ADJUSTMENT ELIGIBLE so it reduces the next payout (dispute lost).
 */
export async function recordChargeback(
  orderId: string,
  amountMinor: number,
  providerRef: string,
  opts: { eventId?: string; actorUserId?: string } = {}
) {
  const result = await prisma.$transaction((tx) => recordChargebackInTx(tx, orderId, amountMinor, providerRef, opts), TX_OPTS);
  if (!result.ok) throw new Error(`VALIDATION: ${result.reason}`);
  return result;
}

async function recordChargebackInTx(
  tx: TxClient,
  orderId: string,
  amountMinor: number,
  providerRef: string,
  opts: { eventId?: string; actorUserId?: string }
): Promise<ChargebackResult> {
  const ref = String(providerRef || "").trim();
  if (ref.length < 3 || ref.length > 120) return { ok: false, reason: "A provider dispute reference (3-120 characters) is required." };
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) return { ok: false, reason: "Chargeback amount must be a positive whole amount." };

  await lockOrderRow(tx, orderId);
  const order = await tx.customerOrder.findUnique({
    where: { id: orderId },
    include: { sellerOrders: true, paymentAttempts: true, refunds: true },
  });
  if (!order) return { ok: false, reason: "Order not found." };

  const externalRef = `CHARGEBACK:${ref}`;
  const existing = order.refunds.find((r) => r.externalRefundRef === externalRef);
  if (existing) return { ok: true, alreadyRecorded: true, refundId: existing.id };

  const captured = order.paymentAttempts.find(
    (a) => a.provider !== PaymentAttemptProvider.COD && a.status === PaymentAttemptStatus.SUCCEEDED
  );
  if (!captured || (order.paymentStatus !== PaymentStatus.PAID && order.paymentStatus !== PaymentStatus.REFUNDED)) {
    return { ok: false, reason: "Chargebacks can only be recorded for orders paid online." };
  }
  if (amountMinor > captured.amountMinor) {
    return { ok: false, reason: "The chargeback amount exceeds the captured payment." };
  }

  const priorRefunded = order.refunds.filter((r) => r.status !== RefundStatus.FAILED).reduce((s, r) => s + r.amountMinor, 0);
  const overRefundedMinor = Math.max(0, priorRefunded + amountMinor - captured.amountMinor);

  const refund = await tx.refund.create({
    data: {
      customerOrderId: order.id,
      paymentAttemptId: captured.id,
      amountMinor,
      currency: captured.currency,
      status: RefundStatus.SUCCEEDED,
      reason: `CHARGEBACK: payment dispute ${ref} opened with the provider${opts.eventId ? ` (event ${opts.eventId})` : ""}.`,
      externalRefundRef: externalRef,
    },
  });

  const active = order.sellerOrders.filter((so) => so.status !== SellerOrderStatus.CANCELLED);
  const packages = active.length > 0 ? active : order.sellerOrders;
  const shares = allocateProRata(amountMinor, packages.map((p) => ({ id: p.id, weight: p.totalMinor })));
  const holdReason = `Chargeback ${ref}: funds held until the dispute is resolved`;
  const sellerDebits: Array<{ sellerOrderId: string; sellerOrgId: string; debitMinor: number; ledgerEntryId: string | null }> = [];

  // Return refunds already reduced netSellerPayableMinor; the seller's original share of the
  // package is that plus the refund debits, and their remaining exposure is the current value.
  const refundDebits = await tx.settlementLedger.findMany({
    where: { sellerOrderId: { in: packages.map((p) => p.id) }, entryType: SettlementEntryType.REFUND_DEBIT },
    select: { sellerOrderId: true, amountMinor: true },
  });
  for (const pkg of packages) {
    const share = shares.get(pkg.id) || 0;
    if (share <= 0) continue;
    const alreadyDebited = refundDebits.filter((d) => d.sellerOrderId === pkg.id).reduce((s, d) => s - d.amountMinor, 0);
    const originalNet = pkg.netSellerPayableMinor + alreadyDebited;
    const debit =
      pkg.totalMinor > 0
        ? Math.max(0, Math.min(pkg.netSellerPayableMinor, Math.round((share * originalNet) / pkg.totalMinor)))
        : 0;
    await tx.settlementLedger.updateMany({
      where: {
        sellerOrderId: pkg.id,
        amountMinor: { gt: 0 },
        status: { in: [SettlementStatus.PENDING, SettlementStatus.IN_ESCROW, SettlementStatus.ELIGIBLE] },
      },
      data: { status: SettlementStatus.HELD, holdReason },
    });
    let ledgerEntryId: string | null = null;
    if (debit > 0) {
      const entry = await tx.settlementLedger.create({
        data: {
          sellerOrgId: pkg.sellerOrgId,
          sellerOrderId: pkg.id,
          entryType: SettlementEntryType.ADJUSTMENT,
          amountMinor: -debit,
          balanceAfterMinor: 0,
          status: SettlementStatus.HELD,
          holdReason,
          description: `Chargeback ${ref} on order ${order.orderNumber}, package ${pkg.sellerOrderNumber}`,
          referenceId: ref,
          actorUserId: opts.actorUserId ?? null,
        },
      });
      ledgerEntryId = entry.id;
    }
    sellerDebits.push({ sellerOrderId: pkg.id, sellerOrgId: pkg.sellerOrgId, debitMinor: debit, ledgerEntryId });
  }

  await tx.auditEvent.create({
    data: {
      actorUserId: opts.actorUserId ?? null,
      entityType: "CustomerOrder",
      entityId: order.id,
      action: "CHARGEBACK_RECORDED",
      detailsJson: JSON.stringify({ providerRef: ref, eventId: opts.eventId ?? null, amountMinor, refundId: refund.id, sellerDebits, overRefundedMinor }),
    },
  });
  await recordRiskEvent(tx, {
    rule: RISK_RULES.CHARGEBACK,
    decision: "FLAGGED",
    message:
      overRefundedMinor > 0
        ? `Chargeback ${ref} of ${amountMinor} on an order that was already refunded: ${overRefundedMinor} refunded twice. Recover it from the provider dispute.`
        : `Chargeback ${ref} of ${amountMinor}. Seller funds are held until the dispute is resolved.`,
    identity: { userId: order.customerUserId, email: order.customerEmail, phone: order.customerPhone },
    orderId: order.id,
    orderNumber: order.orderNumber,
    metrics: { amountMinor, providerRef: ref, overRefundedMinor },
  });

  return { ok: true, alreadyRecorded: false, refundId: refund.id, sellerDebits, overRefundedMinor };
}

// ---------------------------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------------------------

export const SUCCESS_EVENTS = new Set(["payment_intent.succeeded", "payment.captured"]);
export const FAILURE_EVENTS = new Set(["payment_intent.payment_failed", "payment.failed", "payment.cancelled"]);
export const DISPUTE_EVENTS = new Set(["charge.dispute.created", "payment.dispute.created"]);

export interface WebhookOutcome {
  status: "PROCESSED" | "IGNORED" | "REJECTED" | "ALREADY_PROCESSED";
  reason?: string;
  alreadyPaid?: boolean;
  requiresRefund?: boolean;
  cancelled?: boolean;
  chargebackRefundId?: string;
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const int = (v: unknown) => (typeof v === "number" && Number.isInteger(v) ? v : undefined);

async function rejectPaymentEvent(
  tx: TxClient,
  eventId: string,
  eventType: string,
  orderId: string,
  code: string,
  reason: string
): Promise<WebhookOutcome> {
  const order = await tx.customerOrder.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true, customerUserId: true, customerEmail: true, customerPhone: true },
  });
  await recordRiskEvent(tx, {
    rule: RISK_RULES.PAYMENT_MISMATCH,
    decision: "FLAGGED",
    message: `Payment event ${eventType} (${eventId}) rejected: ${reason}`,
    identity: order ? { userId: order.customerUserId, email: order.customerEmail, phone: order.customerPhone } : undefined,
    orderId: order?.id ?? null,
    orderNumber: order?.orderNumber ?? null,
    metrics: { code, eventId, eventType },
  });
  return { status: "REJECTED", reason: code };
}

async function applyWebhookEvent(
  tx: TxClient,
  eventId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<WebhookOutcome> {
  const orderId = str(payload.orderId);

  if (SUCCESS_EVENTS.has(eventType)) {
    if (!orderId) return { status: "IGNORED", reason: "MISSING_ORDER_ID" };
    const out = await applyPayment(tx, orderId, {
      idempotencyKey: str(payload.idempotencyKey),
      transactionRef: str(payload.transactionRef) || `WEBHOOK_${eventId}`,
      amountMinor: int(payload.amountMinor),
      currency: str(payload.currency),
      gatewayPayload: payload,
      source: "webhook",
    });
    if (out.kind === "REJECTED") return rejectPaymentEvent(tx, eventId, eventType, orderId, out.code, out.reason);
    if (out.kind === "ALREADY_PAID") return { status: "PROCESSED", alreadyPaid: true };
    if (out.kind === "REFUND_REQUIRED") return { status: "PROCESSED", requiresRefund: true };
    return { status: "PROCESSED" };
  }

  if (FAILURE_EVENTS.has(eventType)) {
    if (!orderId) return { status: "IGNORED", reason: "MISSING_ORDER_ID" };
    await lockOrderRow(tx, orderId);
    const order = await tx.customerOrder.findUnique({ where: { id: orderId }, include: { paymentAttempts: true } });
    if (!order) return { status: "IGNORED", reason: "ORDER_NOT_FOUND" };
    const key = str(payload.idempotencyKey);
    const online = order.paymentAttempts.filter((a) => a.provider !== PaymentAttemptProvider.COD);
    const attempt = key ? order.paymentAttempts.find((a) => a.idempotencyKey === key) : online.find((a) => a.status === PaymentAttemptStatus.PENDING);
    if (key && !attempt) {
      return rejectPaymentEvent(tx, eventId, eventType, orderId, "PAYMENT_ORDER_MISMATCH", "The payment reference does not belong to this order.");
    }
    if (attempt?.provider === PaymentAttemptProvider.COD || online.length === 0) {
      return rejectPaymentEvent(tx, eventId, eventType, orderId, "PAYMENT_NOT_ONLINE_ORDER", "Cash-on-delivery orders are not affected by online payment events.");
    }
    // Out-of-order protection: a failure arriving after success never downgrades a paid order.
    if (order.paymentStatus === PaymentStatus.PAID || order.paymentStatus === PaymentStatus.REFUNDED) {
      return { status: "IGNORED", reason: "ORDER_ALREADY_PAID" };
    }
    if (attempt?.status === PaymentAttemptStatus.SUCCEEDED) return { status: "IGNORED", reason: "ATTEMPT_ALREADY_SUCCEEDED" };
    if (attempt?.status === PaymentAttemptStatus.PENDING) {
      await tx.paymentAttempt.updateMany({ where: { id: attempt.id, status: PaymentAttemptStatus.PENDING }, data: { status: PaymentAttemptStatus.FAILED } });
    }
    const res = await cancelUnpaidOrder(tx, orderId, `Payment ${eventType} reported by provider.`, PaymentAttemptStatus.FAILED);
    return { status: "PROCESSED", cancelled: res.cancelled };
  }

  if (DISPUTE_EVENTS.has(eventType)) {
    const amount = int(payload.amountMinor);
    if (!orderId || amount === undefined) return { status: "IGNORED", reason: "MISSING_ORDER_OR_AMOUNT" };
    const ref = str(payload.disputeId) || str(payload.transactionRef) || eventId;
    const res = await recordChargebackInTx(tx, orderId, amount, ref, { eventId });
    if (!res.ok) return rejectPaymentEvent(tx, eventId, eventType, orderId, "CHARGEBACK_NOT_APPLICABLE", res.reason);
    return { status: "PROCESSED", chargebackRefundId: res.refundId };
  }

  return { status: "IGNORED", reason: "UNHANDLED_EVENT_TYPE" };
}

async function markWebhookFailed(provider: string, externalEventId: string, eventType: string, payload: Record<string, unknown>) {
  try {
    const updated = await prisma.webhookEvent.updateMany({
      where: { externalEventId, status: WebhookEventStatus.FAILED },
      data: { processedAt: new Date() },
    });
    if (updated.count === 0) {
      await prisma.webhookEvent.create({
        data: { provider, externalEventId, eventType, payloadJson: JSON.stringify(payload), status: WebhookEventStatus.FAILED },
      });
    }
  } catch {
    // Row exists in another state (processed concurrently) or the database is down: nothing to record.
  }
}

/**
 * Idempotent webhook processing core. Callers exposed to HTTP must use
 * ingestPaymentWebhook(), which makes the signature mandatory.
 *
 * The event claim (unique external ID) and its business effect commit in ONE transaction:
 * either both happen or neither does. On any internal failure the transaction rolls back, the
 * event is stored as FAILED (for visibility and the reconciliation job) and the error is
 * rethrown so the HTTP layer answers 5xx and the provider retries.
 */
export async function processPaymentWebhook(
  provider: string,
  externalEventId: string,
  eventType: string,
  payload: Record<string, unknown>,
  signatureHeader?: string,
  rawBody?: string
): Promise<WebhookOutcome> {
  // When a signature is supplied it must verify.
  if (signatureHeader || rawBody) {
    const isValid = Boolean(signatureHeader && rawBody) && paymentProvider.verifyWebhookSignature(rawBody!, signatureHeader!);
    if (!isValid) {
      throw new Error("INVALID_WEBHOOK_SIGNATURE: Payment webhook signature verification failed.");
    }
  }

  const existing = await prisma.webhookEvent.findUnique({ where: { externalEventId } });
  if (existing && existing.status !== WebhookEventStatus.FAILED) {
    return { status: "ALREADY_PROCESSED" };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      if (existing) {
        const claimed = await tx.webhookEvent.updateMany({
          where: { externalEventId, status: WebhookEventStatus.FAILED },
          data: { status: WebhookEventStatus.PROCESSED, processedAt: new Date() },
        });
        if (claimed.count === 0) return { status: "ALREADY_PROCESSED" } as WebhookOutcome;
      } else {
        // A concurrent duplicate blocks on the unique index until this transaction ends.
        await tx.webhookEvent.create({
          data: {
            provider,
            externalEventId,
            eventType,
            payloadJson: JSON.stringify(payload),
            status: WebhookEventStatus.PROCESSED,
          },
        });
      }

      const outcome = await applyWebhookEvent(tx, externalEventId, eventType, payload);
      if (outcome.status === "IGNORED" || outcome.status === "REJECTED") {
        await tx.webhookEvent.update({ where: { externalEventId }, data: { status: WebhookEventStatus.IGNORED } });
      }
      return outcome;
    }, TX_OPTS);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { status: "ALREADY_PROCESSED" };
    }
    await markWebhookFailed(provider, externalEventId, eventType, payload);
    throw err;
  }
}

/**
 * HTTP-facing entry point: the HMAC signature over the exact raw body is mandatory and is
 * checked before the body is parsed or anything is read from the database.
 * Body contract: { id, type, provider?, data: { orderId, amountMinor, currency, idempotencyKey?, transactionRef?, disputeId? } }
 */
export async function ingestPaymentWebhook(rawBody: string, signature: string | null | undefined) {
  if (!signature || !paymentProvider.verifyWebhookSignature(rawBody, signature)) {
    throw new Error("INVALID_WEBHOOK_SIGNATURE: Payment webhook signature verification failed.");
  }

  let parsed: { id?: unknown; type?: unknown; provider?: unknown; data?: unknown };
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new Error("INVALID_WEBHOOK_PAYLOAD: Body is not valid JSON.");
  }
  if (typeof parsed.id !== "string" || !parsed.id || parsed.id.length > 200 || typeof parsed.type !== "string" || typeof parsed.data !== "object" || !parsed.data) {
    throw new Error("INVALID_WEBHOOK_PAYLOAD: Expected { id, type, data }.");
  }
  const data = parsed.data as Record<string, unknown>;
  if (SUCCESS_EVENTS.has(parsed.type) || DISPUTE_EVENTS.has(parsed.type)) {
    if (typeof data.orderId !== "string" || int(data.amountMinor) === undefined || typeof data.currency !== "string") {
      throw new Error("INVALID_WEBHOOK_PAYLOAD: Payment events must include data.orderId, data.amountMinor (integer) and data.currency.");
    }
  }

  return processPaymentWebhook(
    typeof parsed.provider === "string" ? parsed.provider.slice(0, 40) : "LOCAL_SANDBOX",
    parsed.id,
    parsed.type,
    data,
    signature,
    rawBody
  );
}

// ---------------------------------------------------------------------------------------------
// Reconciliation ("payment succeeded but the app failed to update the order")
// ---------------------------------------------------------------------------------------------

async function reconciliationAudit(entityType: string, entityId: string, action: string, details: Record<string, unknown>) {
  await prisma.auditEvent
    .create({ data: { entityType, entityId, action, detailsJson: JSON.stringify(details) } })
    .catch((e) => console.error("[reconcile] audit write failed", e instanceof Error ? e.message : e));
}

/**
 * Maintenance step, run before unpaid-order expiry:
 *  1. Online PaymentAttempts marked SUCCEEDED whose order is not PAID → capture re-applied
 *     idempotently (or, for a cancelled order, a refund is flagged).
 *  2. Webhook events stored as FAILED (older than 2 minutes, at most 7 days) → re-processed.
 *  3. Success webhook events stored as PROCESSED whose order still awaits payment → re-applied.
 * Every action writes an audit event.
 */
export async function reconcilePayments(opts: { limit?: number } = {}) {
  // Newest first so a fresh stuck capture is never starved by old anomalies (those are flagged
  // once with PAYMENT_RECONCILIATION_REJECTED and excluded from later runs).
  const limit = opts.limit ?? 50;
  const summary = { capturesApplied: 0, refundsFlagged: 0, webhooksReprocessed: 0, errors: 0 };

  // 1. Recorded captures not applied to their order.
  const stuck = await prisma.$queryRaw<
    Array<{ id: string; customerOrderId: string; idempotencyKey: string; transactionRef: string | null; amountMinor: number; currency: string }>
  >`
    SELECT pa.id, pa."customerOrderId", pa."idempotencyKey", pa."transactionRef", pa."amountMinor", pa.currency
    FROM "PaymentAttempt" pa
    JOIN "CustomerOrder" o ON o.id = pa."customerOrderId"
    WHERE pa.status = 'SUCCEEDED' AND pa.provider <> 'COD'
      AND o."paymentStatus" NOT IN ('PAID', 'REFUNDED')
      AND (o.status <> 'CANCELLED' OR NOT EXISTS (SELECT 1 FROM "Refund" r WHERE r."paymentAttemptId" = pa.id))
      AND NOT EXISTS (
        SELECT 1 FROM "AuditEvent" a
        WHERE a."entityType" = 'PaymentAttempt' AND a."entityId" = pa.id AND a.action = 'PAYMENT_RECONCILIATION_REJECTED'
      )
    ORDER BY pa."updatedAt" DESC
    LIMIT ${limit}
  `;
  for (const a of stuck) {
    try {
      const out = await prisma.$transaction(
        (tx) =>
          applyPayment(tx, a.customerOrderId, {
            idempotencyKey: a.idempotencyKey,
            transactionRef: a.transactionRef || `RECONCILED_${a.id}`,
            amountMinor: a.amountMinor,
            currency: a.currency,
            source: "reconciliation",
          }),
        TX_OPTS
      );
      if (out.kind === "REJECTED") {
        await reconciliationAudit("PaymentAttempt", a.id, "PAYMENT_RECONCILIATION_REJECTED", { orderId: a.customerOrderId, code: out.code, reason: out.reason });
        await recordRiskEvent(prisma, {
          rule: RISK_RULES.PAYMENT_MISMATCH,
          decision: "FLAGGED",
          message: `Recorded capture ${a.transactionRef ?? a.id} could not be applied: ${out.reason}`,
          orderId: a.customerOrderId,
          metrics: { code: out.code, attemptId: a.id },
        }).catch(() => undefined);
        continue;
      }
      if (out.kind === "PAID") summary.capturesApplied++;
      if (out.kind === "REFUND_REQUIRED") summary.refundsFlagged++;
      await reconciliationAudit("CustomerOrder", a.customerOrderId, "PAYMENT_RECONCILED", {
        attemptId: a.id,
        transactionRef: a.transactionRef,
        outcome: out.kind,
      });
    } catch (err) {
      summary.errors++;
      console.error("[reconcile] capture re-apply failed", a.id, err instanceof Error ? err.message : err);
    }
  }

  // 2. Webhooks that failed internally (provider may have given up retrying).
  const now = Date.now();
  const failed = await prisma.webhookEvent.findMany({
    where: {
      status: WebhookEventStatus.FAILED,
      createdAt: { gte: new Date(now - 7 * 24 * 60 * 60 * 1000) },
      processedAt: { lte: new Date(now - 2 * 60 * 1000) },
    },
    orderBy: { processedAt: "asc" },
    take: limit,
  });
  for (const ev of failed) {
    try {
      const payload = JSON.parse(ev.payloadJson) as Record<string, unknown>;
      const out = await processPaymentWebhook(ev.provider, ev.externalEventId, ev.eventType, payload);
      summary.webhooksReprocessed++;
      await reconciliationAudit("WebhookEvent", ev.id, "WEBHOOK_REPROCESSED", { externalEventId: ev.externalEventId, eventType: ev.eventType, outcome: out });
    } catch (err) {
      summary.errors++;
      console.error("[reconcile] webhook re-process failed", ev.externalEventId, err instanceof Error ? err.message : err);
    }
  }

  // 3. Success events recorded as PROCESSED whose order still awaits payment (legacy partial writes).
  const recentSuccess = await prisma.webhookEvent.findMany({
    where: {
      status: WebhookEventStatus.PROCESSED,
      eventType: { in: [...SUCCESS_EVENTS] },
      createdAt: { gte: new Date(now - 3 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const parsedEvents = recentSuccess
    .map((ev) => {
      try {
        return { ev, payload: JSON.parse(ev.payloadJson) as Record<string, unknown> };
      } catch {
        return null;
      }
    })
    .filter((x): x is { ev: (typeof recentSuccess)[number]; payload: Record<string, unknown> } => Boolean(x && str(x.payload.orderId)));
  const awaiting = parsedEvents.length
    ? await prisma.customerOrder.findMany({
        where: {
          id: { in: parsedEvents.map((p) => str(p.payload.orderId)!) },
          status: CustomerOrderStatus.PENDING_PAYMENT,
          paymentStatus: PaymentStatus.UNPAID,
        },
        select: { id: true },
      })
    : [];
  const awaitingIds = new Set(awaiting.map((o) => o.id));
  for (const { ev, payload } of parsedEvents.filter((p) => awaitingIds.has(str(p.payload.orderId)!)).slice(0, limit)) {
    try {
      const out = await prisma.$transaction(
        (tx) =>
          applyPayment(tx, str(payload.orderId)!, {
            idempotencyKey: str(payload.idempotencyKey),
            transactionRef: str(payload.transactionRef) || `WEBHOOK_${ev.externalEventId}`,
            amountMinor: int(payload.amountMinor),
            currency: str(payload.currency),
            gatewayPayload: payload,
            source: "reconciliation",
          }),
        TX_OPTS
      );
      if (out.kind === "REJECTED") {
        await prisma.webhookEvent.update({ where: { id: ev.id }, data: { status: WebhookEventStatus.IGNORED } });
        await reconciliationAudit("WebhookEvent", ev.id, "WEBHOOK_REAPPLY_REJECTED", { code: out.code, reason: out.reason });
        continue;
      }
      if (out.kind === "PAID" || (out.kind === "REFUND_REQUIRED" && out.refundCreated)) {
        if (out.kind === "PAID") summary.capturesApplied++;
        else summary.refundsFlagged++;
        await reconciliationAudit("CustomerOrder", str(payload.orderId)!, "PAYMENT_RECONCILED", {
          webhookEventId: ev.externalEventId,
          outcome: out.kind,
        });
      }
    } catch (err) {
      summary.errors++;
      console.error("[reconcile] webhook re-apply failed", ev.externalEventId, err instanceof Error ? err.message : err);
    }
  }

  return summary;
}
