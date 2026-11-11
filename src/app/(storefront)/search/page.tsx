import { getProducts, getCategories, getAllBrands, parseListingParams } from "@/modules/catalog/services";
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
  FOCUS_RING,
  PILL_INK,
  PILL_OUTLINE,
  type ActiveFilterChip,
} from "@/components/catalog-ui";
import Link from "next/link";
import { getCommerceSettings } from "@/lib/commerce-settings";
import { Search } from "lucide-react";
import type { Metadata } from "next";

export interface SearchPageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
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

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const { q } = await searchParams;
  const trimmed = typeof q === "string" ? q.trim() : "";

  // Internal search pages must be excluded from indexing to prevent duplicate content
  // and crawl budget dilution, while allowing link equity follow.
  return {
    title: trimmed ? `Search results for "${trimmed}"` : "Search",
    description: "Search verified physical tech, EDC, and outdoor hardware on WIZZ.PK.",
    robots: {
      index: false,
      follow: true,
    },
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { freeShippingThresholdMinor } = await getCommerceSettings();
  const rawParams = await searchParams;
  const query = typeof rawParams.q === "string" ? rawParams.q.trim() : "";
  const params = {
    q: query || undefined,
    category: str(rawParams.category),
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
  const inStockOnly = params.inStock === "true";
  const dealsOnly = params.deals === "true";
  const freeShippingOnly = params.freeShipping === "true";

  const [catalogData, categories, brands] = await Promise.all([
    getProducts({
      query: query || undefined,
      categorySlug: params.category,
      brandSlug: params.brand,
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
  ]);

  const { products, total, totalPages } = catalogData;

  function buildSearchUrl(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams();
    for (const key of ["q", "category", "brand", "minPrice", "maxPrice", "inStock", "rating", "deals", "freeShipping", "sort"] as const) {
      const v = params[key];
      if (v) next.set(key, v);
    }
    for (const [key, val] of Object.entries(updates)) {
      if (val === undefined || val === "" || (key === "page" && val === "1")) next.delete(key);
      else next.set(key, val);
    }
    const qs = next.toString();
    return `/search${qs ? `?${qs}` : ""}`;
  }

  const startItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(page * PAGE_SIZE, total);
  const activeCategory = categories.find((c) => c.slug === params.category);
  const activeBrand = brands.find((b) => b.slug === params.brand);

  const chips: ActiveFilterChip[] = [];
  if (activeCategory) chips.push({ key: "category", label: activeCategory.name, removeHref: buildSearchUrl({ category: undefined }) });
  if (activeBrand) chips.push({ key: "brand", label: `Brand: ${activeBrand.name}`, removeHref: buildSearchUrl({ brand: undefined }) });
  if (dealsOnly) chips.push({ key: "deals", label: "On sale", removeHref: buildSearchUrl({ deals: undefined }) });
  if (freeShippingOnly) chips.push({ key: "freeShipping", label: "Free delivery", removeHref: buildSearchUrl({ freeShipping: undefined }) });
  if (minRating) chips.push({ key: "rating", label: `${minRating}+ stars`, removeHref: buildSearchUrl({ rating: undefined }) });
  if (inStockOnly) chips.push({ key: "inStock", label: "In stock", removeHref: buildSearchUrl({ inStock: undefined }) });
  if (params.minPrice || params.maxPrice) {
    chips.push({
      key: "price",
      label: `Rs ${params.minPrice || "0"} – ${params.maxPrice || "any"}`,
      removeHref: buildSearchUrl({ minPrice: undefined, maxPrice: undefined }),
    });
  }

  return (
    <div className={`${CATALOG_CONTAINER} space-y-8 pb-20`}>
      <CatalogPageHeader
        breadcrumb={[{ label: "Home", href: "/" }, { label: "Search" }]}
        eyebrow="Search results"
        title={query ? <>&ldquo;{query}&rdquo;</> : "All products"}
        subtitle={
          total > 0
            ? `Showing ${startItem}–${endItem} of ${total} product${total === 1 ? "" : "s"}`
            : "No matching products"
        }
        actions={
          <>
            <MarketplaceFilterSidebar
              display="trigger"
              freeShippingThresholdMinor={freeShippingThresholdMinor}
              categories={categories}
              brands={brands}
              currentParams={params}
              basePath="/search"
              totalResults={total}
            />
            <CatalogSortSelect basePath="/search" value={sort} params={params} />
          </>
        }
      />

      {/* Refine the keywords without losing the filters */}
      <form method="GET" action="/search" role="search" className="max-w-xl">
        {(["category", "brand", "sort", "inStock", "deals", "freeShipping", "rating", "minPrice", "maxPrice"] as const).map((k) =>
          params[k] ? <input key={k} type="hidden" name={k} value={params[k]} /> : null
        )}
        <label htmlFor="search-refine" className="sr-only">
          Search products
        </label>
        <div className="flex h-12 items-center gap-2 rounded-full border border-line bg-white pl-5 pr-1.5 focus-within:border-ink focus-within:ring-1 focus-within:ring-ink">
          <Search size={18} aria-hidden="true" className="shrink-0 text-ink" />
          <input
            id="search-refine"
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search products"
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-mute-2 focus:outline-none"
          />
          <button
            type="submit"
            className={`h-9 shrink-0 rounded-full bg-ink px-4 text-sm font-medium text-white hover:bg-ink-2 ${FOCUS_RING}`}
          >
            Search
          </button>
        </div>
      </form>

      <CatalogActiveFilters chips={chips} clearHref={query ? `/search?q=${encodeURIComponent(query)}` : "/search"} />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[260px_minmax(0,1fr)]">
        <MarketplaceFilterSidebar
          display="sidebar"
          freeShippingThresholdMinor={freeShippingThresholdMinor}
          categories={categories}
          brands={brands}
          currentParams={params}
          basePath="/search"
          totalResults={total}
        />

        <section aria-label="Search results" className="min-w-0 space-y-10 lg:border-t lg:border-line lg:pt-6">
          {products.length === 0 ? (
            <CatalogEmptyState
              icon={<Search size={20} />}
              title="No matching products"
              actions={
                <>
                  {categories.slice(0, 4).map((c) => (
                    <Link key={c.id} href={`/categories/${c.slug}`} className={PILL_OUTLINE}>
                      {c.name}
                    </Link>
                  ))}
                  <Link href="/products" className={PILL_INK}>
                    Browse all products
                  </Link>
                </>
              }
            >
              {query ? (
                <>
                  Nothing matched &ldquo;{query}&rdquo;
                  {chips.length > 0 ? " with these filters" : ""}. Check the spelling, try a more general word, or browse a
                  department.
                </>
              ) : (
                <>Try a different filter, or browse a department.</>
              )}
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
            hrefForPage={(p) => buildSearchUrl({ page: String(p) })}
            totalLabel={`${total} matching`}
          />
        </section>
      </div>
    </div>
  );
}
