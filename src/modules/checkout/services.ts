import crypto from "crypto";
import { syncDealPricing } from "@/modules/sellers/deal-pricing";
import { prisma } from "@/lib/db";
import { SITE_CONFIG } from "@/lib/config";
import {
  DiscountType,
  CustomerOrderStatus,
  PaymentStatus,
  SellerOrderStatus,
  PaymentAttemptProvider,
  CodCollectionStatus,
  CodRemittanceStatus,
} from "@prisma/client";
import { Prisma } from "@prisma/client";
import { createStockReservation, commitOrderReservations } from "../inventory/services";
import { assertPaymentMethodAllowed } from "@/lib/payment-methods";
import { enqueueJob } from "@/lib/jobs";

export interface CheckoutAddress {
  fullName: string;
  phone: string;
  street1: string;
  street2?: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  countryCode: string;
}

export interface CalculatedItem {
  variantId: string;
  productTitle: string;
  variantName: string;
  sku: string;
  sellerOrgId: string;
  sellerName: string;
  quantity: number;
  unitPriceMinor: number;
  lineSubtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
}

export interface SellerPackageCalculation {
  sellerOrgId: string;
  sellerName: string;
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
  commissionRatePercent: number;
  platformCommissionMinor: number;
  netSellerPayableMinor: number;
  items: CalculatedItem[];
}

export interface CalculationResult {
  items: CalculatedItem[];
  sellerPackages: SellerPackageCalculation[];
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
  appliedCoupon?: {
    code: string;
    discountMinor: number;
  };
  couponError?: string;
  reconciliation: {
    isExact: boolean;
    customerTotalMinor: number;
    sumSellerTotalsMinor: number;
    roundingDiscrepancyMinor: number;
  };
}

/**
 * Deterministic pro-rata discount allocation algorithm.
 * Guarantees exact sum equality: sum(allocated) === min(totalDiscount, totalSubtotal).
 * Remaining cents/paisas are deterministically added to the item with the largest subtotal.
 * Ties are broken deterministically using alphabetical ID sorting.
 */
export function allocateProRataDiscount(
  totalDiscountMinor: number,
  subtotals: Array<{ id: string; subtotalMinor: number }>
): Map<string, number> {
  const result = new Map<string, number>();
  const totalSubtotal = subtotals.reduce((sum, item) => sum + item.subtotalMinor, 0);

  if (totalDiscountMinor <= 0 || totalSubtotal <= 0) {
    for (const item of subtotals) {
      result.set(item.id, 0);
    }
    return result;
  }

  const effectiveDiscount = Math.min(totalDiscountMinor, totalSubtotal);
  let allocatedSum = 0;

  for (const item of subtotals) {
    const rawDiscount = Math.floor((item.subtotalMinor / totalSubtotal) * effectiveDiscount);
    result.set(item.id, rawDiscount);
    allocatedSum += rawDiscount;
  }

  let remainder = effectiveDiscount - allocatedSum;
  if (remainder > 0) {
    const sorted = [...subtotals].sort((a, b) => {
      if (b.subtotalMinor !== a.subtotalMinor) {
        return b.subtotalMinor - a.subtotalMinor;
      }
      return a.id.localeCompare(b.id);
    });

    let idx = 0;
    while (remainder > 0 && idx < sorted.length) {
      const targetId = sorted[idx].id;
      result.set(targetId, (result.get(targetId) || 0) + 1);
      remainder--;
      idx = (idx + 1) % sorted.length;
    }
  }

  return result;
}

