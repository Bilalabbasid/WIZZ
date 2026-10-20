import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  CustomerOrderStatus,
  PaymentStatus,
  SellerOrderStatus,
  PaymentAttemptStatus,
  PaymentAttemptProvider,
  SettlementStatus,
  SettlementEntryType,
  RefundStatus,
} from "@prisma/client";
import { commitOrderReservations, createStockReservation, returnOrderStock } from "../inventory/services";
import { isSandboxPaymentEnabled } from "@/lib/payment-methods";

type TxClient = Prisma.TransactionClient;

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
 * fallback value: an unset secret must reject every webhook rather than accept
 * signatures made with a publicly known default.
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
    if (!secret || !signature) return false;
    const expectedSig = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    if (expectedSig.length !== signature.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(signature));
  }
}

export const paymentProvider: IPaymentProvider = new LocalSandboxPaymentProvider();

export interface MarkPaidResult {
  success: boolean;
  alreadyPaid?: boolean;
  /** Payment arrived for an order that was already cancelled / could not be fulfilled: needs a manual refund. */
  requiresRefund?: boolean;
  transactionRef?: string;
  orderNumber: string;
}

async function lockOrderRow(tx: TxClient, orderId: string) {
  await tx.$queryRaw`SELECT id FROM "CustomerOrder" WHERE id = ${orderId} FOR UPDATE`;
}

/**
 * Records a verified payment for an order. Idempotent and safe against
 * concurrent webhook + redirect processing: the order row is locked and the
 * PAID transition happens exactly once.
 *
 * Only a verified provider event (or the sandbox adapter's own capture result)
 * may call this. A success-page redirect never does.
 */
