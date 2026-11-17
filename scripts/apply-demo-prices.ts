/**
 * Applies demo pricing (scripts/demo-pricing.ts) to the demo catalog in the database.
 * Only variants whose SKU is in the demo list are touched; real seller listings never are.
 * Prices are computed from the demo list, so running it again changes nothing.
 * Existing orders keep their own price snapshots.
 *
 *   npx tsx scripts/apply-demo-prices.ts            # dry run: show what would change
 *   npx tsx scripts/apply-demo-prices.ts --apply    # write
 *   npx tsx scripts/apply-demo-prices.ts --apply --multiplier 1   # restore normal demo prices
 */
import { prisma } from "../src/lib/db";
import { buildCatalog } from "./seed-complete-diverse-catalog";
import { DEMO_PRICE_MULTIPLIER, demoVariantPrice } from "./demo-pricing";

async function main() {
  const apply = process.argv.includes("--apply");
  const mIdx = process.argv.indexOf("--multiplier");
  const multiplier = mIdx > -1 ? Number(process.argv[mIdx + 1]) : DEMO_PRICE_MULTIPLIER;
  if (!Number.isFinite(multiplier) || multiplier < 1 || multiplier > 10) {
    throw new Error("--multiplier must be between 1 and 10");
  }

  const targets = new Map<string, { priceMinor: number; compareAtPriceMinor: number | null }>();
  for (const product of buildCatalog()) {
    for (const v of product.variants) {
      targets.set(v.sku, demoVariantPrice(v.priceMinor, v.compareAtPriceMinor, multiplier));
    }
  }

  const variants = await prisma.productVariant.findMany({
    where: { sku: { in: [...targets.keys()] } },
    select: { id: true, sku: true, priceMinor: true, compareAtPriceMinor: true, dealPriceMinor: true },
  });
  const changes = variants
    .map((v) => ({ v, t: targets.get(v.sku)! }))
    .filter(
      ({ v, t }) => v.priceMinor !== t.priceMinor || v.compareAtPriceMinor !== t.compareAtPriceMinor || v.dealPriceMinor !== null
    );

  console.log(`Demo variants in this database: ${variants.length} of ${targets.size} in the demo list`);
  console.log(`Multiplier: ${multiplier}×. Variants to update: ${changes.length}`);
  for (const { v, t } of changes.slice(0, 8)) {
    console.log(`  ${v.sku}: Rs ${v.priceMinor / 100} → Rs ${t.priceMinor / 100}`);
  }
  if (changes.length > 8) console.log(`  … and ${changes.length - 8} more`);

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to write.");
    return;
  }
  if (changes.length === 0) {
    console.log("Nothing to change.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const { v, t } of changes) {
      await tx.productVariant.update({
        where: { id: v.id },
        data: {
          priceMinor: t.priceMinor,
          compareAtPriceMinor: t.compareAtPriceMinor,
          // Demo listings carry no scheduled deals (a deal price would undercut the floor)
          dealPriceMinor: null,
          dealStartsAt: null,
          dealEndsAt: null,
          dealRegularPriceMinor: null,
          dealRegularCompareAtMinor: null,
        },
      });
    }
    await tx.auditEvent.create({
      data: {
        actorUserId: null,
        entityType: "Catalog",
        entityId: "demo-catalog",
        action: "DEMO_PRICES_APPLIED",
        detailsJson: JSON.stringify({ multiplier, variantsUpdated: changes.length }),
      },
    });
  }, { timeout: 60000 });
  console.log(`Updated ${changes.length} demo variants.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
