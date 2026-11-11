import { getProducts, getCategories, getAllBrands, parseListingParams } from "@/modules/catalog/services";
import { serializeJsonLd } from "@/lib/formatters";
import { prisma } from "@/lib/db";
import { ProductCard } from "@/components/product-card";
import { MarketplaceFilterSidebar } from "@/components/marketplace-filter-sidebar";
import { CatalogSortSelect } from "@/components/catalog-sort-select";
import {
  CATALOG_CONTAINER,
  CATALOG_GRID,
  CatalogActiveFilters,
  CatalogEmptyState,
  CatalogPageHeader,
  CatalogPagination,
  PILL_INK,
  type ActiveFilterChip,
} from "@/components/catalog-ui";
import { SITE_CONFIG } from "@/lib/config";
import Link from "next/link";
import { getCommerceSettings } from "@/lib/commerce-settings";
import { Search } from "lucide-react";
import type { Metadata } from "next";

export interface ProductsPageProps {
  searchParams: Promise<{
    category?: string;
    brand?: string;
    /** Seller slug: lists one seller's products ("More from this seller"). */
    seller?: string;
    minPrice?: string;
    maxPrice?: string;
    inStock?: string;
    rating?: string;
    deals?: string;
    freeShipping?: string;
    sort?: "featured" | "price_asc" | "price_desc" | "newest" | "rating";
    q?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 12;

/** Repeated query keys arrive as arrays; only a plain string is a usable value. */
function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}

export async function generateMetadata({ searchParams }: ProductsPageProps): Promise<Metadata> {
  const params = await searchParams;
  const canonicalUrl = `${SITE_CONFIG.canonicalUrl}/products`;

  // Policy for filter combinations & uncontrolled duplicate pages:
  // If any faceted filters, search terms, sorting, or pagination > 1 are applied,
  // set robots: { index: false, follow: true } to preserve crawl budget and prevent search engine index bloat.
  // The clean canonical /products remains indexable: { index: true, follow: true }.
  const hasFiltering = Boolean(
    params.category ||
    params.brand ||
    params.seller ||
    params.minPrice ||
    params.maxPrice ||
    params.inStock ||
    params.rating ||
    params.deals ||
    params.freeShipping ||
    params.sort ||
    params.q ||
    (params.page && params.page !== "1")
  );

  return {
    title: params.category
      ? `Products`
      : "All products",
    description: "Browse verified electronics, rugged accessories, smart tools, and premium hardware on WIZZ.PK with fast nationwide shipping across Pakistan.",
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: "All Products | WIZZ.PK",
      description: "Browse verified physical hardware and accessories on WIZZ.PK.",
      url: canonicalUrl,
      siteName: "WIZZ.PK",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "All Products | WIZZ.PK",
      description: "Browse verified physical hardware and accessories on WIZZ.PK.",
    },
    robots: hasFiltering
      ? { index: false, follow: true }
      : { index: true, follow: true },
  };
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const { freeShippingThresholdMinor } = await getCommerceSettings();
  const rawParams = await searchParams;
  const params = {
    category: str(rawParams.category),
    brand: str(rawParams.brand),
    seller: str(rawParams.seller),
    minPrice: str(rawParams.minPrice),
    maxPrice: str(rawParams.maxPrice),
    inStock: str(rawParams.inStock),
    rating: str(rawParams.rating),
    deals: str(rawParams.deals),
    freeShipping: str(rawParams.freeShipping),
    sort: str(rawParams.sort),
    q: str(rawParams.q),
    page: str(rawParams.page),
  };
  // Query-string values are untrusted: drop non-numeric/negative values instead of passing NaN to Prisma
  const { page, minPriceMinor, maxPriceMinor, minRating, sort } = parseListingParams(rawParams);
  const inStockOnly = params.inStock === "true";
  const dealsOnly = params.deals === "true";
  const freeShippingOnly = params.freeShipping === "true";

  const [catalogData, categories, brands, activeSeller] = await Promise.all([
    getProducts({
      categorySlug: params.category,
      brandSlug: params.brand,
      // getProducts only matches ACTIVE sellers for this filter
      sellerOrgSlug: params.seller,
      query: params.q,
      minPriceMinor,
      maxPriceMinor,
      inStockOnly,
      dealsOnly,
      freeShippingOnly,
      minRating,
      sort,
      page,
      limit: PAGE_SIZE,
    }),
    getCategories(),
    getAllBrands(),
    params.seller
      ? prisma.sellerOrg.findFirst({
          where: { slug: params.seller, operationalStatus: "ACTIVE" },
          select: { name: true, slug: true },
        })
      : Promise.resolve(null),
  ]);

  const { products, total, totalPages } = catalogData;