export async function calculateCheckoutTotals(
  cartId: string,
  couponCode?: string,
  shippingTier: "STANDARD" | "EXPRESS" = "STANDARD"
): Promise<CalculationResult> {
  // Apply any deal that started or ended since the last scheduler tick, so the
  // price charged always matches the deal window.
  const cartVariants = await prisma.cartItem.findMany({ where: { cartId }, select: { variantId: true } });
  await syncDealPricing({ variantIds: cartVariants.map((ci) => ci.variantId) });

  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: {
                include: { sellerOrg: true },
              },
            },
          },
        },
      },
    },
  });

  if (!cart || cart.items.length === 0) {
    throw new Error("Cart is empty or not found.");
  }

  if (cart.status !== "ACTIVE") {
    throw new Error("CART_NOT_ACTIVE: This cart has already been checked out. Please start a new cart.");
  }

  // Server check: every line must still be purchasable at the current server-side price/stock
  const levels = await prisma.inventoryLevel.findMany({
    where: { variantId: { in: cart.items.map((ci) => ci.variantId) } },
  });
  const levelByVariant = new Map(levels.map((l) => [l.variantId, l]));

  for (const ci of cart.items) {
    const product = ci.variant.product;
    if (product.sellerOrg.operationalStatus !== "ACTIVE") {
      throw new Error(
        `Item "${product.title}" cannot be ordered because merchant "${product.sellerOrg.name}" is not approved or active to accept orders.`
      );
    }
    if (product.status !== "PUBLISHED" || !product.isApprovedByPlatform || !ci.variant.isActive) {
      throw new Error(
        `ITEM_UNAVAILABLE: "${product.title}" is no longer available. Please remove it from your cart.`
      );
    }
    const level = levelByVariant.get(ci.variantId);
    const sellable = level ? Math.max(0, level.availableUnits - level.reservedUnits) : 0;
    if (sellable < ci.quantity) {
      throw new Error(
        sellable === 0
          ? `INSUFFICIENT_STOCK: "${product.title}" is out of stock. Please remove it from your cart.`
          : `INSUFFICIENT_STOCK: Only ${sellable} unit(s) of "${product.title}" are available. Please reduce the quantity.`
      );
    }
  }

  // 1. Group items by seller organization
  const sellerGroups = new Map<
    string,
    {
      sellerOrgId: string;
      sellerName: string;
      commissionRatePercent: number;
      items: Array<{
        variantId: string;
        productTitle: string;
        variantName: string;
        sku: string;
        quantity: number;
        unitPriceMinor: number;
        lineSubtotalMinor: number;
      }>;
    }
  >();

  let subtotalMinor = 0;
  for (const ci of cart.items) {
    const sellerOrg = ci.variant.product.sellerOrg;
    const lineSubtotal = ci.variant.priceMinor * ci.quantity;
    subtotalMinor += lineSubtotal;

    let group = sellerGroups.get(sellerOrg.id);
    if (!group) {
      group = {
        sellerOrgId: sellerOrg.id,
        sellerName: sellerOrg.name,
        commissionRatePercent: sellerOrg.commissionRatePercent ?? 10,
        items: [],
      };
      sellerGroups.set(sellerOrg.id, group);
    }

    group.items.push({
      variantId: ci.variant.id,
      productTitle: ci.variant.product.title,
      variantName: ci.variant.title,
      sku: ci.variant.sku,
      quantity: ci.quantity,
      unitPriceMinor: ci.variant.priceMinor,
      lineSubtotalMinor: lineSubtotal,
    });
  }

  // 2. Authoritative Coupon Evaluation
  let discountMinor = 0;
  let appliedCoupon: CalculationResult["appliedCoupon"] = undefined;
  let couponError: string | undefined = undefined;

  if (couponCode && couponCode.trim()) {
    const coupon = await prisma.coupon.findUnique({
      where: { code: couponCode.trim().toUpperCase() },
    });

    if (!coupon || !coupon.isActive) {
      couponError = "This coupon code is not valid.";
    } else {
      const now = new Date();
      if (coupon.startsAt && coupon.startsAt > now) {
        couponError = "This coupon is not active yet.";
      } else if (coupon.expiresAt && coupon.expiresAt < now) {
        couponError = "This coupon has expired.";
      } else if (coupon.usageLimit && coupon.timesUsed >= coupon.usageLimit) {
        couponError = "This coupon has reached its usage limit.";
      } else if (subtotalMinor < coupon.minOrderAmountMinor) {
        couponError = `This coupon requires a minimum order of ${(coupon.minOrderAmountMinor / 100).toLocaleString("en-PK")} PKR.`;
      } else {
        if (coupon.discountType === DiscountType.PERCENTAGE) {
          discountMinor = Math.round((subtotalMinor * coupon.discountValueMinor) / 100);
          if (coupon.maxDiscountMinor) {
            discountMinor = Math.min(discountMinor, coupon.maxDiscountMinor);
          }
        } else {
          discountMinor = coupon.discountValueMinor;
        }
        discountMinor = Math.min(discountMinor, subtotalMinor);
        appliedCoupon = { code: coupon.code, discountMinor };
      }
    }
  }

  // 3. Deterministic Discount Allocation Across Seller Packages
  const sellerSubtotalEntries = Array.from(sellerGroups.values()).map((g) => ({
    id: g.sellerOrgId,
    subtotalMinor: g.items.reduce((acc, it) => acc + it.lineSubtotalMinor, 0),
  }));

  const sellerDiscountMap = allocateProRataDiscount(discountMinor, sellerSubtotalEntries);

  // 4. Per-Seller Shipping, Tax, and Line-Item Calculation
  let totalShippingMinor = 0;
  let totalTaxMinor = 0;
  const sellerPackages: SellerPackageCalculation[] = [];
  const allCalculatedItems: CalculatedItem[] = [];

  for (const group of sellerGroups.values()) {
    const groupSubtotal = group.items.reduce((acc, it) => acc + it.lineSubtotalMinor, 0);
    const sellerDiscount = sellerDiscountMap.get(group.sellerOrgId) || 0;

    // Per-seller shipping policy:
    // Express tier: standard per-seller express fee
    // Standard tier: free if seller subtotal >= threshold, otherwise per-seller standard fee
    let sellerShipping = 0;
    if (shippingTier === "EXPRESS") {
      sellerShipping = SITE_CONFIG.shipping.expressRateMinor;
    } else {
      sellerShipping =
        groupSubtotal >= SITE_CONFIG.shipping.freeShippingThresholdMinor
          ? 0
          : SITE_CONFIG.shipping.standardRateMinor;
    }
    totalShippingMinor += sellerShipping;

    // Pro-rata discount allocation to individual items within this seller package
    const itemSubtotalEntries = group.items.map((it) => ({
      id: it.variantId,
      subtotalMinor: it.lineSubtotalMinor,
    }));
    const itemDiscountMap = allocateProRataDiscount(sellerDiscount, itemSubtotalEntries);

    // Per-seller taxable base and tax calculation
    const taxableSellerSubtotal = Math.max(0, groupSubtotal - sellerDiscount);
    const sellerTax = Math.round((taxableSellerSubtotal * SITE_CONFIG.tax.defaultRatePercent) / 100);
    totalTaxMinor += sellerTax;

    // Distribute tax across items within the seller package
    const itemTaxableEntries = group.items.map((it) => {
      const itDisc = itemDiscountMap.get(it.variantId) || 0;
      return { id: it.variantId, subtotalMinor: Math.max(0, it.lineSubtotalMinor - itDisc) };
    });
    const itemTaxMap = allocateProRataDiscount(sellerTax, itemTaxableEntries);

    // Calculate item-level records
    const calculatedPackageItems: CalculatedItem[] = group.items.map((it) => {
      const itDisc = itemDiscountMap.get(it.variantId) || 0;
      const itTax = itemTaxMap.get(it.variantId) || 0;
      const itTotal = it.lineSubtotalMinor - itDisc + itTax;

      const calcItem: CalculatedItem = {
        variantId: it.variantId,
        productTitle: it.productTitle,
        variantName: it.variantName,
        sku: it.sku,
        sellerOrgId: group.sellerOrgId,
        sellerName: group.sellerName,
        quantity: it.quantity,
        unitPriceMinor: it.unitPriceMinor,
        lineSubtotalMinor: it.lineSubtotalMinor,
        discountMinor: itDisc,
        taxMinor: itTax,
        totalMinor: itTotal,
      };

      allCalculatedItems.push(calcItem);
      return calcItem;
    });

    const sellerTotal = groupSubtotal - sellerDiscount + sellerShipping + sellerTax;

    // Snapshot Commission & Net Seller Payable:
    // Commission is calculated on merchandise net value (subtotal - discount)
    const netMerchandise = Math.max(0, groupSubtotal - sellerDiscount);
    const platformCommission = Math.round((netMerchandise * group.commissionRatePercent) / 100);
    // Net seller payable = net merchandise + seller shipping reimbursement - platform commission
    const netSellerPayable = Math.max(0, netMerchandise + sellerShipping - platformCommission);

    sellerPackages.push({
      sellerOrgId: group.sellerOrgId,
      sellerName: group.sellerName,
      subtotalMinor: groupSubtotal,
      discountMinor: sellerDiscount,
      shippingMinor: sellerShipping,
      taxMinor: sellerTax,
      totalMinor: sellerTotal,
      commissionRatePercent: group.commissionRatePercent,
      platformCommissionMinor: platformCommission,
      netSellerPayableMinor: netSellerPayable,
      items: calculatedPackageItems,
    });
  }

  // 5. Customer Grand Total & Exact Reconciliation Verification
  const grandTotalMinor = subtotalMinor - discountMinor + totalShippingMinor + totalTaxMinor;
  const sumSellerTotals = sellerPackages.reduce((acc, p) => acc + p.totalMinor, 0);
  const discrepancy = grandTotalMinor - sumSellerTotals;

  return {
    items: allCalculatedItems,
    sellerPackages,
    subtotalMinor,
    discountMinor,
    shippingMinor: totalShippingMinor,
    taxMinor: totalTaxMinor,
    totalMinor: grandTotalMinor,
    appliedCoupon,
    couponError,
    reconciliation: {
      isExact: discrepancy === 0,
      customerTotalMinor: grandTotalMinor,
      sumSellerTotalsMinor: sumSellerTotals,
      roundingDiscrepancyMinor: discrepancy,
    },
  };
}

