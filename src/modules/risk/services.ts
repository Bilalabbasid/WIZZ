/**
 * Fraud and abuse controls for checkout (server-enforced).
 *
 * - Blocking rules throw a RiskBlockedError with a customer-safe message. The caller writes
 *   the RISK_* audit event AFTER its transaction rolled back, so blocked attempts are kept.
 * - Flagging rules never block and never freeze money: they write a RISK_* audit event that
 *   appears in the admin review queue (/admin/risk).
 * - Identities are compared normalised: email lower-cased with "+tag" removed, phone by its
 *   last 10 digits (so "+92 300 1234567" and "03001234567" match).
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { RISK_LIMITS, RISK_RULES, RISK_REVIEWED_ACTION, RISK_RULE_VALUES, type RiskRule } from "./config";

type Client = Prisma.TransactionClient | typeof prisma;

const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizeEmail(email: string | null | undefined): string {
  const s = String(email || "").trim().toLowerCase();
  const at = s.lastIndexOf("@");
  if (at < 1) return s;
  return `${s.slice(0, at).split("+")[0]}${s.slice(at)}`;
}

/** Last 10 digits of a phone number ("" when it has fewer than 10 digits). */
export function normalizePhone(phone: string | null | undefined): string {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

export function phoneLast4(phone: string | null | undefined): string | null {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : null;
}

export interface RiskIdentity {
  userId?: string | null;
  email: string;
  phone?: string | null;
  ipAddress?: string | null;
}

export interface RiskEventInput {
  rule: RiskRule;
  decision: "BLOCKED" | "FLAGGED";
  message: string;
  identity?: Partial<RiskIdentity>;
  orderId?: string | null;
  orderNumber?: string | null;
  cartId?: string | null;
  metrics?: Record<string, unknown>;
}

/** A checkout refused by a risk rule. `httpStatus` is what the API returns. */
export class RiskBlockedError extends Error {
  /** True when an identical block was logged moments ago (flood protection for the audit log). */
  skipAudit = false;

  constructor(
    public readonly event: RiskEventInput,
    public readonly httpStatus: number = 403
  ) {
    super(`RISK_BLOCKED: ${event.message}`);
    this.name = "RiskBlockedError";
  }

  /** Customer-facing message (no rule internals). */
  get publicMessage() {
    return this.event.message;
  }
}

/** Writes one RISK_* audit event. Only minimal personal data: normalised email + last 4 phone digits. */
export async function recordRiskEvent(client: Client, input: RiskEventInput) {
  const userId = input.identity?.userId ?? null;
  const entity = input.orderId
    ? { entityType: "CustomerOrder", entityId: input.orderId }
    : userId
      ? { entityType: "User", entityId: userId }
      : { entityType: "Checkout", entityId: input.cartId || "unknown" };

  return client.auditEvent.create({
    data: {
      actorUserId: null,
      ...entity,
      action: input.rule,
      ipAddress: input.identity?.ipAddress ? String(input.identity.ipAddress).slice(0, 64) : null,
      detailsJson: JSON.stringify({
        rule: input.rule,
        decision: input.decision,
        message: input.message,
        userId,
        email: input.identity?.email ? normalizeEmail(input.identity.email) : null,
        phoneLast4: phoneLast4(input.identity?.phone),
        orderId: input.orderId ?? null,
        orderNumber: input.orderNumber ?? null,
        cartId: input.cartId ?? null,
        metrics: input.metrics ?? {},
      }),
    },
  });
}

/** Records an event without ever failing the caller (risk logging must not break checkout). */
export async function recordRiskEventSafe(input: RiskEventInput) {
  try {
    await recordRiskEvent(prisma, input);
  } catch (err) {
    console.error("[risk] failed to record risk event", input.rule, err instanceof Error ? err.message : err);
  }
}

// ---------------------------------------------------------------------------------------------
// IP velocity (in-memory sliding window; per process)
// ---------------------------------------------------------------------------------------------

const ipBlockLoggedAt = new Map<string, number>();

/** Counts one order attempt for the IP; throws once the hourly limit is exceeded. */
export function assertIpOrderVelocity(identity: RiskIdentity, cartId?: string) {
  const ip = identity.ipAddress;
  if (!ip || ip === "unknown-ip") return;
  const res = checkRateLimit(`risk:order-ip:${ip}`, { windowMs: 60 * 60 * 1000, max: RISK_LIMITS.orderAttemptsPerIpPerHour });
  if (res.success) return;

  // Log at most once per IP per 10 minutes so a flood does not flood the review queue.
  const last = ipBlockLoggedAt.get(ip) || 0;
  const shouldLog = Date.now() - last > 10 * 60 * 1000;
  if (shouldLog) ipBlockLoggedAt.set(ip, Date.now());
  const err = new RiskBlockedError(
    {
      rule: RISK_RULES.IP_VELOCITY,
      decision: "BLOCKED",
      message: "Too many order attempts from your network. Please try again in an hour or contact support.",
      identity,
      cartId,
      metrics: { limitPerHour: RISK_LIMITS.orderAttemptsPerIpPerHour, retryAfterMs: res.resetMs },
    },
    429
  );
  err.skipAudit = !shouldLog;
  throw err;
}

// ---------------------------------------------------------------------------------------------
// Identity-scoped SQL helpers
// ---------------------------------------------------------------------------------------------

const EMAIL_NORM_SQL = Prisma.sql`regexp_replace(lower(trim(o."customerEmail")), '[+][^@]*@', '@')`;
const PHONE_NORM_SQL = Prisma.sql`right(regexp_replace(coalesce(o."customerPhone", ''), '[^0-9]', '', 'g'), 10)`;

function identityMatchSql(identity: RiskIdentity) {
  const email = normalizeEmail(identity.email);
  const phone = normalizePhone(identity.phone);
  const parts: Prisma.Sql[] = [];
  if (email) parts.push(Prisma.sql`${EMAIL_NORM_SQL} = ${email}`);
  if (phone) parts.push(Prisma.sql`${PHONE_NORM_SQL} = ${phone}`);
  if (identity.userId) parts.push(Prisma.sql`o."customerUserId" = ${identity.userId}`);
  if (parts.length === 0) return Prisma.sql`FALSE`;
  return Prisma.sql`(${Prisma.join(parts, " OR ")})`;
}

/**
 * Serialises checkouts of the same customer identity inside the caller's transaction, so two
 * concurrent orders cannot both pass a velocity limit. Locks are taken in sorted order.
 */
export async function lockRiskIdentity(tx: Prisma.TransactionClient, identity: RiskIdentity) {
  const keys = [
    normalizeEmail(identity.email) && `risk:email:${normalizeEmail(identity.email)}`,
    normalizePhone(identity.phone) && `risk:phone:${normalizePhone(identity.phone)}`,
    identity.userId && `risk:user:${identity.userId}`,
  ]
    .filter((k): k is string => Boolean(k))
    .sort();
  for (const key of keys) {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))::text AS locked`;
  }
}

interface CodOrderRow {
  id: string;
  status: string;
  createdAt: Date;
  notes: string | null;
  customerUserId: string | null;
  emailNorm: string;
  phoneNorm: string;
}

const CLOSED_ORDER_STATUSES = ["DELIVERED", "CANCELLED", "REFUNDED"];

/**
 * COD rules, evaluated inside the order transaction after lockRiskIdentity():
 *  - ≤ codOrdersPer24h COD orders per phone / email / account in 24h        (block)
 *  - ≤ openCodOrdersPerPhone open COD orders per phone / account             (block)
 *  - ≥ codCustomerCancellations customer-cancelled COD orders in 30 days:
 *      guest → must sign in (block); signed in → allowed, flagged for review
 * Returns the non-blocking flags to record with the order.
 */
export async function evaluateCodRiskInTx(
  tx: Prisma.TransactionClient,
  identity: RiskIdentity,
  cartId?: string
): Promise<RiskEventInput[]> {
  const now = Date.now();
  const since = new Date(now - RISK_LIMITS.codCustomerCancellationWindowDays * DAY_MS);
  const rows = await tx.$queryRaw<CodOrderRow[]>`
    SELECT o.id, o.status::text AS status, o."createdAt", o.notes, o."customerUserId",
           ${EMAIL_NORM_SQL} AS "emailNorm", ${PHONE_NORM_SQL} AS "phoneNorm"
    FROM "CustomerOrder" o
    WHERE EXISTS (SELECT 1 FROM "PaymentAttempt" pa WHERE pa."customerOrderId" = o.id AND pa.provider = 'COD')
      AND (o."createdAt" >= ${since} OR o.status::text NOT IN (${Prisma.join(CLOSED_ORDER_STATUSES)}))
      AND ${identityMatchSql(identity)}
  `;

  const email = normalizeEmail(identity.email);
  const phone = normalizePhone(identity.phone);
  const userId = identity.userId || null;
  const matches = (r: CodOrderRow, by: "email" | "phone" | "user") =>
    by === "email" ? Boolean(email) && r.emailNorm === email : by === "phone" ? Boolean(phone) && r.phoneNorm === phone : Boolean(userId) && r.customerUserId === userId;

  const last24h = rows.filter((r) => new Date(r.createdAt).getTime() >= now - DAY_MS);
  const per24h = {
    email: last24h.filter((r) => matches(r, "email")).length,
    phone: last24h.filter((r) => matches(r, "phone")).length,
    account: last24h.filter((r) => matches(r, "user")).length,
  };
  if (Math.max(per24h.email, per24h.phone, per24h.account) >= RISK_LIMITS.codOrdersPer24h) {
    throw new RiskBlockedError(
      {
        rule: RISK_RULES.COD_VELOCITY,
        decision: "BLOCKED",
        message: `Cash on delivery is limited to ${RISK_LIMITS.codOrdersPer24h} orders per day for the same phone number or email. Please try again tomorrow or contact support.`,
        identity,
        cartId,
        metrics: { ...per24h, limit: RISK_LIMITS.codOrdersPer24h },
      },
      429
    );
  }

  const open = rows.filter((r) => !CLOSED_ORDER_STATUSES.includes(r.status));
  const openCount = Math.max(
    open.filter((r) => matches(r, "phone")).length,
    open.filter((r) => matches(r, "user")).length
  );
  if (openCount >= RISK_LIMITS.openCodOrdersPerPhone) {
    throw new RiskBlockedError(
      {
        rule: RISK_RULES.COD_OPEN_ORDERS,
        decision: "BLOCKED",
        message: `You already have ${openCount} cash-on-delivery orders on the way. Please wait for them to be delivered before placing another COD order, or pay online when available.`,
        identity,
        cartId,
        metrics: { openCodOrders: openCount, limit: RISK_LIMITS.openCodOrdersPerPhone },
      },
      429
    );
  }

  const cancelledByCustomer = rows.filter(
    (r) =>
      r.status === "CANCELLED" &&
      new Date(r.createdAt).getTime() >= since.getTime() &&
      (r.notes || "").startsWith("Cancelled by customer")
  ).length;
  const flags: RiskEventInput[] = [];
  if (cancelledByCustomer >= RISK_LIMITS.codCustomerCancellations) {
    if (!userId) {
      throw new RiskBlockedError(
        {
          rule: RISK_RULES.COD_CANCELLATION_ABUSE,
          decision: "BLOCKED",
          message: "Please sign in to your account to place a cash-on-delivery order.",
          identity,
          cartId,
          metrics: { customerCancelledCod30d: cancelledByCustomer, threshold: RISK_LIMITS.codCustomerCancellations },
        },
        401
      );
    }
    flags.push({
      rule: RISK_RULES.COD_CANCELLATION_ABUSE,
      decision: "FLAGGED",
      message: `Customer cancelled ${cancelledByCustomer} COD orders in ${RISK_LIMITS.codCustomerCancellationWindowDays} days; order allowed for a signed-in account, review before dispatch.`,
      identity,
      cartId,
      metrics: { customerCancelledCod30d: cancelledByCustomer, threshold: RISK_LIMITS.codCustomerCancellations },
    });
  }
  return flags;
}

// ---------------------------------------------------------------------------------------------
// Coupons: one use per customer
// ---------------------------------------------------------------------------------------------

/**
 * True when this customer (account, normalised email or phone) already has a non-cancelled
 * order with the coupon. Inside placeOrder this runs after the coupon row was locked by the
 * usage UPDATE, so concurrent checkouts with the same coupon are serialised and cannot both pass.
 */
export async function hasCustomerUsedCoupon(client: Client, code: string, identity: RiskIdentity): Promise<boolean> {
  const rows = await client.$queryRaw<Array<{ n: number }>>`
    SELECT count(*)::int AS n FROM "CustomerOrder" o
    WHERE o."couponCode" = ${code.trim().toUpperCase()}
      AND o.status::text <> 'CANCELLED'
      AND ${identityMatchSql(identity)}
  `;
  return (rows[0]?.n ?? 0) > 0;
}

export function couponReuseError(code: string, identity: RiskIdentity, cartId?: string) {
  return new RiskBlockedError(
    {
      rule: RISK_RULES.COUPON_REUSE,
      decision: "BLOCKED",
      message: "You have already used this coupon. Each coupon can be used once per customer.",
      identity,
      cartId,
      metrics: { coupon: code },
    },
    400
  );
}

// ---------------------------------------------------------------------------------------------
// Refund / return abuse (flag only)
// ---------------------------------------------------------------------------------------------

export async function countRefundedReturns(client: Client, userId: string): Promise<number> {
  return client.returnRequest.count({
    where: {
      customerUserId: userId,
      status: "REFUNDED",
      updatedAt: { gte: new Date(Date.now() - RISK_LIMITS.refundedReturnsWindowDays * DAY_MS) },
    },
  });
}

async function recentlyFlagged(client: Client, rule: RiskRule, userId: string) {
  const since = new Date(Date.now() - RISK_LIMITS.flagDedupeDays * DAY_MS);
  const hit = await client.auditEvent.findFirst({
    where: { action: rule, createdAt: { gte: since }, detailsJson: { contains: `"userId":"${userId}"` } },
    select: { id: true },
  });
  return Boolean(hit);
}

/** Flags a customer with ≥ refundedReturns refunded returns in 90 days (once per dedupe window). */
export async function flagRefundAbuseIfNeeded(
  client: Client,
  identity: RiskIdentity,
  context: { orderId?: string; orderNumber?: string } = {}
) {
  if (!identity.userId) return false;
  const refunded = await countRefundedReturns(client, identity.userId);
  if (refunded < RISK_LIMITS.refundedReturns) return false;
  if (await recentlyFlagged(client, RISK_RULES.REFUND_ABUSE, identity.userId)) return false;
  await recordRiskEvent(client, {
    rule: RISK_RULES.REFUND_ABUSE,
    decision: "FLAGGED",
    message: `${refunded} refunded returns in ${RISK_LIMITS.refundedReturnsWindowDays} days. Review before approving further returns; nothing is blocked automatically.`,
    identity,
    orderId: context.orderId,
    orderNumber: context.orderNumber,
    metrics: { refundedReturns90d: refunded, threshold: RISK_LIMITS.refundedReturns },
  });
  return true;
}

/** Maintenance sweep: flags every customer over the refunded-returns threshold. */
export async function scanRefundAbuse(limit = 50) {
  const since = new Date(Date.now() - RISK_LIMITS.refundedReturnsWindowDays * DAY_MS);
  const groups = await prisma.returnRequest.groupBy({
    by: ["customerUserId"],
    where: { status: "REFUNDED", updatedAt: { gte: since } },
    _count: { _all: true },
    having: { customerUserId: { _count: { gte: RISK_LIMITS.refundedReturns } } },
    orderBy: { customerUserId: "asc" },
    take: limit,
  });
  let flagged = 0;
  for (const g of groups) {
    const user = await prisma.user.findUnique({ where: { id: g.customerUserId }, select: { id: true, email: true, phone: true } });
    if (!user) continue;
    if (await flagRefundAbuseIfNeeded(prisma, { userId: user.id, email: user.email, phone: user.phone })) flagged++;
  }
  return { flagged };
}

// ---------------------------------------------------------------------------------------------
// Admin review queue
// ---------------------------------------------------------------------------------------------

export interface RiskEventRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: Date;
  ipAddress: string | null;
  details: {
    rule?: string;
    decision?: string;
    message?: string;
    userId?: string | null;
    email?: string | null;
    phoneLast4?: string | null;
    orderId?: string | null;
    orderNumber?: string | null;
    metrics?: Record<string, unknown>;
  };
  review: { reviewedAt: Date; reviewerEmail: string | null; note: string | null } | null;
}

export type RiskReviewFilter = "open" | "reviewed" | "all";

function escapeLike(q: string) {
  return q.replace(/[\\%_]/g, (m) => `\\${m}`);
}

export async function listRiskEvents(opts: {
  rule?: string | null;
  status?: RiskReviewFilter;
  q?: string;
  page?: number;
  pageSize?: number;
}) {
  const pageSize = Math.min(Math.max(opts.pageSize ?? 25, 1), 100);
  const page = Math.max(opts.page ?? 1, 1);
  const rule = opts.rule && (RISK_RULE_VALUES as string[]).includes(opts.rule) ? opts.rule : null;
  const status = opts.status ?? "open";
  const q = (opts.q || "").trim().slice(0, 120);

  const conditions: Prisma.Sql[] = [Prisma.sql`left(a.action, 5) = 'RISK_'`, Prisma.sql`a.action <> ${RISK_REVIEWED_ACTION}`];
  if (rule) conditions.push(Prisma.sql`a.action = ${rule}`);
  const reviewedExists = Prisma.sql`EXISTS (SELECT 1 FROM "AuditEvent" r WHERE r.action = ${RISK_REVIEWED_ACTION} AND r."entityType" = 'AuditEvent' AND r."entityId" = a.id)`;
  if (status === "open") conditions.push(Prisma.sql`NOT ${reviewedExists}`);
  if (status === "reviewed") conditions.push(reviewedExists);
  if (q) {
    const like = `%${escapeLike(q.toLowerCase())}%`;
    conditions.push(Prisma.sql`(lower(a."detailsJson") LIKE ${like} OR a."entityId" = ${q})`);
  }
  const where = Prisma.join(conditions, " AND ");

  const [countRows, rows] = await Promise.all([
    prisma.$queryRaw<Array<{ n: number }>>`SELECT count(*)::int AS n FROM "AuditEvent" a WHERE ${where}`,
    prisma.$queryRaw<Array<{ id: string; action: string; entityType: string; entityId: string; createdAt: Date; ipAddress: string | null; detailsJson: string }>>`
      SELECT a.id, a.action, a."entityType", a."entityId", a."createdAt", a."ipAddress", a."detailsJson"
      FROM "AuditEvent" a WHERE ${where}
      ORDER BY a."createdAt" DESC
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    `,
  ]);

  const reviews = rows.length
    ? await prisma.auditEvent.findMany({
        where: { action: RISK_REVIEWED_ACTION, entityType: "AuditEvent", entityId: { in: rows.map((r) => r.id) } },
        include: { actorUser: { select: { email: true } } },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const reviewById = new Map(reviews.map((r) => [r.entityId, r]));

  const events: RiskEventRow[] = rows.map((r) => {
    let details: RiskEventRow["details"] = {};
    try {
      details = JSON.parse(r.detailsJson);
    } catch {
      details = { message: r.detailsJson };
    }
    const review = reviewById.get(r.id);
    let note: string | null = null;
    if (review) {
      try {
        note = (JSON.parse(review.detailsJson) as { note?: string }).note ?? null;
      } catch {
        note = null;
      }
    }
    return {
      id: r.id,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      createdAt: new Date(r.createdAt),
      ipAddress: r.ipAddress,
      details,
      review: review ? { reviewedAt: review.createdAt, reviewerEmail: review.actorUser?.email ?? null, note } : null,
    };
  });

  return { total: countRows[0]?.n ?? 0, events, page, pageSize };
}

/** Marks a RISK_* event reviewed by writing a RISK_REVIEWED audit event that references it. Idempotent. */
export async function markRiskEventReviewed(eventId: string, actorUserId: string, note?: string) {
  const cleanNote = note ? String(note).trim().slice(0, 500) : "";
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`risk-review:${eventId}`}))::text AS locked`;
    const event = await tx.auditEvent.findUnique({ where: { id: eventId } });
    if (!event || !event.action.startsWith("RISK_") || event.action === RISK_REVIEWED_ACTION) {
      throw new Error("VALIDATION: Risk event not found.");
    }
    const existing = await tx.auditEvent.findFirst({
      where: { action: RISK_REVIEWED_ACTION, entityType: "AuditEvent", entityId: eventId },
    });
    if (existing) return { alreadyReviewed: true, reviewId: existing.id };
    const review = await tx.auditEvent.create({
      data: {
        actorUserId,
        entityType: "AuditEvent",
        entityId: eventId,
        action: RISK_REVIEWED_ACTION,
        detailsJson: JSON.stringify({ rule: event.action, note: cleanNote || null }),
      },
    });
    return { alreadyReviewed: false, reviewId: review.id };
  });
}
