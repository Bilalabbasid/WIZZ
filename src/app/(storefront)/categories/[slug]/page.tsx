import { notFound } from "next/navigation";
import { serializeJsonLd } from "@/lib/formatters";
import { getCategoryBySlug, getCategoryFilterMetadata, getProducts, parseListingParams } from "@/modules/catalog/services";
import { ProductCard } from "@/components/product-card";
import { SITE_CONFIG } from "@/lib/config";
import Link from "next/link";
import { getCommerceSettings } from "@/lib/commerce-settings";
import { SlidersHorizontal } from "lucide-react";
import { MarketplaceFilterSidebar } from "@/components/marketplace-filter-sidebar";
import { CatalogSortSelect } from "@/components/catalog-sort-select";
import {
  CATALOG_CONTAINER,
  CATALOG_GRID,
  CatalogActiveFilters,
  CatalogEmptyState,
  CatalogPageHeader,
  CatalogPagination,
  FOCUS_RING,
  PILL_INK,
  type ActiveFilterChip,
} from "@/components/catalog-ui";
import type { Metadata } from "next";

export interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    brand?: string;
    minPrice?: string;
    maxPrice?: string;
    inStock?: string;
    rating?: string;
    deals?: string;
    freeShipping?: string;
    sort?: "featured" | "price_asc" | "price_desc" | "newest" | "rating";
    page?: string;
  }>;
}

const PAGE_SIZE = 12;

/** Repeated query keys arrive as arrays; only a plain string is a usable value. */
function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}

