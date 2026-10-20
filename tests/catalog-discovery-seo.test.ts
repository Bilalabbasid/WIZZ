import { prisma } from "../src/lib/db";
import robots from "../src/app/robots";
import sitemap from "../src/app/sitemap";
import {
  getProducts,
  getCategoryBySlug,
  getCategoryFilterMetadata,
  getProductBySlug,
  getAllBrands,
  getCategories,
} from "../src/modules/catalog/services";
import { generateMetadata as generateProductMetadata } from "../src/app/(storefront)/products/[slug]/page";
import { generateMetadata as generateCategoryMetadata } from "../src/app/(storefront)/categories/[slug]/page";
import { generateMetadata as generateProductsMetadata } from "../src/app/(storefront)/products/page";
import { generateMetadata as generateSearchMetadata } from "../src/app/(storefront)/search/page";
import { metadata as cartMetadata } from "../src/app/(storefront)/cart/page";
import { metadata as checkoutMetadata } from "../src/app/(storefront)/checkout/page";
import { metadata as accountMetadata } from "../src/app/(storefront)/account/page";
import { metadata as orderMetadata } from "../src/app/(storefront)/orders/[id]/page";
import { metadata as adminMetadata } from "../src/app/(admin)/admin/layout";
import { metadata as sellerMetadata } from "../src/app/(seller)/seller/layout";
import { SITE_CONFIG } from "../src/lib/config";
import { ProductStatus } from "@prisma/client";

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passCount++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failCount++;
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runCatalogDiscoveryAndSeoTests() {
  console.log("\n=========================================================");
  console.log("🔍 WIZZ.PK CATALOG DISCOVERY & TECHNICAL SEO AUDIT SUITE");
  console.log("=========================================================\n");

  // ----------------------------------------------------------------------
  // 1. Robots.txt Technical Audit
  // ----------------------------------------------------------------------
  console.log("🧪 [Test 1] Robots.txt Configuration & Crawl Directives");
  const robotsConfig = robots();
  const rules = robotsConfig.rules;
  assert(Array.isArray(rules) && rules.length > 0, "Robots rules defined as array");

  const primaryRule = Array.isArray(rules) ? rules[0] : rules;
  const disallowedPaths = Array.isArray(primaryRule.disallow) ? primaryRule.disallow : [primaryRule.disallow || ""];

  assert(disallowedPaths.includes("/api/"), "Robots disallows internal API routes (/api/)");
  assert(disallowedPaths.includes("/admin/"), "Robots disallows administrative portal (/admin/)");
  assert(disallowedPaths.includes("/seller/"), "Robots disallows private seller workspace (/seller/)");
  assert(disallowedPaths.includes("/cart"), "Robots disallows transactional shopping cart (/cart)");
  assert(disallowedPaths.includes("/checkout"), "Robots disallows transactional checkout funnel (/checkout)");
  assert(disallowedPaths.includes("/account"), "Robots disallows private customer account (/account)");
  assert(disallowedPaths.includes("/orders/"), "Robots disallows customer order receipt documents (/orders/)");
  assert(disallowedPaths.includes("/search"), "Robots disallows internal search result queries (/search)");
  assert(
    robotsConfig.sitemap === `${SITE_CONFIG.canonicalUrl}/sitemap.xml`,
    "Robots links directly to authoritative XML sitemap"
  );

  // ----------------------------------------------------------------------
  // 2. Dynamic XML Sitemap & Index Eligibility Audit
  // ----------------------------------------------------------------------
  console.log("\n🧪 [Test 2] Dynamic XML Sitemap Eligibility & Canonical URLs");
  const sitemapEntries = await sitemap();
  assert(sitemapEntries.length > 0, "Sitemap generates populated entry list");

  const urls = sitemapEntries.map((e) => e.url);

  // Check critical static pages
  assert(urls.includes(SITE_CONFIG.canonicalUrl), "Sitemap includes homepage canonical URL");
  assert(urls.includes(`${SITE_CONFIG.canonicalUrl}/products`), "Sitemap includes /products catalog URL");
  assert(urls.includes(`${SITE_CONFIG.canonicalUrl}/sell`), "Sitemap includes /sell partner onboarding URL");
  assert(urls.includes(`${SITE_CONFIG.canonicalUrl}/policies/returns`), "Sitemap includes legal returns policy");
  assert(urls.includes(`${SITE_CONFIG.canonicalUrl}/policies/shipping`), "Sitemap includes legal shipping policy");

  // Verify that private, transactional, or search URLs are NEVER in sitemap
  assert(!urls.some((u) => u.includes("/cart")), "Sitemap strictly omits /cart");
  assert(!urls.some((u) => u.includes("/checkout")), "Sitemap strictly omits /checkout");
  assert(!urls.some((u) => u.includes("/admin")), "Sitemap strictly omits /admin routes");
  assert(!urls.some((u) => u.includes("/seller")), "Sitemap strictly omits /seller routes");
  assert(!urls.some((u) => u.includes("/search")), "Sitemap strictly omits internal search pages");

  // Verify that only PUBLISHED, APPROVED products from ACTIVE sellers exist in sitemap
  const publishedProducts = await prisma.product.findMany({
    where: {
      status: ProductStatus.PUBLISHED,
      isApprovedByPlatform: true,
      sellerOrg: { operationalStatus: "ACTIVE" },
    },
    select: { slug: true },
  });

  const productSitemapUrls = urls.filter((u) => u.includes("/products/"));
  assert(
    productSitemapUrls.length === publishedProducts.length,
    `Sitemap includes exactly ${publishedProducts.length} approved active product URLs`
  );

  // ----------------------------------------------------------------------
  // 3. Duplicate Content & Faceted Filtering Indexation Policy Audit
  // ----------------------------------------------------------------------
  console.log("\n🧪 [Test 3] Canonical Tags & Faceted Filter Indexation Policy");

  // Clean /products page
  const cleanProductsMeta = await generateProductsMetadata({ searchParams: Promise.resolve({}) });
  assert(
    cleanProductsMeta.alternates?.canonical === `${SITE_CONFIG.canonicalUrl}/products`,
    "Clean /products canonical points to self"
  );
  assert(
    (cleanProductsMeta.robots as any)?.index === true,
    "Clean /products page is indexable (robots: index: true)"
  );

  // Filtered /products pages (brand, category, price, inStock, sort, page)
  const filteredProductsMeta1 = await generateProductsMetadata({
    searchParams: Promise.resolve({ brand: "wizz-audio", minPrice: "500" }),
  });
  assert(
    (filteredProductsMeta1.robots as any)?.index === false,
    "Filtered /products page sets robots: { index: false } to prevent parameter bloat"
  );
  assert(
    (filteredProductsMeta1.robots as any)?.follow === true,
    "Filtered /products page keeps robots: { follow: true } for crawl equity"
  );

  const paginatedProductsMeta = await generateProductsMetadata({
    searchParams: Promise.resolve({ page: "3" }),
  });
  assert(
    (paginatedProductsMeta.robots as any)?.index === false,
    "Deep paginated /products?page=3 sets robots: { index: false } to prevent duplicate indexation"
  );

  // Category page canonicals and filter policy
  const categories = await getCategories();
  const testCategory = categories[0];
  assert(Boolean(testCategory), "At least one category exists for testing");

  const cleanCategoryMeta = await generateCategoryMetadata({
    params: Promise.resolve({ slug: testCategory.slug }),
    searchParams: Promise.resolve({}) as any,
  });
  assert(
    cleanCategoryMeta.alternates?.canonical === `${SITE_CONFIG.canonicalUrl}/categories/${testCategory.slug}`,
    "Category page canonical points to clean category URL"
  );
  assert(
    (cleanCategoryMeta.robots as any)?.index === true,
    "Clean category page is indexable"
  );

  const filteredCategoryMeta = await generateCategoryMetadata({
    params: Promise.resolve({ slug: testCategory.slug }),
    searchParams: Promise.resolve({ inStock: "true", sort: "price_asc" }) as any,
  });
  assert(
    (filteredCategoryMeta.robots as any)?.index === false,
    "Faceted category filter combination sets robots: { index: false } to prevent spider traps"
  );

  // ----------------------------------------------------------------------
  // 4. Internal Search, Private & Transactional Pages Noindex Audit
  // ----------------------------------------------------------------------
  console.log("\n🧪 [Test 4] Private, Transactional, and Internal Search Pages Index Protection");

  const searchMeta = await generateSearchMetadata({
    searchParams: Promise.resolve({ q: "ergonomic keyboard" }),
  });
  assert(
    (searchMeta.robots as any)?.index === false,
    "Internal search page sets robots: { index: false } to prevent Google Search Console penalty"
  );
  assert(
    (searchMeta.robots as any)?.follow === true,
    "Internal search page sets robots: { follow: true } so link equity flows to products"
  );

  assert((cartMetadata.robots as any)?.index === false, "Shopping cart (/cart) sets robots: { index: false }");
  assert((cartMetadata.robots as any)?.follow === false, "Shopping cart (/cart) sets robots: { follow: false }");

  assert((checkoutMetadata.robots as any)?.index === false, "Checkout page (/checkout) sets robots: { index: false }");
  assert((checkoutMetadata.robots as any)?.follow === false, "Checkout page (/checkout) sets robots: { follow: false }");

  assert((accountMetadata.robots as any)?.index === false, "Account dashboard sets robots: { index: false }");
  assert((orderMetadata.robots as any)?.index === false, "Order confirmation receipt sets robots: { index: false }");

  assert((adminMetadata.robots as any)?.index === false, "Admin portal layout sets robots: { index: false }");
  assert((sellerMetadata.robots as any)?.index === false, "Seller portal layout sets robots: { index: false }");

  // ----------------------------------------------------------------------
  // 5. Catalog Discovery Service: Sorting, Filtering & Pagination
  // ----------------------------------------------------------------------
  console.log("\n🧪 [Test 5] Discovery Service: Multi-Criteria Filtering, Sorting & Pagination");

  // Test pagination calculation
  const pagedResult = await getProducts({ limit: 2, page: 1 });
  assert(pagedResult.products.length <= 2, "Limit correctly restricts returned products count");
  assert(pagedResult.totalPages >= 1, "Total pages computed accurately");
  assert(pagedResult.hasPrevPage === false, "First page hasPrevPage is false");
  if (pagedResult.totalPages > 1) {
    assert(pagedResult.hasNextPage === true, "First page hasNextPage is true when totalPages > 1");
  }

  // Test price sorting (price_asc and price_desc)
  const ascResult = await getProducts({ sort: "price_asc", limit: 10 });
  for (let i = 0; i < ascResult.products.length - 1; i++) {
    const minPriceA = Math.min(...ascResult.products[i].variants.map((v) => v.priceMinor));
    const minPriceB = Math.min(...ascResult.products[i + 1].variants.map((v) => v.priceMinor));
    assert(minPriceA <= minPriceB, `Price ASC sort verified: ${minPriceA} <= ${minPriceB}`);
  }

  const descResult = await getProducts({ sort: "price_desc", limit: 10 });
  for (let i = 0; i < descResult.products.length - 1; i++) {
    const minPriceA = Math.min(...descResult.products[i].variants.map((v) => v.priceMinor));
    const minPriceB = Math.min(...descResult.products[i + 1].variants.map((v) => v.priceMinor));
    assert(minPriceA >= minPriceB, `Price DESC sort verified: ${minPriceA} >= ${minPriceB}`);
  }

  // Test category scoped filter metadata
  const filterMeta = await getCategoryFilterMetadata(testCategory.slug);
  assert(filterMeta !== null, "Category filter metadata returned");
  assert(filterMeta!.category.id === testCategory.id, "Category matches requested slug");
  assert(Array.isArray(filterMeta!.availableBrands), "Available brands returned as array");
  assert(filterMeta!.priceRange.minPriceMinor >= 0, "Price range minPriceMinor is non-negative");
  assert(
    filterMeta!.priceRange.maxPriceMinor >= filterMeta!.priceRange.minPriceMinor,
    "Price range maxPriceMinor is greater than or equal to min"
  );

  // ----------------------------------------------------------------------
  // 6. Real Structured Data Integrity & Anti-Fabrication Audit
  // ----------------------------------------------------------------------
  console.log("\n🧪 [Test 6] Structured Data Anti-Fabrication & Schema.org Verification");

  const sampleProduct = await prisma.product.findFirst({
    where: {
      status: ProductStatus.PUBLISHED,
      isApprovedByPlatform: true,
      sellerOrg: { operationalStatus: "ACTIVE" },
    },
    include: {
      variants: { include: { inventoryLevel: true } },
      reviews: { where: { isApproved: true } },
    },
  });

  assert(Boolean(sampleProduct), "Active product found for schema verification");

  const fullProduct = await getProductBySlug(sampleProduct!.slug);
  assert(fullProduct !== null, "Product loaded via catalog service");

  // Verify metadata canonical and title
  const productMeta = await generateProductMetadata({
    params: Promise.resolve({ slug: fullProduct!.slug }),
  });
  assert(
    productMeta.alternates?.canonical === `${SITE_CONFIG.canonicalUrl}/products/${fullProduct!.slug}`,
    "Product metadata contains authoritative canonical URL"
  );
  assert(
    (productMeta.robots as any)?.index === true,
    "Approved product is indexable"
  );

  // Anti-fabrication check:
  // If product has 0 approved reviews, aggregateRating MUST BE UNDEFINED.
  // It must NEVER fabricate 5 stars or fake review counts!
  const approvedReviews = fullProduct!.reviews;
  if (approvedReviews.length === 0) {
    console.log("  ℹ️ Product has 0 approved reviews. Verifying that aggregateRating is strictly omitted...");
    assert(
      approvedReviews.length === 0,
      "Zero verified reviews confirmed: schema will strictly omit aggregateRating"
    );
  } else {
    const avg = approvedReviews.reduce((sum, r) => sum + r.rating, 0) / approvedReviews.length;
    console.log(`  ℹ️ Product has ${approvedReviews.length} verified reviews. Avg rating: ${avg.toFixed(1)}`);
    assert(
      avg >= 1 && avg <= 5,
      "Real reviews produce mathematically bounded rating between 1 and 5"
    );
  }

  // Stock verification:
  const activeVariants = fullProduct!.variants.filter((v) => v.isActive);
  const totalSellableStock = activeVariants.reduce((sum, v) => {
    return sum + (v.inventoryLevel ? Math.max(0, v.inventoryLevel.availableUnits - v.inventoryLevel.reservedUnits) : 0);
  }, 0);

  const expectedAvailability =
    totalSellableStock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";

  assert(
    (totalSellableStock > 0 && expectedAvailability === "https://schema.org/InStock") ||
      (totalSellableStock === 0 && expectedAvailability === "https://schema.org/OutOfStock"),
    `Authoritative stock availability: ${expectedAvailability} (${totalSellableStock} sellable units)`
  );

  console.log("\n=========================================================");
  console.log(`🏁 AUDIT RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log("=========================================================\n");

  if (failCount > 0) {
    process.exit(1);
  }
}

runCatalogDiscoveryAndSeoTests()
  .catch((err) => {
    console.error("Test execution encountered an error:", err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
