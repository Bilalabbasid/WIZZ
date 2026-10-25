import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * Scheduled special prices ("deals").
 *
 * `priceMinor` is always the price a shopper pays right now, so cart, checkout,
 * search sorting and filters never need to know about deals. While a deal is live:
 *   priceMinor          = dealPriceMinor
 *   compareAtPriceMinor = the seller's regular price (shown struck through)
 *   dealRegularPriceMinor / dealRegularCompareAtMinor = the seller's own values, restored at the end.
 *
 * Every write of variant pricing goes through `resolveVariantPricing`, and
 * `syncDealPricing` applies start/end transitions (scheduler tick + before checkout).
 */

export interface VariantPricingColumns {
  priceMinor: number;
  compareAtPriceMinor: number | null;
  dealPriceMinor: number | null;
  dealStartsAt: Date | null;
  dealEndsAt: Date | null;
  dealRegularPriceMinor: number | null;
  dealRegularCompareAtMinor: number | null;
}

export interface SellerPricingIntent {
  /** The seller's regular selling price. */
  regularPriceMinor: number;
  /** The seller's own "was" price; must exceed the regular price. */
  regularCompareAtMinor: number | null;
  dealPriceMinor: number | null;
  dealStartsAt: Date | null;
  dealEndsAt: Date | null;
}

/** The seller's regular price, whether or not a deal is currently live. */
export function getRegularPrice(v: Pick<VariantPricingColumns, "priceMinor" | "dealRegularPriceMinor">): number {
  return v.dealRegularPriceMinor ?? v.priceMinor;
}

/** The seller's own compare-at price, whether or not a deal is currently live. */
export function getRegularCompareAt(
  v: Pick<VariantPricingColumns, "compareAtPriceMinor" | "dealRegularPriceMinor" | "dealRegularCompareAtMinor">
): number | null {
  return v.dealRegularPriceMinor != null ? v.dealRegularCompareAtMinor : v.compareAtPriceMinor;
}

export function isDealLive(
  deal: Pick<SellerPricingIntent, "dealPriceMinor" | "dealStartsAt" | "dealEndsAt">,
  now: Date = new Date()
): boolean {
  return (
    deal.dealPriceMinor != null &&
    deal.dealStartsAt != null &&
    deal.dealEndsAt != null &&
    deal.dealStartsAt.getTime() <= now.getTime() &&
    now.getTime() < deal.dealEndsAt.getTime()
  );
}

/** Reads the seller's intent back out of stored columns. */
export function getPricingIntent(v: VariantPricingColumns): SellerPricingIntent {
  return {
    regularPriceMinor: getRegularPrice(v),
    regularCompareAtMinor: getRegularCompareAt(v),
    dealPriceMinor: v.dealPriceMinor,
    dealStartsAt: v.dealStartsAt,
    dealEndsAt: v.dealEndsAt,
  };
}

/**
 * Validates a seller's pricing intent. `isNewDeal` applies the "must end in the
 * future" rule only when the deal window is being created or changed, so an
 * unrelated edit is never blocked by a deal that has just ended.
 */
export function validatePricingIntent(
  intent: SellerPricingIntent,
  label: string,
  options: { now?: Date; isNewDeal?: boolean } = {}
) {
  const now = options.now ?? new Date();
  const { regularPriceMinor, regularCompareAtMinor, dealPriceMinor, dealStartsAt, dealEndsAt } = intent;

  if (!Number.isInteger(regularPriceMinor) || regularPriceMinor <= 0) {
    throw new Error(`${label}: price must be greater than zero.`);
  }
  if (regularCompareAtMinor != null) {
    if (!Number.isInteger(regularCompareAtMinor) || regularCompareAtMinor <= regularPriceMinor) {
      throw new Error(`${label}: "Was" price must be higher than the selling price.`);
    }
  }

  const anyDealField = dealPriceMinor != null || dealStartsAt != null || dealEndsAt != null;
  if (!anyDealField) return;

  if (dealPriceMinor == null || dealStartsAt == null || dealEndsAt == null) {
    throw new Error(`${label}: a deal needs a deal price, a start time and an end time.`);
  }
  if (!Number.isInteger(dealPriceMinor) || dealPriceMinor <= 0) {
    throw new Error(`${label}: deal price must be greater than zero.`);
  }
  if (dealPriceMinor >= regularPriceMinor) {
    throw new Error(`${label}: deal price must be lower than the regular price.`);
  }
  if (dealEndsAt.getTime() <= dealStartsAt.getTime()) {
    throw new Error(`${label}: deal end time must be after its start time.`);
  }
  if (options.isNewDeal && dealEndsAt.getTime() <= now.getTime()) {
    throw new Error(`${label}: deal end time must be in the future.`);
  }
}