export interface PlaceOrderInput {
  cartId: string;
  customerEmail: string;
  customerPhone?: string;
  customerUserId?: string;
  shippingAddress: CheckoutAddress;
  billingAddress?: CheckoutAddress;
  shippingTier?: "STANDARD" | "EXPRESS";
  couponCode?: string;
  idempotencyKey: string;
  paymentMethod?: "CASH_ON_DELIVERY" | "ONLINE_SANDBOX";
}

function isUniqueViolation(err: unknown, field?: string): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") return false;
  if (!field) return true;
  const target = err.meta?.target;
  return Array.isArray(target) ? target.includes(field) : String(target ?? "").includes(field);
}

async function findOrderByIdempotencyKey(idempotencyKey: string, customerUserId?: string) {
  const attempt = await prisma.paymentAttempt.findUnique({
    where: { idempotencyKey },
    include: {
      customerOrder: {
        include: {
          sellerOrders: { include: { items: true } },
        },
      },
    },
  });
  if (!attempt) return null;

  // A retry key is bound to the account that created it.
  if ((attempt.customerOrder.customerUserId ?? null) !== (customerUserId ?? null)) {
    throw new Error("IDEMPOTENCY_KEY_CONFLICT: This request key belongs to a different customer.");
  }
  return attempt.customerOrder;
}

