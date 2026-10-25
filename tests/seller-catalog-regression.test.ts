import { prisma } from "../src/lib/db";
import { SellerMembershipRole, SellerOperationalStatus, ProductStatus } from "@prisma/client";
import {
  createSellerProduct,
  updateSellerProduct,
  getSellerProductById,
  bulkUpdateSellerVariants,
  approveProductModeration,
  importSellerProductsCsv,
  adjustSellerInventory,
} from "../src/modules/sellers/catalog-services";
import { syncDealPricing, resolveVariantPricing, getPricingIntent } from "../src/modules/sellers/deal-pricing";
import { CATALOG_WRITE_ROLES } from "../src/modules/sellers/api-guard";
import { registerSellerAccount } from "../src/modules/sellers/services";
import { getOrCreateCart, addItemToCart } from "../src/modules/cart/services";
import { calculateCheckoutTotals } from "../src/modules/checkout/services";
import { serializeJsonLd } from "../src/lib/formatters";
import { parseDescription } from "../src/components/product-description";

const IMG = [{ url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1000&q=80", isThumbnail: true }];
const HOUR = 60 * 60 * 1000;

async function run() {
  console.log("=========================================================");
  console.log("🛍️  WIZZ.PK SELLER CATALOG: PUBLISHING, PRICING, DEALS & STOCK");
  console.log("=========================================================\n");

  let passed = 0;
  let failed = 0;
  const assert = (condition: boolean, message: string) => {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  };
  async function expectError(fn: () => Promise<unknown>, includes: string, message: string) {
    try {
      await fn();
      assert(false, `${message} (no error thrown)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      assert(msg.includes(includes), `${message}${msg.includes(includes) ? "" : ` (got: ${msg})`}`);
    }
  }

  const nonce = Date.now().toString().slice(-7);
  const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } });
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "PLATFORM_SUPER_ADMIN" } });

  const sellerA = await registerSellerAccount({
    email: `catalog_a_${nonce}@example.pk`,
    password: "Password123!",
    firstName: "Ayesha",
    lastName: "Catalog",
    tradingName: `Catalog Seller A ${nonce}`,
  });
  const sellerB = await registerSellerAccount({
    email: `catalog_b_${nonce}@example.pk`,
    password: "Password123!",
    firstName: "Bilal",
    lastName: "Catalog",
    tradingName: `Catalog Seller B ${nonce}`,
  });
  for (const s of [sellerA, sellerB]) {
    await prisma.sellerOrg.update({ where: { id: s.sellerOrg.id }, data: { operationalStatus: SellerOperationalStatus.ACTIVE } });
  }
  const orgA = sellerA.sellerOrg.id;
  const orgB = sellerB.sellerOrg.id;
  const userA = sellerA.user.id;
  const createdProductIds: string[] = [];

  // ---------------------------------------------------------------
  console.log("🧪 [1] External sellers cannot self-publish");
  const submitted = await createSellerProduct(orgA, {
    title: `Moderated Lamp ${nonce}`,
    description: "A lamp.",
    categoryId: category.id,
    submitForReview: true,
    images: IMG,
    variants: [{ title: "Default", sku: `CAT-LAMP-${nonce}`, priceMinor: 500000, initialStock: 20 }],
  }, userA);
  createdProductIds.push(submitted.id);
  assert(submitted.status === ProductStatus.DRAFT && !submitted.isApprovedByPlatform, "Submitted listing is not live");
  assert(submitted.moderationStatus === "PENDING_REVIEW", "Submitted listing is in review");

  const forced = await updateSellerProduct(orgA, submitted.id, { status: ProductStatus.PUBLISHED }, userA);
  assert(forced.status !== ProductStatus.PUBLISHED && !forced.isApprovedByPlatform, "Setting status PUBLISHED directly does not bypass review");

  await expectError(
    () => createSellerProduct(orgA, {
      title: `No Photo ${nonce}`, description: "x", categoryId: category.id, submitForReview: true,
      variants: [{ title: "D", sku: `CAT-NOPHOTO-${nonce}`, priceMinor: 1000 }],
    }, userA),
    "at least one product image",
    "Submitting without a photo is rejected"
  );

  await approveProductModeration(submitted.id, admin.id);
  const live = await getSellerProductById(orgA, submitted.id);
  assert(live.status === ProductStatus.PUBLISHED && live.isApprovedByPlatform, "Admin approval makes the listing live");
  const liveVariant = live.variants[0];

  // ---------------------------------------------------------------
  console.log("\n🧪 [2] Price and stock apply live; content goes to review");
  const afterEdit = await updateSellerProduct(orgA, submitted.id, {
    title: `Renamed Lamp ${nonce}`,
    variants: [{
      id: liveVariant.id, title: liveVariant.title, sku: liveVariant.sku,
      priceMinor: 450000, compareAtPriceMinor: 520000,
      availableUnits: 25, stockBaseline: 20,
    }],
  }, userA);
  const reloaded = await getSellerProductById(orgA, submitted.id);
  assert(reloaded.variants[0].priceMinor === 450000, "Price change is live immediately");
  assert(reloaded.variants[0].compareAtPriceMinor === 520000, "\"Was\" price change is live immediately");
  assert(reloaded.title === live.title, "Approved title stays live while the rename is in review");
  assert(Boolean(afterEdit.pendingChangesJson) && afterEdit.moderationStatus === "PENDING_REVIEW", "Rename is staged for review");
  assert(reloaded.status === ProductStatus.PUBLISHED, "Listing stays live while edits are in review");

  const priceOnly = await updateSellerProduct(orgA, submitted.id, {
    variants: [{ id: liveVariant.id, title: liveVariant.title, sku: liveVariant.sku, priceMinor: 440000, compareAtPriceMinor: 520000 }],
  }, userA);
  assert(JSON.parse(priceOnly.pendingChangesJson || "{}").title === `Renamed Lamp ${nonce}`, "A price-only save keeps earlier staged content");

  await approveProductModeration(submitted.id, admin.id);
  const afterApproval = await getSellerProductById(orgA, submitted.id);
  assert(afterApproval.title === `Renamed Lamp ${nonce}`, "Approving the revision applies the rename");
  assert(afterApproval.variants[0].priceMinor === 440000, "Approving content does not roll back live price edits");

  // ---------------------------------------------------------------
  console.log("\n🧪 [3] Stock edits are deltas, ledgered, and respect reservations");
  const lvl = (await prisma.inventoryLevel.findUniqueOrThrow({ where: { variantId: liveVariant.id } }));
  assert(lvl.availableUnits === 25, "Stock edit 20 -> 25 applied");
  // An order ships 2 units while the seller has the editor open (seller saw 25)
  await prisma.inventoryLevel.update({ where: { variantId: liveVariant.id }, data: { availableUnits: { decrement: 2 } } });
  await bulkUpdateSellerVariants(orgA, [{ variantId: liveVariant.id, stock: 30, stockBaseline: 25 }], userA);
  const afterDelta = await prisma.inventoryLevel.findUniqueOrThrow({ where: { variantId: liveVariant.id } });
  assert(afterDelta.availableUnits === 28, "Seller's +5 is applied on top of the concurrent sale (23 + 5 = 28), not overwritten to 30");
  const ledger = await prisma.inventoryAdjustment.findFirst({ where: { variantId: liveVariant.id }, orderBy: { createdAt: "desc" } });
  assert(ledger?.deltaUnits === 5 && ledger.balanceAfter === 28, "Stock edit recorded in the inventory ledger");

  await prisma.inventoryLevel.update({ where: { variantId: liveVariant.id }, data: { reservedUnits: 6 } });
  await expectError(
    () => bulkUpdateSellerVariants(orgA, [{ variantId: liveVariant.id, stock: 4 }], userA),
    "held for open checkouts",
    "Stock cannot drop below units reserved in checkouts"
  );
  await expectError(
    () => adjustSellerInventory(orgA, liveVariant.id, -25, "DAMAGE", "test", userA),
    "held for open checkouts",
    "Manual adjustment also respects reservations"
  );
  await prisma.inventoryLevel.update({ where: { variantId: liveVariant.id }, data: { reservedUnits: 0 } });

  // ---------------------------------------------------------------
  console.log("\n🧪 [4] Variant ownership and removal");
  const productB = await createSellerProduct(orgB, {
    title: `Seller B Kettle ${nonce}`, description: "Kettle", categoryId: category.id, images: IMG,
    variants: [{ title: "Steel", sku: `CAT-KETTLE-${nonce}`, priceMinor: 300000, initialStock: 5 }],
  }, sellerB.user.id);
  createdProductIds.push(productB.id);
  const variantB = (await getSellerProductById(orgB, productB.id)).variants[0];
  await expectError(
    () => updateSellerProduct(orgA, submitted.id, {
      variants: [
        { id: liveVariant.id, title: liveVariant.title, sku: liveVariant.sku, priceMinor: 440000, compareAtPriceMinor: 520000 },
        { id: variantB.id, title: "hijack", sku: variantB.sku, priceMinor: 100 },
      ],
    }, userA),
    "FORBIDDEN",
    "Seller A cannot edit Seller B's variant through their own product"
  );
  const variantBAfter = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantB.id } });
  assert(variantBAfter.priceMinor === 300000, "Seller B's price is untouched");

  const multi = await createSellerProduct(orgA, {
    title: `Two Colour Mug ${nonce}`, description: "Mug", categoryId: category.id, images: IMG,
    variants: [
      { title: "Red", sku: `CAT-MUG-R-${nonce}`, priceMinor: 120000, attributes: { Colour: "Red" } },
      { title: "Blue", sku: `CAT-MUG-B-${nonce}`, priceMinor: 120000, attributes: { Colour: "Blue" } },
    ],
  }, userA);
  createdProductIds.push(multi.id);
  const mugVariants = (await getSellerProductById(orgA, multi.id)).variants;
  const red = mugVariants.find((v) => v.title === "Red")!;
  await updateSellerProduct(orgA, multi.id, {
    variants: [{ id: red.id, title: red.title, sku: red.sku, priceMinor: 120000, attributes: { Colour: "Red" } }],
  }, userA);
  const blueAfter = await prisma.productVariant.findFirstOrThrow({ where: { productId: multi.id, title: "Blue" } });
  assert(blueAfter.isActive === false, "A variant removed in the editor stops selling");
  await updateSellerProduct(orgA, multi.id, {
    variants: [
      { id: red.id, title: red.title, sku: red.sku, priceMinor: 120000, attributes: { Colour: "Red" } },
      { title: "Blue", sku: `CAT-MUG-B-${nonce}`, priceMinor: 125000, attributes: { Colour: "Blue" } },
    ],
  }, userA);
  const blueBack = await prisma.productVariant.findFirstOrThrow({ where: { productId: multi.id, title: "Blue" } });
  assert(blueBack.isActive && blueBack.id === blueAfter.id, "Re-adding a removed SKU brings back the same variant");

  // ---------------------------------------------------------------
  console.log("\n🧪 [5] Scheduled deals");
  const now = Date.now();
  await expectError(
    () => updateSellerProduct(orgA, submitted.id, {
      variants: [{ id: liveVariant.id, title: liveVariant.title, sku: liveVariant.sku, priceMinor: 440000, dealPriceMinor: 450000,
        dealStartsAt: new Date(now).toISOString(), dealEndsAt: new Date(now + HOUR).toISOString() }],
    }, userA),
    "deal price must be lower",
    "Deal price must be below the regular price"
  );
  await expectError(
    () => updateSellerProduct(orgA, submitted.id, {
      variants: [{ id: liveVariant.id, title: liveVariant.title, sku: liveVariant.sku, priceMinor: 440000, dealPriceMinor: 400000,
        dealStartsAt: new Date(now).toISOString() }],
    }, userA),
    "needs a deal price, a start time and an end time",
    "A deal needs both start and end"
  );

  // Live deal now -> +1h
  await updateSellerProduct(orgA, submitted.id, {
    variants: [{ id: liveVariant.id, title: liveVariant.title, sku: liveVariant.sku, priceMinor: 440000, compareAtPriceMinor: 520000,
      dealPriceMinor: 399900, dealStartsAt: new Date(now - 60_000).toISOString(), dealEndsAt: new Date(now + HOUR).toISOString() }],
  }, userA);
  let dv = await prisma.productVariant.findUniqueOrThrow({ where: { id: liveVariant.id } });
  assert(dv.priceMinor === 399900, "Live deal: shoppers pay the deal price");
  assert(dv.compareAtPriceMinor === 440000, "Live deal: regular price shown struck through");
  assert(dv.dealRegularPriceMinor === 440000 && dv.dealRegularCompareAtMinor === 520000, "Live deal keeps the seller's regular and \"was\" prices");

  // Price edit during deal changes the regular price only
  await bulkUpdateSellerVariants(orgA, [{ variantId: liveVariant.id, priceMinor: 460000 }], userA);
  dv = await prisma.productVariant.findUniqueOrThrow({ where: { id: liveVariant.id } });
  assert(dv.priceMinor === 399900 && dv.dealRegularPriceMinor === 460000 && dv.compareAtPriceMinor === 460000, "Editing price during a deal changes the regular price, deal keeps running");

  // Checkout charges the deal price
  const cart = await getOrCreateCart(`catalog_cart_${nonce}`);
  await addItemToCart(cart.id, liveVariant.id, 2);
  const totals = await calculateCheckoutTotals(cart.id);
  assert(totals.subtotalMinor === 2 * 399900, "Checkout charges the live deal price");

  // Deal ends -> regular prices restored
  await syncDealPricing({ variantIds: [liveVariant.id], now: new Date(now + 2 * HOUR) });
  dv = await prisma.productVariant.findUniqueOrThrow({ where: { id: liveVariant.id } });
  assert(dv.priceMinor === 460000 && dv.compareAtPriceMinor === 520000, "When the deal ends, regular and \"was\" prices come back");
  assert(dv.dealPriceMinor === null && dv.dealRegularPriceMinor === null, "Ended deal is cleared");

  // Scheduled (future) deal starts on its own
  await updateSellerProduct(orgA, submitted.id, {
    variants: [{ id: liveVariant.id, title: liveVariant.title, sku: liveVariant.sku, priceMinor: 460000, compareAtPriceMinor: 520000,
      dealPriceMinor: 410000, dealStartsAt: new Date(now + HOUR).toISOString(), dealEndsAt: new Date(now + 3 * HOUR).toISOString() }],
  }, userA);
  dv = await prisma.productVariant.findUniqueOrThrow({ where: { id: liveVariant.id } });
  assert(dv.priceMinor === 460000 && dv.dealPriceMinor === 410000, "Scheduled deal does not change the price early");
  await syncDealPricing({ variantIds: [liveVariant.id], now: new Date(now + 90 * 60_000) });
  dv = await prisma.productVariant.findUniqueOrThrow({ where: { id: liveVariant.id } });
  assert(dv.priceMinor === 410000 && dv.compareAtPriceMinor === 460000, "Scheduled deal goes live when its window opens");

  // Removing a live deal restores immediately
  await updateSellerProduct(orgA, submitted.id, {
    variants: [{ id: liveVariant.id, title: liveVariant.title, sku: liveVariant.sku, priceMinor: 460000, compareAtPriceMinor: 520000 }],
  }, userA);
  dv = await prisma.productVariant.findUniqueOrThrow({ where: { id: liveVariant.id } });
  // Also check the pure resolver for cancelling a deal that is live right now
  const resolved = resolveVariantPricing(
    { ...getPricingIntent({ ...dv, dealPriceMinor: 410000, dealStartsAt: new Date(now - 1000), dealEndsAt: new Date(now + HOUR), dealRegularPriceMinor: 460000, dealRegularCompareAtMinor: 520000, priceMinor: 410000, compareAtPriceMinor: 460000 }), dealPriceMinor: null, dealStartsAt: null, dealEndsAt: null },
    new Date(now)
  );
  assert(dv.priceMinor === 460000 && dv.dealPriceMinor === null, "Clearing a deal in the editor removes it");
  assert(resolved.priceMinor === 460000 && resolved.compareAtPriceMinor === 520000 && resolved.dealRegularPriceMinor === null, "Cancelling a live deal restores regular pricing");

  // CSV price update during a live deal also edits the regular price
  await updateSellerProduct(orgA, submitted.id, {
    variants: [{ id: liveVariant.id, title: liveVariant.title, sku: liveVariant.sku, priceMinor: 460000, compareAtPriceMinor: 520000,
      dealPriceMinor: 400000, dealStartsAt: new Date(Date.now() - 60_000).toISOString(), dealEndsAt: new Date(Date.now() + HOUR).toISOString() }],
  }, userA);
  await importSellerProductsCsv(orgA, [{ sku: liveVariant.sku, title: "x", pricePkr: 4700, stock: 28 }], {}, userA);
  dv = await prisma.productVariant.findUniqueOrThrow({ where: { id: liveVariant.id } });
  assert(dv.priceMinor === 400000 && dv.dealRegularPriceMinor === 470000, "CSV price import during a deal updates the regular price only");

  // ---------------------------------------------------------------
  console.log("\n🧪 [6] Input validation");
  await expectError(
    () => updateSellerProduct(orgA, multi.id, { images: [{ url: "javascript:alert(1)" }] }, userA),
    "uploaded files or https",
    "Non-https image URLs are rejected"
  );
  await expectError(
    () => createSellerProduct(orgA, {
      title: `Zero ${nonce}`, description: "x", categoryId: category.id,
      variants: [{ title: "D", sku: `CAT-ZERO-${nonce}`, priceMinor: 0 }],
    }, userA),
    "price must be greater than zero",
    "Zero prices are rejected"
  );
  await expectError(
    () => createSellerProduct(orgA, {
      title: `Bad Category ${nonce}`, description: "x", categoryId: "missing-category",
      variants: [{ title: "D", sku: `CAT-BADCAT-${nonce}`, priceMinor: 1000 }],
    }, userA),
    "valid, active category",
    "Unknown categories are rejected"
  );

  // ---------------------------------------------------------------
  console.log("\n🧪 [7] Roles, structured data and description formatting");
  assert(!CATALOG_WRITE_ROLES.includes(SellerMembershipRole.FULFILLMENT_MANAGER), "Fulfillment managers cannot change the catalog");
  assert(CATALOG_WRITE_ROLES.includes(SellerMembershipRole.CATALOG_MANAGER), "Catalog managers can change the catalog");
  const ld = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
  assert(!ld.includes("</script>") && JSON.parse(ld).name === "</script><script>alert(1)</script>", "JSON-LD cannot close its script tag and still round-trips");
  const blocks = parseDescription("Intro line\n\n## Features\n- One\n- **Two**\n\n<b>raw</b>");
  assert(
    blocks.length === 4 && blocks[1].kind === "heading" && blocks[2].kind === "list" && blocks[3].kind === "paragraph",
    "Description supports paragraphs, headings and bullet lists"
  );

  // Cleanup: keep the shared catalog tidy
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  await prisma.product.updateMany({ where: { id: { in: createdProductIds } }, data: { status: ProductStatus.ARCHIVED } });

  console.log("\n=========================================================");
  console.log(`🏁 SELLER CATALOG RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=========================================================\n");
  if (failed > 0) process.exit(1);
}

run()
  .catch((err) => {
    console.error("FATAL ERROR IN SELLER CATALOG SUITE:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