/** Computes the stored columns for a seller's pricing intent at `now`. */
export function resolveVariantPricing(intent: SellerPricingIntent, now: Date = new Date()): VariantPricingColumns {
  const ended = intent.dealEndsAt != null && intent.dealEndsAt.getTime() <= now.getTime();
  const deal = ended
    ? { dealPriceMinor: null, dealStartsAt: null, dealEndsAt: null }
    : { dealPriceMinor: intent.dealPriceMinor, dealStartsAt: intent.dealStartsAt, dealEndsAt: intent.dealEndsAt };

  if (isDealLive(deal, now)) {
    return {
      priceMinor: deal.dealPriceMinor!,
      compareAtPriceMinor: intent.regularPriceMinor,
      ...deal,
      dealRegularPriceMinor: intent.regularPriceMinor,
      dealRegularCompareAtMinor: intent.regularCompareAtMinor,
    };
  }

  return {
    priceMinor: intent.regularPriceMinor,
    compareAtPriceMinor: intent.regularCompareAtMinor,
    ...deal,
    dealRegularPriceMinor: null,
    dealRegularCompareAtMinor: null,
  };
}

function pricingChanged(a: VariantPricingColumns, b: VariantPricingColumns) {
  return (
    a.priceMinor !== b.priceMinor ||
    a.compareAtPriceMinor !== b.compareAtPriceMinor ||
    a.dealPriceMinor !== b.dealPriceMinor ||
    a.dealStartsAt?.getTime() !== b.dealStartsAt?.getTime() ||
    a.dealEndsAt?.getTime() !== b.dealEndsAt?.getTime() ||
    a.dealRegularPriceMinor !== b.dealRegularPriceMinor ||
    a.dealRegularCompareAtMinor !== b.dealRegularCompareAtMinor
  );
}

const pricingSelect = {
  id: true,
  updatedAt: true,
  priceMinor: true,
  compareAtPriceMinor: true,
  dealPriceMinor: true,
  dealStartsAt: true,
  dealEndsAt: true,
  dealRegularPriceMinor: true,
  dealRegularCompareAtMinor: true,
} satisfies Prisma.ProductVariantSelect;

/**
 * Applies deal start/end transitions. Pass `variantIds` to limit the sync (e.g. a
 * cart before checkout); omit it to sweep every variant with a due transition.
 * Each row is updated conditionally on its `updatedAt`, so a concurrent seller
 * edit is never overwritten with stale values.
 */
export async function syncDealPricing(options: { variantIds?: string[]; now?: Date } = {}) {
  const now = options.now ?? new Date();
  if (options.variantIds && options.variantIds.length === 0) return { updated: 0 };

  const due = await prisma.productVariant.findMany({
    where: {
      ...(options.variantIds ? { id: { in: options.variantIds } } : {}),
      OR: [
        // Live deal that has ended or was cleared
        { dealRegularPriceMinor: { not: null }, OR: [{ dealEndsAt: { lte: now } }, { dealPriceMinor: null }] },
        // Scheduled deal whose window has opened
        {
          dealRegularPriceMinor: null,
          dealPriceMinor: { not: null },
          dealStartsAt: { lte: now },
          dealEndsAt: { gt: now },
        },
        // Scheduled deal that expired before it was ever applied
        { dealRegularPriceMinor: null, dealEndsAt: { lte: now } },
      ],
    },
    select: pricingSelect,
    take: 500,
  });

  let updated = 0;
  for (const v of due) {
    const next = resolveVariantPricing(getPricingIntent(v), now);
    if (!pricingChanged(v, next)) continue;
    const res = await prisma.productVariant.updateMany({
      where: { id: v.id, updatedAt: v.updatedAt },
      data: next,
    });
    updated += res.count;
  }
  return { updated };
}