function generateOrderNumber(): string {
  const timestamp = Date.now().toString().slice(-6);
  const randomSuffix = crypto.randomInt(1000, 10000);
  return `WZ-${timestamp}-${randomSuffix}`;
}

export async function placeOrder(input: PlaceOrderInput) {
  const {
    cartId,
    customerEmail,
    customerPhone,
    customerUserId,
    shippingAddress,
    billingAddress,
    shippingTier = "STANDARD",
    couponCode,
    idempotencyKey,
    paymentMethod = "ONLINE_SANDBOX",
  } = input;

  // 1. Idempotency: a repeated submission with the same key returns the original order.
  const existingOrder = await findOrderByIdempotencyKey(idempotencyKey, customerUserId);
  if (existingOrder) return existingOrder;

  try {
    // 2. Authoritatively calculate totals on the server (never from the browser).
    const totals = await calculateCheckoutTotals(cartId, couponCode, shippingTier);
    const method = assertPaymentMethodAllowed(paymentMethod, totals.totalMinor);
    const isCod = method === "CASH_ON_DELIVERY";

    if (couponCode && couponCode.trim() && !totals.appliedCoupon) {
      throw new Error(`COUPON_INVALID: ${totals.couponError || "The coupon could not be applied."}`);
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      const orderNumber = generateOrderNumber();
      try {
        const order = await createOrderTransaction({
          totals,
          orderNumber,
          isCod,
          cartId,
          customerEmail,
          customerPhone,
          customerUserId,
          shippingAddress,
          billingAddress,
          idempotencyKey,
        });

        // Best-effort notification; failures are retried by the job worker and never block the order.
        enqueueJob("SEND_TRANSACTIONAL_EMAIL", {
          template: "ORDER_CONFIRMATION",
          orderId: order.id,
          to: customerEmail,
        }).catch((e) => console.error("[checkout] failed to enqueue order confirmation email", e));

        return order;
      } catch (err) {
        lastError = err;
        if (isUniqueViolation(err, "orderNumber")) continue; // extremely rare collision: retry with a new number
        throw err;
      }
    }
    throw lastError;
  } catch (err) {
    // A concurrent duplicate submission with the same key may have created the order in the meantime.
    const replay = await findOrderByIdempotencyKey(idempotencyKey, customerUserId);
    if (replay) return replay;
    throw err;
  }
}

