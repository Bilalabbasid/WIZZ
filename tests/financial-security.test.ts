/**
 * Financial security regression suite: payments, webhooks, reconciliation, refunds,
 * chargebacks and fraud rules. Runs against the LOCAL database with its own isolated
 * fixtures (one seller, one product, fresh customers, a per-run coupon). Never calls a real
 * payment provider and never sends email (the maintenance steps are called directly, not
 * through runMaintenance(), which would also flush the email queue).
 *
 *   npx tsx tests/financial-security.test.ts
 */
import { NextRequest } from "next/server";
import {
  CustomerOrderStatus,
  PaymentAttemptStatus,
  PaymentStatus,
  ProductModerationStatus,
  ProductStatus,
  RefundStatus,
  SellerOperationalStatus,
  SettlementEntryType,
  SettlementStatus,
  UserRole,
} from "@prisma/client";
import { prisma } from "../src/lib/db";
import { placeOrderSchema } from "../src/lib/validation";
import { assertPaymentMethodAllowed } from "../src/lib/payment-methods";
import { verifyOrderAccessToken, createOrderAccessToken } from "../src/lib/order-access";
import { calculateCheckoutTotals, placeOrder, COUPON_ALREADY_USED_MESSAGE } from "../src/modules/checkout/services";
import {
  assertRefundWithinPaid,
  cancelExpiredUnpaidOrders,
  executeOrderPayment,
  processPaymentWebhook,
  reconcilePayments,
  recordChargeback,
  signSandboxWebhook,
} from "../src/modules/payments/services";
import { getUserOrders, requestOrderCancellation, cancelSellerSuborder } from "../src/modules/orders/services";
import { createReturnRequest, transitionReturnRequest } from "../src/modules/returns/services";
import { createShipment, addShipmentMilestone } from "../src/modules/fulfillment/services";
import { ADMIN_ACTION_ROLES } from "../src/modules/admin/access";
import {
  RiskBlockedError,
  assertIpOrderVelocity,
  listRiskEvents,
  markRiskEventReviewed,
  scanRefundAbuse,
} from "../src/modules/risk/services";
import { RISK_LIMITS, RISK_RULES } from "../src/modules/risk/config";
import { POST as webhookPOST } from "../src/app/api/webhooks/payments/route";
import { POST as refundCompletePOST } from "../src/app/api/admin/refunds/[id]/complete/route";
import { POST as returnResolvePOST } from "../src/app/api/admin/returns/[id]/resolve/route";