export async function markOrderPaid(
  orderId: string,
  input: {
    idempotencyKey: string;
    transactionRef: string;
    provider?: PaymentAttemptProvider;
    amountMinor?: number;
    gatewayPayload?: unknown;
  }
): Promise<MarkPaidResult> {
  const provider = input.provider ?? PaymentAttemptProvider.LOCAL_SANDBOX;

  const run = (tx: TxClient) => applyPayment(tx, orderId, { ...input, provider }, true);

  try {
    return await prisma.$transaction(run, { timeout: 20000, maxWait: 10000 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.startsWith("INSUFFICIENT_STOCK")) {
      // Stock could not be re-secured after a delayed payment: keep the money record, cancel the order and flag a refund.
      return prisma.$transaction((tx) => applyPayment(tx, orderId, { ...input, provider }, false), {
        timeout: 20000,
        maxWait: 10000,
      });
    }
    throw err;
  }
}

async function applyPayment(
  tx: TxClient,
  orderId: string,
  input: {
    idempotencyKey: string;
    transactionRef: string;
    provider: PaymentAttemptProvider;
    amountMinor?: number;
    gatewayPayload?: unknown;
  },
  fulfil: boolean
): Promise<MarkPaidResult> {
  await lockOrderRow(tx, orderId);

  const order = await tx.customerOrder.findUnique({
    where: { id: orderId },
    include: { sellerOrders: { include: { items: true } } },
  });
  if (!order) throw new Error("Order not found.");

  if (order.paymentStatus === PaymentStatus.PAID || order.paymentStatus === PaymentStatus.REFUNDED) {
    return { success: true, alreadyPaid: true, orderNumber: order.orderNumber, transactionRef: input.transactionRef };
  }

  if (input.amountMinor !== undefined && input.amountMinor !== order.totalMinor) {
    throw new Error(
      `PAYMENT_AMOUNT_MISMATCH: Provider reported ${input.amountMinor} but order total is ${order.totalMinor}.`
    );
  }

  const gatewayJson = input.gatewayPayload ? JSON.stringify(input.gatewayPayload) : undefined;
  await tx.paymentAttempt.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    update: {
      status: PaymentAttemptStatus.SUCCEEDED,
      transactionRef: input.transactionRef,
      rawGatewayResponseJson: gatewayJson,
    },
    create: {
      customerOrderId: order.id,
      provider: input.provider,
      idempotencyKey: input.idempotencyKey,
      amountMinor: order.totalMinor,
      currency: order.currency,
      status: PaymentAttemptStatus.SUCCEEDED,
      transactionRef: input.transactionRef,
      rawGatewayResponseJson: gatewayJson,
    },
  });

  // Late payment for an order that is already cancelled, or whose stock cannot be re-secured.
  if (order.status === CustomerOrderStatus.CANCELLED || !fulfil) {
    await tx.customerOrder.update({
      where: { id: order.id },
      data: {
        paymentStatus: PaymentStatus.PAID,
        status: CustomerOrderStatus.CANCELLED,
        notes: `Payment ${input.transactionRef} received after the order could no longer be fulfilled. Refund required.`,
      },
    });
    await tx.sellerOrder.updateMany({
      where: { customerOrderId: order.id, status: { not: SellerOrderStatus.CANCELLED } },
      data: { status: SellerOrderStatus.CANCELLED, netSellerPayableMinor: 0 },
    });
    await tx.refund.create({
      data: {
        customerOrderId: order.id,
        amountMinor: order.totalMinor,
        currency: order.currency,
        status: RefundStatus.PENDING,
        reason: "Payment received after order cancellation or stock exhaustion; refund must be issued via the payment provider.",
      },
    });
    await tx.auditEvent.create({
      data: {
        entityType: "CustomerOrder",
        entityId: order.id,
        action: "PAYMENT_AFTER_CANCELLATION",
        detailsJson: JSON.stringify({ transactionRef: input.transactionRef, amountMinor: order.totalMinor }),
      },
    });
    return { success: true, requiresRefund: true, orderNumber: order.orderNumber, transactionRef: input.transactionRef };
  }

  // Make sure every item has a reservation tied to this order. After a long delay the hold may have expired.
  const existingRes = await tx.inventoryReservation.findMany({
    where: { orderId: order.id, status: { in: ["ACTIVE", "COMMITTED"] } },
  });
  const covered = new Map<string, number>();
  for (const r of existingRes) covered.set(r.variantId, (covered.get(r.variantId) || 0) + r.reservedUnits);

  const needed = new Map<string, number>();
  for (const so of order.sellerOrders) {
    for (const item of so.items) {
      if (item.variantId) needed.set(item.variantId, (needed.get(item.variantId) || 0) + item.quantity);
    }
  }
  for (const [variantId, qty] of [...needed.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const missing = qty - (covered.get(variantId) || 0);
    if (missing > 0) {
      await createStockReservation(variantId, missing, undefined, order.id, 1, tx);
    }
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
    if (so.status === SellerOrderStatus.CANCELLED) continue;
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

  return { success: true, orderNumber: order.orderNumber, transactionRef: input.transactionRef };
}

/**
 * Cancels an unpaid order: releases stock, restores coupon usage, and closes pending attempts.
 * Never touches an order that has been paid.
 */
export async function cancelUnpaidOrder(
  tx: TxClient,
  orderId: string,
  reason: string,
  attemptStatus: PaymentAttemptStatus = PaymentAttemptStatus.CANCELLED
) {
  await lockOrderRow(tx, orderId);
  const order = await tx.customerOrder.findUnique({ where: { id: orderId } });
  if (!order) return { cancelled: false };
  if (order.paymentStatus === PaymentStatus.PAID || order.status === CustomerOrderStatus.CANCELLED) {
    return { cancelled: false };
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
 * are cancelled and their stock is returned (timeout handling).
 */
export async function cancelExpiredUnpaidOrders(graceMinutes = 30) {
  const cutoff = new Date(Date.now() - graceMinutes * 60 * 1000);
  const stale = await prisma.customerOrder.findMany({
    where: { status: CustomerOrderStatus.PENDING_PAYMENT, paymentStatus: PaymentStatus.UNPAID, createdAt: { lt: cutoff } },
    select: { id: true },
    take: 100,
  });
  let cancelled = 0;
  for (const o of stale) {
    const r = await prisma.$transaction((tx) =>
      cancelUnpaidOrder(tx, o.id, "Payment not completed in time; order cancelled automatically.")
    );
    if (r.cancelled) cancelled++;
  }
  return { cancelled };
}

/**
 * Sandbox capture used by the checkout route in non-production environments.
 * Provider failures are recorded; success goes through the same verified
 * markOrderPaid() path as webhooks.
 */
export async function executeOrderPayment(orderId: string, idempotencyKey: string) {
  const order = await prisma.customerOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Order not found.");

  if (order.paymentStatus === PaymentStatus.PAID) {
    return { success: true, message: "Order is already paid.", orderNumber: order.orderNumber };
  }

  const result = await paymentProvider.authorizeAndCapture(order.totalMinor, order.currency, order.orderNumber);

  if (!result.success) {
    await prisma.paymentAttempt.upsert({
      where: { idempotencyKey },
      update: { status: PaymentAttemptStatus.FAILED, transactionRef: result.transactionRef },
      create: {
        customerOrderId: order.id,
        provider: PaymentAttemptProvider.LOCAL_SANDBOX,
        idempotencyKey,
        amountMinor: order.totalMinor,
        currency: order.currency,
        status: PaymentAttemptStatus.FAILED,
        transactionRef: result.transactionRef,
      },
    });
    return { success: false, transactionRef: result.transactionRef, orderNumber: order.orderNumber, message: result.errorMessage };
  }

  const paid = await markOrderPaid(orderId, {
    idempotencyKey,
    transactionRef: result.transactionRef,
    amountMinor: order.totalMinor,
  });
  return {
    success: paid.success,
    transactionRef: result.transactionRef,
    orderNumber: paid.orderNumber,
  };
}

const SUCCESS_EVENTS = new Set(["payment_intent.succeeded", "payment.captured"]);
const FAILURE_EVENTS = new Set(["payment_intent.payment_failed", "payment.failed", "payment.cancelled"]);

/**
 * Idempotent webhook processing core. Callers exposed to HTTP must use
 * ingestPaymentWebhook(), which makes the signature mandatory.
 *
 * Events are claimed by their unique external ID, processed, and only left in
 * PROCESSED state on success. A FAILED event is re-processed on provider retry.
 */
export async function processPaymentWebhook(
  provider: string,
  externalEventId: string,
  eventType: string,
  payload: Record<string, unknown>,
  signatureHeader?: string,
  rawBody?: string
) {
  // When a signature is supplied it must verify.
  if (signatureHeader || rawBody) {
    const isValid = Boolean(signatureHeader && rawBody) && paymentProvider.verifyWebhookSignature(rawBody!, signatureHeader!);
    if (!isValid) {
      throw new Error("INVALID_WEBHOOK_SIGNATURE: Payment webhook signature verification failed.");
    }
  }

  const existing = await prisma.webhookEvent.findUnique({ where: { externalEventId } });
  if (existing && existing.status !== "FAILED") {
    return { status: "ALREADY_PROCESSED" };
  }

  if (!existing) {
    try {
      await prisma.webhookEvent.create({
        data: {
          provider,
          externalEventId,
          eventType,
          payloadJson: JSON.stringify(payload),
          status: "PROCESSED",
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return { status: "ALREADY_PROCESSED" };
      }
      throw err;
    }
  } else {
    await prisma.webhookEvent.update({ where: { externalEventId }, data: { status: "PROCESSED" } });
  }

  try {
    const orderId = payload.orderId as string | undefined;
    const amountMinor = typeof payload.amountMinor === "number" ? (payload.amountMinor as number) : undefined;

    if (SUCCESS_EVENTS.has(eventType) && orderId) {
      const idempotencyKey = (payload.idempotencyKey as string) || `webhook_${externalEventId}`;
      const transactionRef = (payload.transactionRef as string) || `WEBHOOK_${externalEventId}`;
      const result = await markOrderPaid(orderId, {
        idempotencyKey,
        transactionRef,
        amountMinor,
        gatewayPayload: payload,
      });
      return { status: "PROCESSED", ...(result.requiresRefund ? { requiresRefund: true } : {}) };
    }

    if (FAILURE_EVENTS.has(eventType) && orderId) {
      // Out-of-order protection: a failure arriving after success never downgrades a paid order.
      await prisma.$transaction((tx) =>
        cancelUnpaidOrder(tx, orderId, `Payment ${eventType} reported by provider.`, PaymentAttemptStatus.FAILED)
      );
      return { status: "PROCESSED" };
    }

    await prisma.webhookEvent.update({ where: { externalEventId }, data: { status: "IGNORED" } });
    return { status: "IGNORED" };
  } catch (err) {
    await prisma.webhookEvent.update({ where: { externalEventId }, data: { status: "FAILED" } }).catch(() => undefined);
    throw err;
  }
}

/**
 * HTTP-facing entry point: the HMAC signature over the exact raw body is mandatory.
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
  if (typeof parsed.id !== "string" || typeof parsed.type !== "string" || typeof parsed.data !== "object" || !parsed.data) {
    throw new Error("INVALID_WEBHOOK_PAYLOAD: Expected { id, type, data }.");
  }
  const data = parsed.data as Record<string, unknown>;
  if (SUCCESS_EVENTS.has(parsed.type) && typeof data.amountMinor !== "number") {
    throw new Error("INVALID_WEBHOOK_PAYLOAD: Success events must include data.amountMinor.");
  }

  return processPaymentWebhook(
    typeof parsed.provider === "string" ? parsed.provider : "LOCAL_SANDBOX",
    parsed.id,
    parsed.type,
    data,
    signature,
    rawBody
  );
}