async function createOrderTransaction(args: {
  totals: CalculationResult;
  orderNumber: string;
  isCod: boolean;
  cartId: string;
  customerEmail: string;
  customerPhone?: string;
  customerUserId?: string;
  shippingAddress: CheckoutAddress;
  billingAddress?: CheckoutAddress;
  idempotencyKey: string;
}) {
  const {
    totals,
    orderNumber,
    isCod,
    cartId,
    customerEmail,
    customerPhone,
    customerUserId,
    shippingAddress,
    billingAddress,
    idempotencyKey,
  } = args;

  return prisma.$transaction(
    async (tx) => {
      // Claim the cart: only one concurrent checkout can win the ACTIVE -> CONVERTED transition.
      const claimed = await tx.cart.updateMany({
        where: { id: cartId, status: "ACTIVE" },
        data: { status: "CONVERTED" },
      });
      if (claimed.count !== 1) {
        throw new Error("CART_NOT_ACTIVE: This cart has already been checked out.");
      }

      // Atomically consume one coupon use; refuses when the usage limit was reached concurrently.
      if (totals.appliedCoupon) {
        const consumed = await tx.$executeRaw`
          UPDATE "Coupon"
          SET "timesUsed" = "timesUsed" + 1, "updatedAt" = NOW()
          WHERE "code" = ${totals.appliedCoupon.code}
            AND "isActive" = true
            AND ("usageLimit" IS NULL OR "timesUsed" < "usageLimit")
        `;
        if (consumed !== 1) {
          throw new Error("COUPON_INVALID: This coupon has reached its usage limit.");
        }
      }

      const orderNotes = JSON.stringify({
        paymentMethod: isCod ? "CASH_ON_DELIVERY" : "ONLINE_SANDBOX",
        ...(isCod ? { codStatus: "PENDING_COLLECTION" } : {}),
        placedAt: new Date().toISOString(),
      });

      const customerOrder = await tx.customerOrder.create({
        data: {
          orderNumber,
          customerUserId: customerUserId || null,
          customerEmail,
          customerPhone: customerPhone || null,
          shippingAddressJson: JSON.stringify(shippingAddress),
          billingAddressJson: JSON.stringify(billingAddress || shippingAddress),
          status: isCod ? CustomerOrderStatus.PROCESSING : CustomerOrderStatus.PENDING_PAYMENT,
          currency: SITE_CONFIG.defaultCurrency,
          subtotalMinor: totals.subtotalMinor,
          discountMinor: totals.discountMinor,
          shippingMinor: totals.shippingMinor,
          taxMinor: totals.taxMinor,
          totalMinor: totals.totalMinor,
          paymentStatus: PaymentStatus.UNPAID,
          couponCode: totals.appliedCoupon?.code || null,
          notes: orderNotes,
        },
      });

      // Reserve stock inside the same transaction, linked to this order. Lock order is deterministic
      // (sorted by variant) so concurrent checkouts cannot deadlock each other.
      const reservationLines = new Map<string, number>();
      for (const item of totals.items) {
        reservationLines.set(item.variantId, (reservationLines.get(item.variantId) || 0) + item.quantity);
      }
      for (const [variantId, quantity] of [...reservationLines.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        await createStockReservation(
          variantId,
          quantity,
          cartId,
          customerOrder.id,
          SITE_CONFIG.reservationExpiryMinutes,
          tx
        );
      }

      // COD is a binding purchase at placement: commit stock immediately. Online orders commit on verified payment.
      if (isCod) {
        await commitOrderReservations(customerOrder.id, tx);
      }

      // Save the address to the customer's address book if it is new.
      if (customerUserId) {
        const existingAddrCount = await tx.address.count({ where: { userId: customerUserId } });
        const duplicateAddr = await tx.address.findFirst({
          where: { userId: customerUserId, street1: shippingAddress.street1, city: shippingAddress.city },
        });

        if (!duplicateAddr) {
          await tx.address.create({
            data: {
              userId: customerUserId,
              title: "Shipping Address",
              fullName: shippingAddress.fullName,
              phone: shippingAddress.phone || customerPhone || "N/A",
              street1: shippingAddress.street1,
              street2: shippingAddress.street2 || null,
              city: shippingAddress.city,
              stateProvince: shippingAddress.stateProvince,
              postalCode: shippingAddress.postalCode,
              countryCode: shippingAddress.countryCode || "PK",
              isDefaultShipping: existingAddrCount === 0,
            },
          });
        }
      }

      // Independent SellerOrders and immutable OrderItem snapshots for each merchant package.
      let sellerCounter = 1;
      for (const pkg of totals.sellerPackages) {
        const sellerOrderNumber = `${orderNumber}-S${sellerCounter++}`;

        const sellerOrder = await tx.sellerOrder.create({
          data: {
            customerOrderId: customerOrder.id,
            sellerOrgId: pkg.sellerOrgId,
            sellerOrderNumber,
            status: isCod ? SellerOrderStatus.CONFIRMED : SellerOrderStatus.PENDING_PAYMENT,
            subtotalMinor: pkg.subtotalMinor,
            discountMinor: pkg.discountMinor,
            shippingMinor: pkg.shippingMinor,
            taxMinor: pkg.taxMinor,
            totalMinor: pkg.totalMinor,
            platformCommissionMinor: pkg.platformCommissionMinor,
            netSellerPayableMinor: pkg.netSellerPayableMinor,
          },
        });

        for (const item of pkg.items) {
          await tx.orderItem.create({
            data: {
              sellerOrderId: sellerOrder.id,
              variantId: item.variantId,
              productTitleSnapshot: item.productTitle,
              variantNameSnapshot: item.variantName,
              skuSnapshot: item.sku,
              sellerNameSnapshot: item.sellerName,
              sellerOrgId: item.sellerOrgId,
              quantity: item.quantity,
              unitPriceMinor: item.unitPriceMinor,
              subtotalMinor: item.lineSubtotalMinor,
              discountMinor: item.discountMinor,
              taxMinor: item.taxMinor,
              totalMinor: item.totalMinor,
              commissionRatePercent: pkg.commissionRatePercent,
            },
          });
        }

        // COD: fulfilment, collection and remittance are tracked as separate states.
        if (isCod) {
          await tx.codRemittanceRecord.create({
            data: {
              customerOrderId: customerOrder.id,
              sellerOrderId: sellerOrder.id,
              courierName: "UNASSIGNED",
              trackingNumber: `COD-REF-${sellerOrderNumber}`,
              collectionStatus: CodCollectionStatus.PENDING_COLLECTION,
              remittanceStatus: CodRemittanceStatus.PENDING_REMITTANCE,
              amountExpectedMinor: pkg.totalMinor,
              notes: `Internal COD collection reference for suborder ${sellerOrderNumber}. Not a courier tracking number.`,
            },
          });
        }
      }

      // COD creates a PENDING attempt: cash has not been collected, so nothing "succeeded".
      await tx.paymentAttempt.create({
        data: {
          customerOrderId: customerOrder.id,
          provider: isCod ? PaymentAttemptProvider.COD : PaymentAttemptProvider.LOCAL_SANDBOX,
          idempotencyKey,
          amountMinor: totals.totalMinor,
          currency: SITE_CONFIG.defaultCurrency,
          status: "PENDING",
          transactionRef: isCod ? `COD_${orderNumber}` : undefined,
        },
      });

      return customerOrder;
    },
    { timeout: 20000, maxWait: 10000 }
  );
}