let passed = 0;
let failed = 0;
function assert(condition: unknown, name: string, details?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${name}${details ? ` (${details})` : ""}`);
    failed++;
  }
}
async function expectError(fn: () => Promise<unknown>): Promise<Error | null> {
  try {
    await fn();
    return null;
  } catch (err) {
    return err instanceof Error ? err : new Error(String(err));
  }
}

const nonce = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
let counter = 0;
const next = () => ++counter;
// Unique, valid-looking Pakistani mobile numbers per run (last 10 digits identify the phone).
const phoneBase = 3000000000 + (Date.now() % 900000) * 1000;
const phone = (i: number) => `+92 ${String(phoneBase + i).slice(0, 3)} ${String(phoneBase + i).slice(3)}`;
const ip = () => `10.${(Date.now() >> 8) % 250}.${next() % 250}.${next() % 250}`;

const PRICE = 100000; // Rs 1,000

interface Fixture {
  sellerOrgId: string;
  productId: string;
  variantId: string;
  admin: { id: string };
  userA: { id: string; email: string; phone: string };
  userB: { id: string; email: string; phone: string };
  coupon: string;
  capCoupon: string;
}

async function setup(): Promise<Fixture> {
  const seller = await prisma.sellerOrg.create({
    data: {
      name: `FinSec Seller ${nonce}`,
      slug: `finsec-seller-${nonce}`,
      legalName: `FinSec Seller ${nonce} (Pvt) Ltd`,
      contactEmail: `finsec.seller.${nonce}@example.test`,
      operationalStatus: SellerOperationalStatus.ACTIVE,
      commissionRatePercent: 10,
    },
  });
  let category = await prisma.category.findFirst();
  if (!category) category = await prisma.category.create({ data: { name: "FinSec", slug: `finsec-${nonce}` } });
  const product = await prisma.product.create({
    data: {
      sellerOrgId: seller.id,
      categoryId: category.id,
      title: `FinSec Test Kettle ${nonce}`,
      slug: `finsec-kettle-${nonce}`,
      description: "Isolated fixture for the financial security suite.",
      status: ProductStatus.PUBLISHED,
      moderationStatus: ProductModerationStatus.APPROVED,
      isApprovedByPlatform: true,
      variants: {
        create: {
          sku: `FINSEC-${nonce}`,
          title: "Standard",
          priceMinor: PRICE,
          inventoryLevel: { create: { sellerOrgId: seller.id, availableUnits: 100000 } },
        },
      },
    },
    include: { variants: true },
  });
  const mkUser = (tag: string, role: UserRole, i: number) =>
    prisma.user.create({
      data: {
        email: `finsec.${tag}.${nonce}@example.test`,
        passwordHash: "test-only-not-a-login",
        firstName: "FinSec",
        lastName: tag,
        phone: phone(i),
        role,
        isEmailVerified: true,
      },
    });
  const admin = await mkUser("finance", UserRole.PLATFORM_FINANCE_ADMIN, 900);
  const a = await mkUser("a", UserRole.CUSTOMER, 901);
  const b = await mkUser("b", UserRole.CUSTOMER, 902);
  const coupon = `FINSEC${nonce}`.toUpperCase();
  const capCoupon = `FINCAP${nonce}`.toUpperCase();
  await prisma.coupon.create({
    data: { code: coupon, discountType: "FIXED_AMOUNT", discountValueMinor: 5000, minOrderAmountMinor: 0 },
  });
  await prisma.coupon.create({
    data: { code: capCoupon, discountType: "PERCENTAGE", discountValueMinor: 50, maxDiscountMinor: 1000, minOrderAmountMinor: 150000 },
  });
  return {
    sellerOrgId: seller.id,
    productId: product.id,
    variantId: product.variants[0].id,
    admin,
    userA: { id: a.id, email: a.email, phone: a.phone! },
    userB: { id: b.id, email: b.email, phone: b.phone! },
    coupon,
    capCoupon,
  };
}

let fx: Fixture;

async function newCart(userId?: string | null, qty = 1, variantId = fx.variantId) {
  const cart = await prisma.cart.create({
    data: { userId: userId ?? null, sessionToken: userId ? null : `finsec_${nonce}_${next()}`, status: "ACTIVE" },
  });
  await prisma.cartItem.create({ data: { cartId: cart.id, variantId, quantity: qty } });
  return cart.id;
}

const address = (ph: string) => ({
  fullName: "FinSec Customer",
  phone: ph,
  street1: "House 1, Street 2",
  city: "Lahore",
  stateProvince: "Punjab",
  postalCode: "54000",
  countryCode: "PK",
});

async function place(opts: {
  userId?: string | null;
  email: string;
  phone: string;
  method: "CASH_ON_DELIVERY" | "ONLINE_SANDBOX";
  qty?: number;
  coupon?: string;
  key?: string;
  cartId?: string;
  ipAddress?: string;
  noRisk?: boolean;
}) {
  const cartId = opts.cartId ?? (await newCart(opts.userId, opts.qty ?? 1));
  return placeOrder({
    cartId,
    customerEmail: opts.email,
    customerPhone: opts.phone,
    customerUserId: opts.userId ?? undefined,
    shippingAddress: address(opts.phone),
    couponCode: opts.coupon,
    idempotencyKey: opts.key ?? `finsec_${nonce}_${next()}`,
    paymentMethod: opts.method,
    risk: opts.noRisk ? undefined : { ipAddress: opts.ipAddress ?? ip() },
  });
}

async function webhook(body: Record<string, unknown>, signature?: string | null) {
  const raw = JSON.stringify(body);
  const headers: Record<string, string> = { "content-type": "application/json", "x-real-ip": `198.51.100.${next() % 250}` };
  const sig = signature === undefined ? signSandboxWebhook(raw) : signature;
  if (sig) headers["x-wizz-signature"] = sig;
  const res = await webhookPOST(new NextRequest("http://localhost/api/webhooks/payments", { method: "POST", body: raw, headers }));
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    json = {};
  }
  return { status: res.status, json };
}

const orderOf = (id: string) =>
  prisma.customerOrder.findUniqueOrThrow({
    where: { id },
    include: { paymentAttempts: true, refunds: true, sellerOrders: { include: { items: true, settlementLedgers: true } } },
  });

const auditCount = (entityId: string, action: string) => prisma.auditEvent.count({ where: { entityId, action } });

async function deliver(sellerOrderId: string) {
  const shipment = await createShipment(sellerOrderId, "TCS", `FINSEC-${nonce}-${next()}`);
  await addShipmentMilestone(shipment.id, "DELIVERED");
}

async function run() {
  console.log("=========================================================");
  console.log("💳 WIZZ.PK FINANCIAL SECURITY SUITE (payments, webhooks, refunds, fraud)");
  console.log("=========================================================");
  fx = await setup();
  const { userA, userB } = fx;

  // -----------------------------------------------------------------------------------------
  console.log("\n🧪 [1] Successful sandbox payment (caller's own pending order, exact server total)");
  const o1 = await place({ userId: userA.id, email: userA.email, phone: userA.phone, method: "ONLINE_SANDBOX" });
  assert(o1.status === CustomerOrderStatus.PENDING_PAYMENT && o1.paymentStatus === PaymentStatus.UNPAID, "Online order starts PENDING_PAYMENT / UNPAID");
  const wrongPayer = await expectError(() => executeOrderPayment(o1.id, "any-key-123", { userId: userB.id }));
  assert(wrongPayer?.message.startsWith("FORBIDDEN"), "Another customer cannot trigger payment of this order");
  const pay1 = await executeOrderPayment(o1.id, "unknown-key-xyz", { userId: userA.id });
  const o1After = await orderOf(o1.id);
  assert(pay1.success === true && o1After.paymentStatus === PaymentStatus.PAID && o1After.status === CustomerOrderStatus.PROCESSING, "Sandbox capture marks the order PAID / PROCESSING");
  assert(o1After.paymentAttempts.length === 1 && o1After.paymentAttempts[0].status === PaymentAttemptStatus.SUCCEEDED, "Exactly one attempt, now SUCCEEDED");
  assert(o1After.paymentAttempts[0].amountMinor === o1After.totalMinor, "Captured amount equals the server-computed order total");
  assert(o1After.sellerOrders.every((so) => so.settlementLedgers.filter((l) => l.entryType === SettlementEntryType.ORDER_CREDIT).length === 1), "One escrow credit per package");
  assert((await auditCount(o1.id, "PAYMENT_CAPTURED")) === 1, "PAYMENT_CAPTURED audit event written once");

  // Production: sandbox impossible (server-enforced), attempt untouched.
  const o1b = await place({ userId: userA.id, email: userA.email, phone: userA.phone, method: "ONLINE_SANDBOX" });
  const env = process.env as Record<string, string | undefined>;
  const prevEnv = env.NODE_ENV;
  env.NODE_ENV = "production";
  const prodPay = await expectError(() => executeOrderPayment(o1b.id, "k", { userId: userA.id }));
  const prodMethod = await expectError(async () => assertPaymentMethodAllowed("ONLINE_SANDBOX", 1000));
  env.NODE_ENV = prevEnv;
  const o1bAfter = await orderOf(o1b.id);
  assert(prodPay?.message.startsWith("PAYMENT_METHOD_UNAVAILABLE"), "executeOrderPayment refuses when NODE_ENV=production");
  assert(prodMethod?.message.startsWith("PAYMENT_METHOD_UNAVAILABLE"), "ONLINE_SANDBOX is not an allowed method in production");
  assert(o1bAfter.paymentStatus === PaymentStatus.UNPAID && o1bAfter.paymentAttempts[0].status === PaymentAttemptStatus.PENDING, "Refused production attempt changed nothing");

  // A COD order can never be "paid" through the sandbox path.
  const cod1 = await place({ userId: userB.id, email: userB.email, phone: userB.phone, method: "CASH_ON_DELIVERY" });
  const codPay = await expectError(() => executeOrderPayment(cod1.id, "k", { userId: userB.id }));
  const cod1After = await orderOf(cod1.id);
  assert(Boolean(codPay) && cod1After.paymentStatus === PaymentStatus.UNPAID && cod1After.paymentAttempts[0].status === PaymentAttemptStatus.PENDING, "Sandbox pay on a COD order is refused and the COD attempt is untouched");

  // -----------------------------------------------------------------------------------------
  console.log("\n🧪 [2] Failed payment can never become paid; out-of-order events");
  const o2 = await place({ userId: userA.id, email: userA.email, phone: userA.phone, method: "ONLINE_SANDBOX" });
  const o2Key = (await orderOf(o2.id)).paymentAttempts[0].idempotencyKey;
  const fail = await webhook({ id: `evt_fail_${nonce}`, type: "payment.failed", data: { orderId: o2.id, idempotencyKey: o2Key } });
  let o2After = await orderOf(o2.id);
  assert(fail.status === 200 && o2After.status === CustomerOrderStatus.CANCELLED && o2After.paymentAttempts[0].status === PaymentAttemptStatus.FAILED, "Failure event cancels the unpaid order and fails the attempt");
  const lateOk = await webhook({
    id: `evt_late_${nonce}`,
    type: "payment_intent.succeeded",
    data: { orderId: o2.id, idempotencyKey: o2Key, amountMinor: o2.totalMinor, currency: o2.currency, transactionRef: `TX_LATE_${nonce}` },
  });
  o2After = await orderOf(o2.id);
  assert(lateOk.status === 200 && lateOk.json.requiresRefund === true, "Success after failure is recorded and flagged refund-needed");
  assert(o2After.paymentStatus !== PaymentStatus.PAID && o2After.status === CustomerOrderStatus.CANCELLED, "Cancelled order is NOT revived to paid");
  assert(o2After.paymentAttempts[0].status === PaymentAttemptStatus.FAILED, "FAILED attempt is never moved to SUCCEEDED");
  const lateRefunds = o2After.refunds.filter((r) => r.status === RefundStatus.PENDING && (r.reason || "").startsWith("LATE_PAYMENT"));
  assert(lateRefunds.length === 1 && lateRefunds[0].amountMinor === o2.totalMinor, "One PENDING refund for the late money");
  await webhook({
    id: `evt_late2_${nonce}`,
    type: "payment.captured",
    data: { orderId: o2.id, idempotencyKey: o2Key, amountMinor: o2.totalMinor, currency: o2.currency, transactionRef: `TX_LATE_${nonce}` },
  });
  assert((await orderOf(o2.id)).refunds.length === 1, "A second event for the same late payment does not create a second refund");

  const o2b = await place({ userId: userA.id, email: userA.email, phone: userA.phone, method: "ONLINE_SANDBOX" });
  await executeOrderPayment(o2b.id, "x", { userId: userA.id });
  const failAfterPaid = await webhook({ id: `evt_fail_after_${nonce}`, type: "payment_intent.payment_failed", data: { orderId: o2b.id } });
  const o2bAfter = await orderOf(o2b.id);
  assert(failAfterPaid.status === 200 && o2bAfter.paymentStatus === PaymentStatus.PAID && o2bAfter.status === CustomerOrderStatus.PROCESSING, "Failure arriving after success leaves the order PAID");

  // -----------------------------------------------------------------------------------------
  console.log("\n🧪 [3] Refresh / retry during payment: same key → one order, one attempt");
  const cart3 = await newCart(userA.id);
  const key3 = `finsec_retry_${nonce}`;
  const [r3a, r3b] = await Promise.all([
    place({ userId: userA.id, email: userA.email, phone: userA.phone, method: "ONLINE_SANDBOX", cartId: cart3, key: key3 }),
    place({ userId: userA.id, email: userA.email, phone: userA.phone, method: "ONLINE_SANDBOX", cartId: cart3, key: key3 }),
  ]);
  const r3c = await place({ userId: userA.id, email: userA.email, phone: userA.phone, method: "ONLINE_SANDBOX", cartId: cart3, key: key3 });
  assert(r3a.id === r3b.id && r3b.id === r3c.id, "Concurrent and repeated submissions return the same order");
  await Promise.all([executeOrderPayment(r3a.id, key3, { userId: userA.id }), executeOrderPayment(r3a.id, key3, { userId: userA.id })]);
  await executeOrderPayment(r3a.id, key3, { userId: userA.id });
  const r3 = await orderOf(r3a.id);
  assert(r3.paymentAttempts.length === 1 && r3.paymentStatus === PaymentStatus.PAID, "One attempt and a single PAID transition after repeated pay calls");
  assert(r3.sellerOrders[0].settlementLedgers.filter((l) => l.entryType === SettlementEntryType.ORDER_CREDIT).length === 1, "Escrow credit written once");
  assert((await prisma.customerOrder.count({ where: { paymentAttempts: { some: { idempotencyKey: key3 } } } })) === 1, "Only one order exists for the key");

  // -----------------------------------------------------------------------------------------
  console.log("\n🧪 [4] Duplicate submission with a different key / cart / customer");
  const dupDifferentKey = await expectError(() =>
    place({ userId: userA.id, email: userA.email, phone: userA.phone, method: "ONLINE_SANDBOX", cartId: cart3 })
  );
  assert(dupDifferentKey?.message.startsWith("CART_NOT_ACTIVE"), "Different key, same converted cart → refused");
  const otherCart = await newCart(userA.id);
  const keyOtherCart = await expectError(() =>
    place({ userId: userA.id, email: userA.email, phone: userA.phone, method: "ONLINE_SANDBOX", cartId: otherCart, key: key3 })
  );
  assert(keyOtherCart?.message.startsWith("IDEMPOTENCY_KEY_CONFLICT"), "Same key from a different cart → refused (key bound to its cart)");
  const keyOtherUser = await expectError(() =>
    place({ userId: userB.id, email: userB.email, phone: userB.phone, method: "ONLINE_SANDBOX", key: key3 })
  );
  assert(keyOtherUser?.message.startsWith("IDEMPOTENCY_KEY_CONFLICT"), "Same key from another customer → refused");

  // -----------------------------------------------------------------------------------------
  console.log("\n🧪 [5] Tampered amount / price / coupon fields are ignored");
  const tamperedBody = {
    cartId: "c",
    customerEmail: userA.email,
    shippingAddress: address(userA.phone),
    idempotencyKey: "tampered-key-123",
    paymentMethod: "CASH_ON_DELIVERY",
    totalMinor: 1,
    subtotalMinor: 1,
    discountMinor: 99999999,
    amountMinor: 1,
    unitPriceMinor: 1,
    items: [{ variantId: fx.variantId, priceMinor: 1, quantity: 1 }],
    paymentStatus: "PAID",
  };
  const parsed = placeOrderSchema.safeParse(tamperedBody);
  const keys = parsed.success ? Object.keys(parsed.data) : [];
  assert(
    parsed.success && !["totalMinor", "subtotalMinor", "discountMinor", "amountMinor", "unitPriceMinor", "items", "paymentStatus"].some((k) => keys.includes(k)),
    "Checkout schema strips every client-supplied financial field"
  );
  const cart5 = await newCart(userA.id, 2);
  const expected5 = await calculateCheckoutTotals(cart5, fx.coupon);
  const o5 = await placeOrder({
    ...({ totalMinor: 1, discountMinor: expected5.subtotalMinor, unitPriceMinor: 1, paymentStatus: "PAID" } as Record<string, unknown>),
    cartId: cart5,
    customerEmail: userA.email,
    customerPhone: userA.phone,
    customerUserId: userA.id,
    shippingAddress: address(userA.phone),
    couponCode: fx.coupon,
    idempotencyKey: `finsec_tamper_${nonce}`,
    paymentMethod: "CASH_ON_DELIVERY",
    risk: { ipAddress: ip() },
  } as Parameters<typeof placeOrder>[0]);
  const o5Full = await orderOf(o5.id);
  assert(o5.totalMinor === expected5.totalMinor && o5.totalMinor > 1, "Order total is the server calculation, not the tampered value");
  assert(o5.discountMinor === 5000 && o5Full.paymentStatus === PaymentStatus.UNPAID, "Discount is the coupon's server value; payment status not settable");
  assert(o5Full.sellerOrders[0].items[0].unitPriceMinor === PRICE, "Line price is the catalog price");
  const fakeCoupon = await expectError(() => place({ userId: userB.id, email: userB.email, phone: userB.phone, method: "CASH_ON_DELIVERY", coupon: "FAKE100PERCENT" }));
  assert(fakeCoupon?.message.startsWith("COUPON_INVALID"), "Unknown coupon is refused");
  const capSmall = await calculateCheckoutTotals(await newCart(null, 1), fx.capCoupon);
  assert(capSmall.discountMinor === 0 && Boolean(capSmall.couponError), "Coupon minimum order enforced server-side");
  const capBig = await calculateCheckoutTotals(await newCart(null, 3), fx.capCoupon);
  assert(capBig.discountMinor === 1000, "Percentage coupon capped at its max discount server-side", String(capBig.discountMinor));

  // Ended (not yet synced) deal: the regular price is charged.
  await prisma.productVariant.update({
    where: { id: fx.variantId },
    data: {
      priceMinor: 50000,
      compareAtPriceMinor: PRICE,
      dealPriceMinor: 50000,
      dealStartsAt: new Date(Date.now() - 2 * 3600_000),
      dealEndsAt: new Date(Date.now() - 60_000),
      dealRegularPriceMinor: PRICE,
    },
  });
  const oDeal = await place({ userId: userB.id, email: userB.email, phone: userB.phone, method: "CASH_ON_DELIVERY" });
  const oDealFull = await orderOf(oDeal.id);
  assert(oDealFull.sellerOrders[0].items[0].unitPriceMinor === PRICE, "Stale cart after a deal ended is charged the regular price");

  // -----------------------------------------------------------------------------------------
  console.log("\n🧪 [6] A customer cannot read, pay, cancel or return another customer's order");
  const bOrders = await getUserOrders(userB.id);
  assert(!bOrders.some((o) => o.id === o1.id), "Order list of B never contains A's order");
  assert(!verifyOrderAccessToken(o1.id, createOrderAccessToken(cod1.id)), "Guest access token of one order does not open another");
  const cancelOther = await expectError(() => requestOrderCancellation(o1b.id, userB.id, "not mine"));
  assert(cancelOther?.message.includes("FORBIDDEN") && (await orderOf(o1b.id)).status === CustomerOrderStatus.PENDING_PAYMENT, "B cannot cancel A's order");
  await deliver(o1After.sellerOrders[0].id);
  const returnOther = await expectError(() =>
    createReturnRequest(o1After.sellerOrders[0].id, userB.id, o1After.sellerOrders[0].items[0].id, 1, "DEFECTIVE", "not mine", o1.id)
  );
  assert(returnOther?.message.includes("FORBIDDEN"), "B cannot return items from A's order");

  // -----------------------------------------------------------------------------------------
  console.log("\n🧪 [10] Refunds: authorised path only, never above what was paid");
  assert(
    !ADMIN_ACTION_ROLES.returnRefund.includes(UserRole.PLATFORM_SUPPORT) && !ADMIN_ACTION_ROLES.returnRefund.includes(UserRole.PLATFORM_CATALOG_ADMIN),
    "Only finance roles may record return refunds"
  );
  const pendingLate = lateRefunds[0];
  const anonComplete = await refundCompletePOST(
    new NextRequest(`http://localhost/api/admin/refunds/${pendingLate.id}/complete`, { method: "POST", body: JSON.stringify({ reference: "FAKE-REF-1" }) }),
    { params: Promise.resolve({ id: pendingLate.id }) }
  );
  const lateAfter = await prisma.refund.findUniqueOrThrow({ where: { id: pendingLate.id } });
  assert(anonComplete.status === 401 && lateAfter.status === RefundStatus.PENDING, "Unauthenticated refund completion is refused and nothing changes", String(anonComplete.status));
  const anonResolve = await returnResolvePOST(
    new NextRequest("http://localhost/api/admin/returns/x/resolve", { method: "POST", body: JSON.stringify({ action: "RECORD_REFUND", refundReference: "FAKE-REF-2" }) }),
    { params: Promise.resolve({ id: "x" }) }
  );
  assert(anonResolve.status === 401, "Unauthenticated return refund recording is refused", String(anonResolve.status));

  const unpaidCod = await expectError(() => prisma.$transaction((tx) => assertRefundWithinPaid(tx, { customerOrderId: cod1.id, amountMinor: 100 })));
  assert(unpaidCod?.message.includes("not been paid"), "Refund for an unpaid COD order is refused (nothing to refund)");
  const over = await expectError(() => prisma.$transaction((tx) => assertRefundWithinPaid(tx, { customerOrderId: o1.id, amountMinor: o1.totalMinor + 1 })));
  assert(over?.message.includes("exceed"), "Refund above the order total is refused");
  const overPkg = await expectError(() =>
    prisma.$transaction((tx) => assertRefundWithinPaid(tx, { customerOrderId: o1.id, sellerOrderId: o1After.sellerOrders[0].id, amountMinor: o1After.sellerOrders[0].totalMinor + 1 }))
  );
  assert(overPkg?.message.includes("exceed"), "Refund above the package total is refused");
  const within = await prisma.$transaction((tx) => assertRefundWithinPaid(tx, { customerOrderId: o1.id, amountMinor: 100 }));
  assert(within.remainingOrderMinor === o1.totalMinor - 100, "Refund within the paid amount is allowed");

  // Paid package cancelled after a partial chargeback: refund capped at what is left.
  const o10 = await place({ userId: userA.id, email: userA.email, phone: userA.phone, method: "ONLINE_SANDBOX", qty: 2 });
  await executeOrderPayment(o10.id, "k", { userId: userA.id });
  await recordChargeback(o10.id, 30000, `DSP-PART-${nonce}`);
  const o10Full = await orderOf(o10.id);
  await cancelSellerSuborder(o10Full.sellerOrders[0].id, "seller out of stock", fx.admin.id);
  const o10Refunds = (await orderOf(o10.id)).refunds;
  const o10Sum = o10Refunds.reduce((s, r) => s + r.amountMinor, 0);
  assert(o10Sum === o10.totalMinor, "Cancellation refund + chargeback never exceed the package total", `${o10Sum} vs ${o10.totalMinor}`);

  // -----------------------------------------------------------------------------------------
  console.log("\n🧪 [13] Duplicate webhooks are processed once");
  const o13 = await place({ userId: userB.id, email: userB.email, phone: userB.phone, method: "ONLINE_SANDBOX" });
  const evt13 = {
    id: `evt_dup_${nonce}`,
    type: "payment_intent.succeeded",
    data: { orderId: o13.id, amountMinor: o13.totalMinor, currency: o13.currency, transactionRef: `TX13_${nonce}` },
  };
  const [d1, d2] = await Promise.all([webhook(evt13), webhook(evt13)]);
  const d3 = await webhook(evt13);
  const statuses = [d1.json.status, d2.json.status, d3.json.status];
  assert(statuses.filter((s) => s === "PROCESSED").length === 1 && statuses.filter((s) => s === "ALREADY_PROCESSED").length === 2, "Concurrent + replayed duplicates: one PROCESSED, rest ALREADY_PROCESSED", statuses.join(","));
  const o13After = await orderOf(o13.id);
  assert(o13After.paymentStatus === PaymentStatus.PAID && (await auditCount(o13.id, "PAYMENT_CAPTURED")) === 1, "Payment applied exactly once");
  assert(o13After.sellerOrders[0].settlementLedgers.length === 1, "Single seller escrow entry");

  // -----------------------------------------------------------------------------------------
  console.log("\n🧪 [14] Invalid / missing signature → 401 and nothing changes; mismatches rejected");
  const o14 = await place({ userId: userB.id, email: userB.email, phone: userB.phone, method: "ONLINE_SANDBOX" });
  const evt14 = { id: `evt_sig_${nonce}`, type: "payment_intent.succeeded", data: { orderId: o14.id, amountMinor: o14.totalMinor, currency: o14.currency } };
  const noSig = await webhook(evt14, null);
  const badSig = await webhook(evt14, "0".repeat(64));
  const wrongBodySig = await webhook(evt14, signSandboxWebhook(JSON.stringify({ ...evt14, data: { ...evt14.data, amountMinor: 1 } })));
  const o14After = await orderOf(o14.id);
  assert(noSig.status === 401 && badSig.status === 401 && wrongBodySig.status === 401, "Missing, forged and wrong-body signatures → 401", `${noSig.status}/${badSig.status}/${wrongBodySig.status}`);
  assert(o14After.paymentStatus === PaymentStatus.UNPAID && !(await prisma.webhookEvent.findUnique({ where: { externalEventId: evt14.id } })), "No order change and no event stored for rejected signatures");
  const malformed = await webhook({ id: `evt_bad_${nonce}`, type: "payment_intent.succeeded", data: { orderId: o14.id } });
  assert(malformed.status === 400, "Signed but incomplete payment event → 400 (amount/currency required)");
  const amountMismatch = await webhook({ id: `evt_amt_${nonce}`, type: "payment_intent.succeeded", data: { orderId: o14.id, amountMinor: o14.totalMinor - 1, currency: o14.currency } });
  const currencyMismatch = await webhook({ id: `evt_cur_${nonce}`, type: "payment_intent.succeeded", data: { orderId: o14.id, amountMinor: o14.totalMinor, currency: "USD" } });
  const o13Key = (await orderOf(o13.id)).paymentAttempts[0].idempotencyKey;
  const orderMismatch = await webhook({ id: `evt_ord_${nonce}`, type: "payment_intent.succeeded", data: { orderId: o14.id, idempotencyKey: o13Key, amountMinor: o14.totalMinor, currency: o14.currency } });
  assert(
    [amountMismatch, currencyMismatch, orderMismatch].every((r) => r.status === 200 && r.json.status === "REJECTED"),
    "Amount, currency and order-id mismatches are rejected (final, no retry)",
    [amountMismatch, currencyMismatch, orderMismatch].map((r) => `${r.status}:${r.json.status}:${r.json.reason}`).join(" ")
  );
  assert((await orderOf(o14.id)).paymentStatus === PaymentStatus.UNPAID, "Order stays unpaid after mismatched events");
  assert((await prisma.auditEvent.count({ where: { action: RISK_RULES.PAYMENT_MISMATCH, entityId: o14.id } })) >= 2, "Mismatches land in the risk review queue");
  const codSuccess = await webhook({ id: `evt_cod_${nonce}`, type: "payment_intent.succeeded", data: { orderId: cod1.id, amountMinor: cod1.totalMinor, currency: cod1.currency } });
  const codFail = await webhook({ id: `evt_codf_${nonce}`, type: "payment.failed", data: { orderId: cod1.id } });
  const cod1Now = await orderOf(cod1.id);
  assert(codSuccess.json.status === "REJECTED" && codFail.json.status === "REJECTED", "Online payment events for a COD order are rejected");
  assert(cod1Now.paymentStatus === PaymentStatus.UNPAID && cod1Now.status === CustomerOrderStatus.PROCESSING, "COD order neither paid nor cancelled by online events");
  const valid14 = await webhook(evt14);
  assert(valid14.status === 200 && (await orderOf(o14.id)).paymentStatus === PaymentStatus.PAID, "The correctly signed event is then applied");

  // -----------------------------------------------------------------------------------------
  console.log("\n🧪 [15] Payment succeeded but the app failed to update the order → reconciled");
  // (a) Webhook: an internal failure mid-transaction rolls everything back and answers 500.
  const o15 = await place({ userId: userB.id, email: userB.email, phone: userB.phone, method: "ONLINE_SANDBOX" });
  const level = await prisma.inventoryLevel.findUniqueOrThrow({ where: { variantId: fx.variantId } });
  await prisma.inventoryLevel.delete({ where: { variantId: fx.variantId } }); // forces the stock commit to fail
  const evt15 = { id: `evt_crash_${nonce}`, type: "payment.captured", data: { orderId: o15.id, amountMinor: o15.totalMinor, currency: o15.currency, transactionRef: `TX15_${nonce}` } };
  const crash = await webhook(evt15);
  const o15Mid = await orderOf(o15.id);
  const ev15 = await prisma.webhookEvent.findUnique({ where: { externalEventId: evt15.id } });
  await prisma.inventoryLevel.create({ data: { variantId: fx.variantId, sellerOrgId: level.sellerOrgId, availableUnits: level.availableUnits, reservedUnits: level.reservedUnits } });
  assert(crash.status === 500, "Internal failure while applying a webhook → 500 so the provider retries", String(crash.status));
  assert(o15Mid.paymentStatus === PaymentStatus.UNPAID && o15Mid.paymentAttempts[0].status === PaymentAttemptStatus.PENDING && o15Mid.sellerOrders[0].settlementLedgers.length === 0, "Nothing was half-applied (transaction rolled back)");
  assert(ev15?.status === "FAILED", "Event stored as FAILED for reconciliation");

  // (b) Sandbox: provider capture succeeds, applying it fails.
  const o15c = await place({ userId: userB.id, email: userB.email, phone: userB.phone, method: "ONLINE_SANDBOX" });
  const lvl2 = await prisma.inventoryLevel.findUniqueOrThrow({ where: { variantId: fx.variantId } });
  await prisma.inventoryLevel.delete({ where: { variantId: fx.variantId } });
  const payPending = await executeOrderPayment(o15c.id, "k", { userId: userB.id });
  await prisma.inventoryLevel.create({ data: { variantId: fx.variantId, sellerOrgId: lvl2.sellerOrgId, availableUnits: lvl2.availableUnits, reservedUnits: lvl2.reservedUnits } });
  const o15cMid = await orderOf(o15c.id);
  assert(
    (payPending as { pendingConfirmation?: boolean }).pendingConfirmation === true && o15cMid.paymentAttempts[0].status === PaymentAttemptStatus.SUCCEEDED && o15cMid.paymentStatus === PaymentStatus.UNPAID,
    "Sandbox capture is recorded on the attempt even though applying it failed"
  );
  // Make it look old: expiry must NOT cancel an order whose capture succeeded.
  await prisma.customerOrder.update({ where: { id: o15c.id }, data: { createdAt: new Date(Date.now() - 2 * 3600_000) } });
  await prisma.webhookEvent.update({ where: { externalEventId: evt15.id }, data: { processedAt: new Date(Date.now() - 10 * 60_000) } });
  await cancelExpiredUnpaidOrders();
  assert((await orderOf(o15c.id)).status === CustomerOrderStatus.PENDING_PAYMENT, "Expiry sweep skips an order whose capture succeeded but was not applied");
  const rec = await reconcilePayments();
  const o15Final = await orderOf(o15.id);
  const o15cFinal = await orderOf(o15c.id);
  assert(rec.capturesApplied >= 1 && rec.webhooksReprocessed >= 1, "Reconciliation applied the recorded capture and re-processed the failed webhook", JSON.stringify(rec));
  assert(o15Final.paymentStatus === PaymentStatus.PAID && (await prisma.webhookEvent.findUnique({ where: { externalEventId: evt15.id } }))?.status === "PROCESSED", "Failed webhook re-processed → order PAID, event PROCESSED");
  assert(o15cFinal.paymentStatus === PaymentStatus.PAID && o15cFinal.status === CustomerOrderStatus.PROCESSING, "Recorded sandbox capture applied → order PAID (not expired)");
  assert((await auditCount(o15c.id, "PAYMENT_RECONCILED")) === 1 && (await prisma.auditEvent.count({ where: { action: "WEBHOOK_REPROCESSED", entityId: ev15!.id } })) === 1, "Each reconciliation wrote an audit event");
  const rec2 = await reconcilePayments();
  assert((await auditCount(o15c.id, "PAYMENT_RECONCILED")) === 1 && (await auditCount(o15c.id, "PAYMENT_CAPTURED")) === 1, "Re-running reconciliation is a no-op for these orders", JSON.stringify(rec2));
  // Expiry still cancels genuinely unpaid online orders and releases their stock.
  const o15d = await place({ userId: userB.id, email: userB.email, phone: userB.phone, method: "ONLINE_SANDBOX" });
  await prisma.customerOrder.update({ where: { id: o15d.id }, data: { createdAt: new Date(Date.now() - 2 * 3600_000) } });
  await cancelExpiredUnpaidOrders();
  const o15dFinal = await orderOf(o15d.id);
  const activeHolds = await prisma.inventoryReservation.count({ where: { orderId: o15d.id, status: "ACTIVE" } });
  assert(o15dFinal.status === CustomerOrderStatus.CANCELLED && activeHolds === 0 && (await auditCount(o15d.id, "UNPAID_ORDER_CANCELLED")) === 1, "Unpaid online order past its window is cancelled with stock released and audited");

  // -----------------------------------------------------------------------------------------
  console.log("\n🧪 [16] Refund + chargeback consistency (ledger sums)");
  const o16 = await place({ userId: userA.id, email: userA.email, phone: userA.phone, method: "ONLINE_SANDBOX", qty: 2 });
  await executeOrderPayment(o16.id, "k", { userId: userA.id });
  let o16Full = await orderOf(o16.id);
  const pkg = o16Full.sellerOrders[0];
  await deliver(pkg.id);
  const ret = await createReturnRequest(pkg.id, userA.id, pkg.items[0].id, 1, "DEFECTIVE", "broken lid", o16.id);
  await transitionReturnRequest(ret.id, "APPROVE", { actorUserId: fx.admin.id });
  await transitionReturnRequest(ret.id, "MARK_RECEIVED", { actorUserId: fx.admin.id });
  await transitionReturnRequest(ret.id, "RECORD_REFUND", { actorUserId: fx.admin.id, refundReference: `BANK-${nonce}` });
  o16Full = await orderOf(o16.id);
  const returnRefund = o16Full.refunds.find((r) => r.reason?.startsWith("Return"))!;
  const remaining = o16.totalMinor - returnRefund.amountMinor;
  const tooBig = await expectError(() => recordChargeback(o16.id, o16.totalMinor + 1, `DSP-BIG-${nonce}`));
  assert(tooBig?.message.startsWith("VALIDATION"), "Chargeback above the captured amount is refused");
  const codCb = await expectError(() => recordChargeback(cod1.id, 100, `DSP-COD-${nonce}`));
  assert(codCb?.message.startsWith("VALIDATION"), "Chargeback on a COD order is refused");
  const cb = await webhook({
    id: `evt_dispute_${nonce}`,
    type: "charge.dispute.created",
    data: { orderId: o16.id, amountMinor: remaining, currency: o16.currency, disputeId: `DSP-${nonce}` },
  });
  const cbDup = await webhook({
    id: `evt_dispute_${nonce}`,
    type: "charge.dispute.created",
    data: { orderId: o16.id, amountMinor: remaining, currency: o16.currency, disputeId: `DSP-${nonce}` },
  });
  const cbAgain = await recordChargeback(o16.id, remaining, `DSP-${nonce}`);
  assert(cb.json.status === "PROCESSED" && cbDup.json.status === "ALREADY_PROCESSED" && cbAgain.alreadyRecorded === true, "Dispute webhook recorded once (idempotent by event id and dispute ref)");
  o16Full = await orderOf(o16.id);
  const refundsSum = o16Full.refunds.filter((r) => r.status !== RefundStatus.FAILED).reduce((s, r) => s + r.amountMinor, 0);
  assert(o16Full.refunds.length === 2 && refundsSum === o16.totalMinor, "Return refund + chargeback = exactly the amount paid", `${refundsSum}/${o16.totalMinor}`);
  const pkgNow = o16Full.sellerOrders[0];
  const ledger = pkgNow.settlementLedgers;
  const credit = ledger.find((l) => l.entryType === SettlementEntryType.ORDER_CREDIT)!;
  const refundDebit = ledger.find((l) => l.entryType === SettlementEntryType.REFUND_DEBIT)!;
  const cbDebit = ledger.find((l) => l.entryType === SettlementEntryType.ADJUSTMENT)!;
  const commission = Math.round((returnRefund.amountMinor * 10) / 100);
  // Seller share of the chargeback uses the original net/total ratio, capped by what is left after the return debit.
  const expectedCbDebit = Math.min(pkgNow.netSellerPayableMinor, Math.round((remaining * pkg.netSellerPayableMinor) / pkg.totalMinor));
  assert(refundDebit.amountMinor === -(returnRefund.amountMinor - commission), "Return refund debits the seller net of commission");
  assert(cbDebit.amountMinor === -expectedCbDebit && cbDebit.status === SettlementStatus.HELD, "Chargeback creates a HELD seller debit for the seller's share", `${cbDebit.amountMinor} vs -${expectedCbDebit}`);
  assert(credit.status === SettlementStatus.HELD, "Unsettled package credit is put on hold during the dispute");
  const ledgerSum = ledger.reduce((s, l) => s + l.amountMinor, 0);
  assert(ledgerSum === credit.amountMinor - (returnRefund.amountMinor - commission) - expectedCbDebit && credit.amountMinor === pkg.netSellerPayableMinor, "Seller ledger sums reconcile: credit − refund debit − chargeback debit");
  assert(ledgerSum >= 0, "Seller is never debited more than the package credited them");
  const noMore = await expectError(() => prisma.$transaction((tx) => assertRefundWithinPaid(tx, { customerOrderId: o16.id, amountMinor: 1 })));
  assert(noMore?.message.includes("exceed"), "No further refund possible once refunds + chargebacks reach the amount paid");
  assert((await prisma.auditEvent.count({ where: { action: RISK_RULES.CHARGEBACK, entityId: o16.id } })) === 1 && (await auditCount(o16.id, "CHARGEBACK_RECORDED")) === 1, "Chargeback audited and flagged for review once");

  // -----------------------------------------------------------------------------------------
  console.log("\n🧪 [F1] Velocity limits (COD per phone/email, open COD, IP)");
  const vEmail = `finsec.velocity.${nonce}@example.test`;
  for (let i = 0; i < RISK_LIMITS.codOrdersPer24h; i++) {
    await place({ email: i % 2 ? vEmail.toUpperCase() : vEmail, phone: phone(100 + i), method: "CASH_ON_DELIVERY" });
  }
  const sixth = await expectError(() => place({ email: vEmail.replace("@", "+promo@"), phone: phone(150), method: "CASH_ON_DELIVERY" }));
  assert(sixth instanceof RiskBlockedError && sixth.event.rule === RISK_RULES.COD_VELOCITY && sixth.httpStatus === 429, `COD order #${RISK_LIMITS.codOrdersPer24h + 1} for the same email (case / +tag variants) in 24h is blocked`);
  const onlineStill = await place({ email: vEmail, phone: phone(151), method: "ONLINE_SANDBOX" }).catch((e: Error) => e);
  assert(!(onlineStill instanceof Error), "COD velocity does not block online payment");
  const openPhone = phone(200);
  for (let i = 0; i < RISK_LIMITS.openCodOrdersPerPhone; i++) {
    await place({ email: `finsec.open${i}.${nonce}@example.test`, phone: openPhone, method: "CASH_ON_DELIVERY" });
  }
  const openBlocked = await expectError(() => place({ email: `finsec.open9.${nonce}@example.test`, phone: openPhone.replace(/\s/g, "").replace("+92", "0"), method: "CASH_ON_DELIVERY" }));
  assert(openBlocked instanceof RiskBlockedError && openBlocked.event.rule === RISK_RULES.COD_OPEN_ORDERS, "4th open COD order on the same phone (any format) is blocked");
  assert((await prisma.auditEvent.count({ where: { action: RISK_RULES.COD_OPEN_ORDERS, detailsJson: { contains: `"phoneLast4":"${openPhone.slice(-4)}"` } } })) >= 1, "Blocked attempt recorded as RISK_COD_OPEN_ORDERS");
  const ipAddr = `203.0.113.${next() % 250}`;
  let ipBlocked: unknown = null;
  for (let i = 0; i <= RISK_LIMITS.orderAttemptsPerIpPerHour; i++) {
    try {
      assertIpOrderVelocity({ email: "x@example.test", ipAddress: ipAddr });
    } catch (e) {
      ipBlocked = e;
    }
  }
  assert(ipBlocked instanceof RiskBlockedError && ipBlocked.httpStatus === 429, `Attempt #${RISK_LIMITS.orderAttemptsPerIpPerHour + 1} from one IP within an hour is blocked`);
  const ipViaCheckout = await expectError(() => place({ email: `finsec.ip.${nonce}@example.test`, phone: phone(300), method: "CASH_ON_DELIVERY", ipAddress: ipAddr }));
  assert(ipViaCheckout instanceof RiskBlockedError && ipViaCheckout.event.rule === RISK_RULES.IP_VELOCITY, "placeOrder enforces the IP limit");

  // -----------------------------------------------------------------------------------------
  console.log("\n🧪 [F2] Coupon: one use per customer (account, email, phone), atomic");
  const user3 = await prisma.user.create({
    data: { email: `finsec.c.${nonce}@example.test`, passwordHash: "x", firstName: "C", lastName: "C", phone: phone(400), role: UserRole.CUSTOMER },
  });
  const couponBefore = await prisma.coupon.findUniqueOrThrow({ where: { code: fx.coupon } });
  const c1 = await place({ userId: user3.id, email: user3.email, phone: user3.phone!, method: "ONLINE_SANDBOX", coupon: fx.coupon.toLowerCase() });
  const c2 = await expectError(() => place({ userId: user3.id, email: user3.email, phone: user3.phone!, method: "ONLINE_SANDBOX", coupon: fx.coupon }));
  assert(c2 instanceof RiskBlockedError && c2.event.rule === RISK_RULES.COUPON_REUSE && c2.httpStatus === 400, "Same account cannot use the coupon twice");
  const c3 = await expectError(() => place({ email: user3.email.replace("@", "+x@").toUpperCase(), phone: phone(401), method: "CASH_ON_DELIVERY", coupon: fx.coupon }));
  const c4 = await expectError(() => place({ email: `finsec.other.${nonce}@example.test`, phone: user3.phone!.replace("+92 ", "0"), method: "CASH_ON_DELIVERY", coupon: fx.coupon }));
  assert(c3 instanceof RiskBlockedError && c4 instanceof RiskBlockedError, "Guest with the same email (+tag/case) or same phone cannot reuse it");
  const calcReuse = await calculateCheckoutTotals(await newCart(user3.id), fx.coupon, "STANDARD", { userId: user3.id, email: user3.email });
  assert(calcReuse.couponError === COUPON_ALREADY_USED_MESSAGE && calcReuse.discountMinor === 0, "Checkout calculation already tells a signed-in customer the coupon was used");
  const couponAfter = await prisma.coupon.findUniqueOrThrow({ where: { code: fx.coupon } });
  assert(couponAfter.timesUsed === couponBefore.timesUsed + 1, "Refused attempts did not consume coupon usage");
  await requestOrderCancellation(c1.id, user3.id, "changed mind");
  const c5 = await place({ userId: user3.id, email: user3.email, phone: user3.phone!, method: "ONLINE_SANDBOX", coupon: fx.coupon }).catch((e: Error) => e);
  assert(!(c5 instanceof Error), "After cancelling, the coupon use is given back to the customer");
  const raceEmail = `finsec.race.${nonce}@example.test`;
  const raced = await Promise.allSettled([
    place({ email: raceEmail, phone: phone(500), method: "CASH_ON_DELIVERY", coupon: fx.coupon }),
    place({ email: raceEmail, phone: phone(501), method: "CASH_ON_DELIVERY", coupon: fx.coupon }),
    place({ email: raceEmail, phone: phone(502), method: "CASH_ON_DELIVERY", coupon: fx.coupon }),
  ]);
  assert(raced.filter((r) => r.status === "fulfilled").length === 1, "Concurrent checkouts by one customer: exactly one gets the coupon", raced.map((r) => r.status).join(","));

  // -----------------------------------------------------------------------------------------
  console.log("\n🧪 [F3] COD cancellation abuse → sign-in required, flagged for review");
  const user4 = await prisma.user.create({
    data: { email: `finsec.d.${nonce}@example.test`, passwordHash: "x", firstName: "D", lastName: "D", phone: phone(600), role: UserRole.CUSTOMER },
  });
  for (let i = 0; i < RISK_LIMITS.codCustomerCancellations; i++) {
    const o = await place({ userId: user4.id, email: user4.email, phone: user4.phone!, method: "CASH_ON_DELIVERY" });
    await requestOrderCancellation(o.id, user4.id, "no longer needed");
  }
  const guestCod = await expectError(() => place({ email: `finsec.d2.${nonce}@example.test`, phone: user4.phone!, method: "CASH_ON_DELIVERY" }));
  assert(guestCod instanceof RiskBlockedError && guestCod.event.rule === RISK_RULES.COD_CANCELLATION_ABUSE && guestCod.httpStatus === 401, "Guest COD refused for a phone with repeated customer cancellations (sign in required)");
  const signedCod = await place({ userId: user4.id, email: user4.email, phone: user4.phone!, method: "CASH_ON_DELIVERY" });
  const flag = await prisma.auditEvent.findFirst({ where: { action: RISK_RULES.COD_CANCELLATION_ABUSE, entityId: signedCod.id } });
  assert(signedCod.status === CustomerOrderStatus.PROCESSING && Boolean(flag) && flag!.detailsJson.includes('"decision":"FLAGGED"'), "Signed-in COD allowed and flagged for review (no automatic block)");

  // -----------------------------------------------------------------------------------------
  console.log("\n🧪 [F4] Refund / return abuse → review flag only");
  const refundedSo = o16Full.sellerOrders[0];
  for (let i = 0; i < RISK_LIMITS.refundedReturns; i++) {
    await prisma.returnRequest.create({
      data: { sellerOrderId: refundedSo.id, customerUserId: userB.id, reasonCode: "DEFECTIVE", explanation: "fixture", status: "REFUNDED" },
    });
  }
  const oAbuse = await place({ userId: userB.id, email: userB.email, phone: userB.phone, method: "ONLINE_SANDBOX" });
  const abuseFlags = await prisma.auditEvent.count({ where: { action: RISK_RULES.REFUND_ABUSE, detailsJson: { contains: `"userId":"${userB.id}"` } } });
  await scanRefundAbuse();
  await place({ userId: userB.id, email: userB.email, phone: userB.phone, method: "ONLINE_SANDBOX" });
  const abuseFlagsAfter = await prisma.auditEvent.count({ where: { action: RISK_RULES.REFUND_ABUSE, detailsJson: { contains: `"userId":"${userB.id}"` } } });
  assert(abuseFlags === 1 && abuseFlagsAfter === 1 && oAbuse.status === CustomerOrderStatus.PENDING_PAYMENT, "Customer with many refunded returns is flagged once; ordering is not blocked");

  // -----------------------------------------------------------------------------------------
  console.log("\n🧪 [F5] Admin review queue");
  const open = await listRiskEvents({ status: "open", q: user4.email });
  assert(open.events.some((e) => e.action === RISK_RULES.COD_CANCELLATION_ABUSE), "Review queue lists the customer's risk events (search by email)");
  const target = open.events[0];
  const r1 = await markRiskEventReviewed(target.id, fx.admin.id, "Called customer, genuine");
  const r2 = await markRiskEventReviewed(target.id, fx.admin.id, "again");
  const reviewed = await listRiskEvents({ status: "reviewed", q: user4.email });
  const stillOpen = await listRiskEvents({ status: "open", q: user4.email });
  assert(!r1.alreadyReviewed && r2.alreadyReviewed, "Mark reviewed is idempotent");
  assert(reviewed.events.some((e) => e.id === target.id && e.review?.note === "Called customer, genuine") && !stillOpen.events.some((e) => e.id === target.id), "Reviewed event moves from 'open' to 'reviewed' with reviewer note");
  const notRisk = await prisma.auditEvent.findFirstOrThrow({ where: { action: "PAYMENT_CAPTURED" } });
  const badReview = await expectError(() => markRiskEventReviewed(notRisk.id, fx.admin.id));
  assert(badReview?.message.startsWith("VALIDATION"), "Only RISK_* events can be marked reviewed");

  // Direct (non-HTTP) internal callers still dedupe events without a signature.
  const internal = await processPaymentWebhook("LOCAL_SANDBOX", `evt_internal_${nonce}`, "payment_intent.succeeded", { orderId: o14.id });
  assert(internal.status === "PROCESSED" && internal.alreadyPaid === true, "Internal re-delivery for a paid order is a no-op");
}

async function cleanup() {
  if (!fx) return;
  await prisma.product.update({ where: { id: fx.productId }, data: { status: ProductStatus.ARCHIVED } }).catch(() => undefined);
  await prisma.sellerOrg.update({ where: { id: fx.sellerOrgId }, data: { operationalStatus: SellerOperationalStatus.INACTIVE } }).catch(() => undefined);
  await prisma.coupon.updateMany({ where: { code: { in: [fx.coupon, fx.capCoupon] } }, data: { isActive: false } }).catch(() => undefined);
}

run()
  .catch((err) => {
    console.error("💥 Unhandled error in financial security suite:", err);
    failed++;
  })
  .finally(async () => {
    await cleanup();
    console.log("\n=========================================================");
    console.log(`🏁 FINANCIAL SECURITY RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("=========================================================");
    await prisma.$disconnect();
    process.exit(failed > 0 ? 1 : 0);
  });