export async function generateMetadata({ params, searchParams }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const sParams = await searchParams;
  const category = await getCategoryBySlug(slug);

  if (!category || !category.isActive) {
    return {
      title: "Category not found",
      robots: { index: false, follow: false },
    };
  }

  const canonicalUrl = `${SITE_CONFIG.canonicalUrl}/categories/${category.slug}`;
  const title = `${category.name} | WIZZ.PK Marketplace`;
  const description = category.description || `Browse high-performance verified hardware and physical products in ${category.name} on WIZZ.PK.`;

  // Policy for filter combinations:
  // If user applies multiple faceted filters or price bounds, set robots to noindex, follow
  // and maintain canonical to the clean category URL to prevent duplicate content bloat.
  const hasFiltering = Boolean(
    sParams.brand ||
    sParams.minPrice ||
    sParams.maxPrice ||
    sParams.inStock ||
    sParams.rating ||
    sParams.deals ||
    sParams.freeShipping ||
    sParams.sort
  );

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "WIZZ.PK",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: hasFiltering
      ? { index: false, follow: true }
      : { index: true, follow: true },
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { freeShippingThresholdMinor } = await getCommerceSettings();
  const { slug } = await params;
  const rawParams = await searchParams;
  const sParams = {
    brand: str(rawParams.brand),
    minPrice: str(rawParams.minPrice),
    maxPrice: str(rawParams.maxPrice),
    inStock: str(rawParams.inStock),
    rating: str(rawParams.rating),
    deals: str(rawParams.deals),
    freeShipping: str(rawParams.freeShipping),
    sort: str(rawParams.sort),
    page: str(rawParams.page),
  };
  // Query-string values are untrusted: drop non-numeric/negative values instead of passing NaN to Prisma
  const { page, minPriceMinor, maxPriceMinor, minRating, sort } = parseListingParams(rawParams);
  const inStockOnly = sParams.inStock === "true";
  const dealsOnly = sParams.deals === "true";
  const freeShippingOnly = sParams.freeShipping === "true";

  // Missing or inactive categories 404
  const filterMeta = await getCategoryFilterMetadata(slug);
  if (!filterMeta) {
    notFound();
  }

  const catalogData = await getProducts({
    // The category plus all of its active sub-categories
    categoryIds: filterMeta.categoryIds,
    brandSlug: sParams.brand,
    minPriceMinor,
    maxPriceMinor,
    inStockOnly,
    minRating,
    dealsOnly,
    freeShippingOnly,
    sort,
    page,
    limit: PAGE_SIZE,
  });

  const { category, subcategories, availableBrands } = filterMeta;
  const { products, total, totalPages } = catalogData;

  // JSON-LD Structured Data
  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: category.name,
    description: category.description || undefined,
    url: `${SITE_CONFIG.canonicalUrl}/categories/${category.slug}`,
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
        name: "Categories",
        item: `${SITE_CONFIG.canonicalUrl}/products`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: category.name,
        item: `${SITE_CONFIG.canonicalUrl}/categories/${category.slug}`,
      },
    ],
  };

  // URLs that keep the other filters. Filter changes reset to page 1.
  function buildFilterUrl(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams();
    for (const key of ["brand", "minPrice", "maxPrice", "inStock", "rating", "deals", "freeShipping", "sort"] as const) {
      const v = sParams[key];
      if (v) next.set(key, v);
    }
    for (const [key, val] of Object.entries(updates)) {
      if (val === undefined || val === "" || (key === "page" && val === "1")) next.delete(key);
      else next.set(key, val);
    }
    const qs = next.toString();
    return `/categories/${slug}${qs ? `?${qs}` : ""}`;
  }

  const activeBrand = availableBrands.find((b) => b.slug === sParams.brand);

  const chips: ActiveFilterChip[] = [];
  if (activeBrand) chips.push({ key: "brand", label: `Brand: ${activeBrand.name}`, removeHref: buildFilterUrl({ brand: undefined }) });
  if (dealsOnly) chips.push({ key: "deals", label: "On sale", removeHref: buildFilterUrl({ deals: undefined }) });
  if (freeShippingOnly) chips.push({ key: "freeShipping", label: "Free delivery", removeHref: buildFilterUrl({ freeShipping: undefined }) });
  if (minRating) chips.push({ key: "rating", label: `${minRating}+ stars`, removeHref: buildFilterUrl({ rating: undefined }) });
  if (inStockOnly) chips.push({ key: "inStock", label: "In stock", removeHref: buildFilterUrl({ inStock: undefined }) });
  if (sParams.minPrice || sParams.maxPrice) {
    chips.push({
      key: "price",
      label: `Rs ${sParams.minPrice || "0"} – ${sParams.maxPrice || "any"}`,
      removeHref: buildFilterUrl({ minPrice: undefined, maxPrice: undefined }),
    });
  }

  const startItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(page * PAGE_SIZE, total);

  const sidebarProps = {
    freeShippingThresholdMinor,
    categories: subcategories.map((s) => ({ id: s.id, name: s.name, slug: s.slug })),
    brands: availableBrands.map((b) => ({ id: b.id, name: b.name, slug: b.slug, count: b.count })),
    currentParams: {
      brand: sParams.brand,
      minPrice: sParams.minPrice,
      maxPrice: sParams.maxPrice,
      inStock: sParams.inStock,
      rating: sParams.rating,
      deals: sParams.deals,
      freeShipping: sParams.freeShipping,
      sort: sParams.sort,
    },
    basePath: `/categories/${slug}`,
    categoryLinkMode: "path" as const,
    allCategoriesLabel: `All ${category.name}`,
    totalResults: total,
  };

  return (
    <div className={`${CATALOG_CONTAINER} space-y-8 pb-20`}>
      {/* Schema.org CollectionPage & BreadcrumbList */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(collectionJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />

      <CatalogPageHeader
        breadcrumb={[
          { label: "Home", href: "/" },
          { label: "Categories", href: "/products" },
          ...(category.parent?.isActive ? [{ label: category.parent.name, href: `/categories/${category.parent.slug}` }] : []),
          { label: category.name },
        ]}
        eyebrow="Department"
        title={category.name}
        subtitle={
          total > 0
            ? `Showing ${startItem}–${endItem} of ${total} product${total === 1 ? "" : "s"}`
            : "No products match these filters"
        }
        description={category.description || undefined}
        actions={
          <>
            <MarketplaceFilterSidebar display="trigger" {...sidebarProps} />
            <CatalogSortSelect basePath={`/categories/${slug}`} value={sort} params={sParams} id="category-sort" />
          </>
        }
      />

      {/* Sub-category pills */}
      {subcategories.length > 0 && (
        <nav aria-label="Sub-categories" className="-mx-5 overflow-x-auto px-5 no-scrollbar sm:mx-0 sm:overflow-visible sm:px-0">
          <ul className="flex w-max gap-2 py-1 sm:w-auto sm:flex-wrap">
            <li>
              <span
                aria-current="page"
                className="inline-flex h-11 items-center rounded-full border border-ink bg-ink px-[18px] text-sm font-medium text-white"
              >
                All {category.name}
              </span>
            </li>
            {subcategories.map((sub) => (
              <li key={sub.id}>
                <Link
                  href={`/categories/${sub.slug}`}
                  className={`inline-flex h-11 items-center whitespace-nowrap rounded-full border border-line bg-white px-[18px] text-sm font-medium text-ink transition-colors hover:border-ink ${FOCUS_RING}`}
                >
                  {sub.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <CatalogActiveFilters chips={chips} clearHref={`/categories/${slug}`} />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[260px_minmax(0,1fr)]">
        <MarketplaceFilterSidebar display="sidebar" {...sidebarProps} />

        <section aria-label={`${category.name} products`} className="min-w-0 space-y-10 lg:border-t lg:border-line lg:pt-6">
          {products.length === 0 ? (
            <CatalogEmptyState
              icon={<SlidersHorizontal size={20} />}
              title={chips.length > 0 ? "No products match these filters" : "Nothing listed here yet"}
              actions={
                chips.length > 0 ? (
                  <Link href={`/categories/${slug}`} className={PILL_INK}>
                    Reset filters
                  </Link>
                ) : (
                  <Link href="/products" className={PILL_INK}>
                    Browse all products
                  </Link>
                )
              }
            >
              {chips.length > 0
                ? "Try widening the price range or removing the brand filter."
                : `There are no products in ${category.name} right now.`}
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
