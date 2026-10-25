import { getProducts, getCategories, getAllBrands } from "@/modules/catalog/services";
import { ProductCard } from "@/components/product-card";
import { MarketplaceFilterSidebar } from "@/components/marketplace-filter-sidebar";
import Link from "next/link";
import { Search, Sparkles, ArrowUpDown, Filter, X, Star, Tag, Truck } from "lucide-react";
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

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const { q = "" } = await searchParams;
  const trimmed = q.trim();

  // Internal search pages must be excluded from indexing to prevent duplicate content
  // and crawl budget dilution, while allowing link equity follow.
  return {
    title: trimmed ? `"${trimmed}" Search Results | WIZZ.PK` : "Search Products | WIZZ.PK",
    description: "Search verified physical tech, EDC, and outdoor hardware on WIZZ.PK.",
    robots: {
      index: false,
      follow: true,
    },
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = (params.q || "").trim();
  const page = Math.max(1, Number(params.page || "1"));
  const minPriceMinor = params.minPrice ? Math.round(Number(params.minPrice) * 100) : undefined;
  const maxPriceMinor = params.maxPrice ? Math.round(Number(params.maxPrice) * 100) : undefined;
  const inStockOnly = params.inStock === "true";
  const dealsOnly = params.deals === "true";
  const freeShippingOnly = params.freeShipping === "true";
  const minRating = params.rating ? Number(params.rating) : undefined;

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
      sort: params.sort,
      page,
      limit: 12,
    }),
    getCategories(),
    getAllBrands(),
  ]);

  const { products, total, totalPages, hasPrevPage, hasNextPage } = catalogData;

  function buildSearchUrl(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (params.category) next.set("category", params.category);
    if (params.brand) next.set("brand", params.brand);
    if (params.minPrice) next.set("minPrice", params.minPrice);
    if (params.maxPrice) next.set("maxPrice", params.maxPrice);
    if (params.inStock) next.set("inStock", params.inStock);
    if (params.rating) next.set("rating", params.rating);
    if (params.deals) next.set("deals", params.deals);
    if (params.freeShipping) next.set("freeShipping", params.freeShipping);
    if (params.sort) next.set("sort", params.sort);

    if (updates.page) {
      if (updates.page !== "1") next.set("page", updates.page);
    } else if (!("page" in updates) && params.page && params.page !== "1") {
      next.set("page", params.page);
    }

    for (const [key, val] of Object.entries(updates)) {
      if (val === undefined || val === "") {
        next.delete(key);
      } else {
        next.set(key, val);
      }
    }

    const qs = next.toString();
    return `/search${qs ? `?${qs}` : ""}`;
  }

  const startItem = total === 0 ? 0 : (page - 1) * 12 + 1;
  const endItem = Math.min(page * 12, total);
  const activeCategory = categories.find((c) => c.slug === params.category);
  const activeBrand = brands.find((b) => b.slug === params.brand);

  const hasActiveFilters = Boolean(
    params.category ||
      params.brand ||
      params.minPrice ||
      params.maxPrice ||
      params.inStock ||
      params.rating ||
      params.deals ||
      params.freeShipping
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-7">
      {/* Search Header Bar (Amazon style) */}
      <div className="border-b border-slate-200 pb-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold text-emerald-700 tracking-wider uppercase">
              Marketplace Search
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-0.5 flex flex-wrap items-center gap-2">
              <span>Results for</span>
              <span className="text-emerald-700">"{query || "All Products"}"</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {total > 0
                ? `Showing ${startItem}–${endItem} of ${total} verified products in Pakistan`
                : "No matching products found"}
            </p>
          </div>

          {/* Quick Keyword Refinement Form */}
          <form method="GET" action="/search" className="w-full sm:w-auto sm:min-w-[320px] flex items-center gap-2">
            {params.category && <input type="hidden" name="category" value={params.category} />}
            {params.brand && <input type="hidden" name="brand" value={params.brand} />}
            {params.sort && <input type="hidden" name="sort" value={params.sort} />}
            {params.inStock && <input type="hidden" name="inStock" value={params.inStock} />}

            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Search catalog..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-xs"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors shadow-xs shrink-0"
            >
              Search
            </button>
          </form>
        </div>

        {/* Sorting & Filter Summary Strip (Amazon style) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <span className="text-xs text-slate-500 font-medium">
            Over {total} verified listing{total === 1 ? "" : "s"}
          </span>

          <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
              <ArrowUpDown size={13} className="text-slate-400" />
              <span>Sort by:</span>
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: "featured", label: "Featured" },
                { id: "newest", label: "Newest" },
                { id: "price_asc", label: "Price: Low to High" },
                { id: "price_desc", label: "Price: High to Low" },
                { id: "rating", label: "Top Rated" },
              ].map((opt) => {
                const isSelected = (params.sort || "featured") === opt.id;
                return (
                  <Link
                    key={opt.id}
                    href={buildSearchUrl({
                      sort: opt.id === "featured" ? undefined : opt.id,
                      page: undefined,
                    })}
                    className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-colors ${
                      isSelected
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {opt.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Active Filter Chips Bar */}
      {hasActiveFilters && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mr-1">
            <Filter size={13} className="text-emerald-600" />
            Active Filters:
          </span>

          {activeCategory && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800">
              Department: {activeCategory.name}
              <Link href={buildSearchUrl({ category: undefined, page: undefined })} className="text-emerald-500 hover:text-emerald-800">
                <X size={12} />
              </Link>
            </span>
          )}

          {activeBrand && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800">
              Brand: {activeBrand.name}
              <Link href={buildSearchUrl({ brand: undefined, page: undefined })} className="text-emerald-500 hover:text-emerald-800">
                <X size={12} />
              </Link>
            </span>
          )}

          {dealsOnly && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 border border-rose-200 text-rose-800">
              <Tag size={12} className="text-rose-600" />
              On Sale
              <Link href={buildSearchUrl({ deals: undefined, page: undefined })} className="text-rose-400 hover:text-rose-700">
                <X size={12} />
              </Link>
            </span>
          )}

          {freeShippingOnly && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800">
              <Truck size={12} className="text-emerald-600" />
              Free Shipping
              <Link href={buildSearchUrl({ freeShipping: undefined, page: undefined })} className="text-emerald-500 hover:text-emerald-800">
                <X size={12} />
              </Link>
            </span>
          )}

          {minRating && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 border border-amber-200 text-amber-900">
              <Star size={12} className="fill-amber-400 text-amber-400" />
              {minRating}★ & Up
              <Link href={buildSearchUrl({ rating: undefined, page: undefined })} className="text-amber-500 hover:text-amber-800">
                <X size={12} />
              </Link>
            </span>
          )}

          {inStockOnly && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800">
              In-Stock Only
              <Link href={buildSearchUrl({ inStock: undefined, page: undefined })} className="text-emerald-500 hover:text-emerald-800">
                <X size={12} />
              </Link>
            </span>
          )}

          {(params.minPrice || params.maxPrice) && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white border border-slate-200 text-slate-700">
              Price: PKR {params.minPrice || "0"} – {params.maxPrice || "Any"}
              <Link href={buildSearchUrl({ minPrice: undefined, maxPrice: undefined, page: undefined })} className="text-slate-400 hover:text-slate-700">
                <X size={12} />
              </Link>
            </span>
          )}

          <Link
            href={`/search?q=${encodeURIComponent(query)}`}
            className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline ml-auto"
          >
            Clear All
          </Link>
        </div>
      )}

      {/* Main Search Grid with Amazon Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <MarketplaceFilterSidebar
          categories={categories}
          brands={brands}
          currentParams={params}
          basePath="/search"
          totalResults={total}
        />

        {/* Results Area */}
        <div className="lg:col-span-3 space-y-6">
          {products.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-6 shadow-xs">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                <Search size={28} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900">No matching products found</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                  We couldn't find any products matching "{query}". Try checking your spelling, using more general search terms, or exploring our departments:
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                {categories.slice(0, 4).map((c) => (
                  <Link
                    key={c.id}
                    href={`/categories/${c.slug}`}
                    className="text-xs font-semibold px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                  >
                    {c.name}
                  </Link>
                ))}
                <Link
                  href="/products"
                  className="text-xs font-bold px-3.5 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <Sparkles size={13} />
                  <span>Browse All Listings</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-200">
                  <span className="text-xs text-slate-500">
                    Page {page} of {totalPages} ({total} matching products)
                  </span>

                  <div className="flex items-center gap-1.5">
                    {hasPrevPage ? (
                      <Link
                        href={buildSearchUrl({ page: String(page - 1) })}
                        className="text-xs px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium transition-colors"
                      >
                        Previous
                      </Link>
                    ) : (
                      <span className="text-xs px-3 py-2 rounded-lg bg-slate-100 text-slate-400 font-medium cursor-not-allowed">
                        Previous
                      </span>
                    )}

                    {Array.from({ length: totalPages }).map((_, i) => {
                      const pageNum = i + 1;
                      const isCurrent = pageNum === page;
                      return (
                        <Link
                          key={pageNum}
                          href={buildSearchUrl({ page: String(pageNum) })}
                          aria-current={isCurrent ? "page" : undefined}
                          className={`w-8 h-8 rounded-lg text-xs font-bold flex items-center justify-center transition-colors ${
                            isCurrent
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {pageNum}
                        </Link>
                      );
                    })}

                    {hasNextPage ? (
                      <Link
                        href={buildSearchUrl({ page: String(page + 1) })}
                        className="text-xs px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium transition-colors"
                      >
                        Next
                      </Link>
                    ) : (
                      <span className="text-xs px-3 py-2 rounded-lg bg-slate-100 text-slate-400 font-medium cursor-not-allowed">
                        Next
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
