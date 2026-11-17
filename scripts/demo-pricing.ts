/**
 * Demo catalog pricing. While the store runs on demo listings, their prices are kept at least
 * DEMO_PRICE_MULTIPLIER × the market price, so nobody buys a placeholder product at a real price.
 *
 * Rule (per variant): market reference = the higher of the listed price and its compare-at
 * ("was") price; new price = multiplier × reference, rounded UP to a price ending in 99.
 * A compare-at price keeps the same discount ratio as in the demo list.
 * Always computed from the demo list (never from the current DB price), so applying it twice
 * gives the same result. A multiplier of 1 restores the original demo prices.
 */
export const DEMO_PRICE_MULTIPLIER = 2;

/** Round a paisa amount UP to the next whole-hundred rupees minus 1 (e.g. 59,998 → 59,999). */
function roundUpTo99(minor: number): number {
  return Math.ceil(minor / 10000) * 10000 - 100;
}

export function demoVariantPrice(
  priceMinor: number,
  compareAtPriceMinor: number | null,
  multiplier: number = DEMO_PRICE_MULTIPLIER
): { priceMinor: number; compareAtPriceMinor: number | null } {
  if (multiplier === 1) return { priceMinor, compareAtPriceMinor };
  const reference = Math.max(priceMinor, compareAtPriceMinor ?? 0);
  const newPrice = roundUpTo99(reference * multiplier);
  const newCompare =
    compareAtPriceMinor && compareAtPriceMinor > priceMinor
      ? roundUpTo99(Math.round((newPrice * compareAtPriceMinor) / priceMinor))
      : null;
  return { priceMinor: newPrice, compareAtPriceMinor: newCompare && newCompare > newPrice ? newCompare : null };
}