  // JSON-LD Structured Data
  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "All Products | WIZZ.PK",
    description: "Verified catalog of tech, outdoor gear, and productivity accessories.",
    url: `${SITE_CONFIG.canonicalUrl}/products`,
    isPartOf: {
      "@type": "WebSite",
      name: "WIZZ.PK",
      url: SITE_CONFIG.canonicalUrl,
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: SITE_CONFIG.canonicalUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Products",
        item: `${SITE_CONFIG.canonicalUrl}/products`,
      },
    ],
  };

  // Shareable URLs that keep the other filters. Filter changes reset to page 1.
  function buildFilterUrl(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams();
    for (const key of ["category", "brand", "seller", "minPrice", "maxPrice", "inStock", "rating", "deals", "freeShipping", "sort", "q"] as const) {
      const v = params[key];
      if (v) next.set(key, v);
    }
    for (const [key, val] of Object.entries(updates)) {
      if (val === undefined || val === "" || (key === "page" && val === "1")) next.delete(key);
      else next.set(key, val);
    }
    const qs = next.toString();
    return `/products${qs ? `?${qs}` : ""}`;
  }

  const activeCategory = categories.find((c) => c.slug === params.category);
  const activeBrand = brands.find((b) => b.slug === params.brand);

  const chips: ActiveFilterChip[] = [];
  if (params.q) chips.push({ key: "q", label: `“${params.q}”`, removeHref: buildFilterUrl({ q: undefined }) });
  if (activeCategory) chips.push({ key: "category", label: activeCategory.name, removeHref: buildFilterUrl({ category: undefined }) });
  if (activeBrand) chips.push({ key: "brand", label: `Brand: ${activeBrand.name}`, removeHref: buildFilterUrl({ brand: undefined }) });
  if (params.seller) {
    chips.push({
      key: "seller",
      label: `Seller: ${activeSeller?.name ?? params.seller}`,
      removeHref: buildFilterUrl({ seller: undefined }),
    });
  }
  if (dealsOnly) chips.push({ key: "deals", label: "On sale", removeHref: buildFilterUrl({ deals: undefined }) });
  if (freeShippingOnly) chips.push({ key: "freeShipping", label: "Free delivery", removeHref: buildFilterUrl({ freeShipping: undefined }) });
  if (minRating) chips.push({ key: "rating", label: `${minRating}+ stars`, removeHref: buildFilterUrl({ rating: undefined }) });
  if (inStockOnly) chips.push({ key: "inStock", label: "In stock", removeHref: buildFilterUrl({ inStock: undefined }) });
  if (params.minPrice || params.maxPrice) {
    chips.push({
      key: "price",
      label: `Rs ${params.minPrice || "0"} – ${params.maxPrice || "any"}`,
      removeHref: buildFilterUrl({ minPrice: undefined, maxPrice: undefined }),
    });
  }

  const startItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(page * PAGE_SIZE, total);

  const title = activeCategory
    ? activeCategory.name
    : activeSeller
    ? activeSeller.name
    : params.q
    ? `“${params.q}”`
    : "All products";

  const breadcrumb = [
    { label: "Home", href: "/" },
    { label: "Products", href: "/products" },
    ...(activeCategory ? [{ label: activeCategory.name }] : activeSeller ? [{ label: activeSeller.name }] : []),
  ];

  return (
    <div className={`${CATALOG_CONTAINER} space-y-8 pb-20`}>
      {/* Schema.org Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(collectionJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />

      <CatalogPageHeader
        breadcrumb={breadcrumb}
        eyebrow={activeSeller ? "Seller" : undefined}
        title={title}
        subtitle={
          total > 0
            ? `Showing ${startItem}–${endItem} of ${total} product${total === 1 ? "" : "s"}`
            : "No products match these filters"
        }
        actions={
          <>
            <MarketplaceFilterSidebar
              display="trigger"
              freeShippingThresholdMinor={freeShippingThresholdMinor}
              categories={categories}
              brands={brands}
              currentParams={params}
              basePath="/products"
              totalResults={total}
            />
            <CatalogSortSelect basePath="/products" value={sort} params={params} />
          </>
        }
      />

      <CatalogActiveFilters chips={chips} clearHref="/products" />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[260px_minmax(0,1fr)]">
        <MarketplaceFilterSidebar
          display="sidebar"
          freeShippingThresholdMinor={freeShippingThresholdMinor}
          categories={categories}
          brands={brands}
          currentParams={params}
          basePath="/products"
          totalResults={total}
        />

        <section aria-label="Products" className="min-w-0 space-y-10 lg:border-t lg:border-line lg:pt-6">
          {products.length === 0 ? (
            <CatalogEmptyState
              icon={<Search size={20} />}
              title="No matching products"
              actions={
                <Link href="/products" className={PILL_INK}>
                  Clear all filters
                </Link>
              }
            >
              Try removing a filter, widening the price range or choosing another department.
            </CatalogEmptyState>
          ) : (
            <div className={CATALOG_GRID}>
              {products.map((p) => (
                <ProductCard key={p.id} product={p} freeShippingThresholdMinor={freeShippingThresholdMinor} />
              ))}
            </div>
          )}

          <CatalogPagination
            page={page}
            totalPages={totalPages}
            hrefForPage={(p) => buildFilterUrl({ page: String(p) })}
            totalLabel={`${total} products`}
          />
        </section>
      </div>
    </div>
  );
}
