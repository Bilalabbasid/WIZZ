import { getProducts, getCategories, getAllBrands } from "@/modules/catalog/services";
import { serializeJsonLd } from "@/lib/formatters";
import { ProductCard } from "@/components/product-card";
import { MarketplaceFilterSidebar } from "@/components/marketplace-filter-sidebar";
import { SITE_CONFIG } from "@/lib/config";
import Link from "next/link";
import { Search, ChevronRight, X, ArrowUpDown, Filter, Star, Tag, Truck } from "lucide-react";
import type { Metadata } from "next";

export interface ProductsPageProps {
  searchParams: Promise<{
    category?: string;
    brand?: string;
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
      ? `Catalog Products | WIZZ.PK`
      : "All Products - Verified Hardware & Tech Marketplace | WIZZ.PK",
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
  const params = await searchParams;
  const page = Math.max(1, Number(params.page || "1"));
  const minPriceMinor = params.minPrice ? Math.round(Number(params.minPrice) * 100) : undefined;
  const maxPriceMinor = params.maxPrice ? Math.round(Number(params.maxPrice) * 100) : undefined;
  const inStockOnly = params.inStock === "true";
  const dealsOnly = params.deals === "true";
  const freeShippingOnly = params.freeShipping === "true";
  const minRating = params.rating ? Number(params.rating) : undefined;

  const [catalogData, categories, brands] = await Promise.all([
    getProducts({
      categorySlug: params.category,
      brandSlug: params.brand,
      query: params.q,
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

  // Helper to construct shareable URLs retaining other filter parameters
  function buildFilterUrl(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams();
    if (params.category) next.set("category", params.category);
    if (params.brand) next.set("brand", params.brand);
    if (params.minPrice) next.set("minPrice", params.minPrice);
    if (params.maxPrice) next.set("maxPrice", params.maxPrice);
    if (params.inStock) next.set("inStock", params.inStock);
    if (params.rating) next.set("rating", params.rating);
    if (params.deals) next.set("deals", params.deals);
    if (params.freeShipping) next.set("freeShipping", params.freeShipping);
    if (params.sort) next.set("sort", params.sort);
    if (params.q) next.set("q", params.q);

    // If an explicit page isn't being set, reset to page 1 on filter changes
    if (updates.page) {
      if (updates.page !== "1") next.set("page", updates.page);
    } else if (!("page" in updates) && params.page && params.page !== "1") {
      // Retain existing page only if no filter updates are requested
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
    return `/products${qs ? `?${qs}` : ""}`;
  }

  const hasActiveFilters = Boolean(
    params.category ||
    params.brand ||
    params.minPrice ||
    params.maxPrice ||
    params.inStock ||
    params.rating ||
    params.deals ||
    params.freeShipping ||
    params.q
  );

  const activeCategory = categories.find((c) => c.slug === params.category);
  const activeBrand = brands.find((b) => b.slug === params.brand);

  const startItem = total === 0 ? 0 : (page - 1) * 12 + 1;
  const endItem = Math.min(page * 12, total);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Schema.org Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(collectionJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />

      {/* Semantic Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-xs text-slate-500">
        <Link href="/" className="hover:text-slate-900 transition-colors">
          Home
        </Link>
        <ChevronRight size={14} className="text-slate-400" />
        <span className="font-semibold text-slate-800">All Products</span>
        {activeCategory && (
          <>
            <ChevronRight size={14} className="text-slate-400" />
            <span className="font-semibold text-emerald-700">{activeCategory.name}</span>
          </>
        )}
      </nav>

      {/* Page Header */}
      <div className="border-b border-slate-200 pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-emerald-700 tracking-wider uppercase">Marketplace Catalog</span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
            {activeCategory ? activeCategory.name : "All Products"}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Showing {startItem}–{endItem} of {total} verified physical products in Pakistan
          </p>
        </div>

        {/* Sorting Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs font-semibold text-slate-600 whitespace-nowrap flex items-center gap-1.5">
            <ArrowUpDown size={13} className="text-slate-400" />
            <span>Sort by:</span>
          </label>
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: "featured", label: "Featured" },
              { id: "newest", label: "Newest" },
              { id: "price_asc", label: "Price: Low to High" },
              { id: "price_desc", label: "Price: High to Low" },
              { id: "rating", label: "Top Rated" },
            ].map((option) => {
              const isSelected = (params.sort || "featured") === option.id;
              return (
                <Link
                  key={option.id}
                  href={buildFilterUrl({ sort: option.id === "featured" ? undefined : option.id, page: undefined })}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                    isSelected
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {option.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Filters Bar */}
      {hasActiveFilters && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mr-1">
            <Filter size={13} className="text-emerald-600" />
            Active Filters:
          </span>

          {params.q && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white border border-slate-200 text-slate-700">
              Query: "{params.q}"
              <Link href={buildFilterUrl({ q: undefined, page: undefined })} className="text-slate-400 hover:text-slate-700">
                <X size={12} />
              </Link>
            </span>
          )}

          {activeCategory && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800">
              Category: {activeCategory.name}
              <Link href={buildFilterUrl({ category: undefined, page: undefined })} className="text-emerald-500 hover:text-emerald-800">
                <X size={12} />
              </Link>
            </span>
          )}

          {activeBrand && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800">
              Brand: {activeBrand.name}
              <Link href={buildFilterUrl({ brand: undefined, page: undefined })} className="text-emerald-500 hover:text-emerald-800">
                <X size={12} />
              </Link>
            </span>
          )}

          {dealsOnly && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 border border-rose-200 text-rose-800">
              <Tag size={12} className="text-rose-600" />
              On Sale / Deals
              <Link href={buildFilterUrl({ deals: undefined, page: undefined })} className="text-rose-400 hover:text-rose-700">
                <X size={12} />
              </Link>
            </span>
          )}

          {freeShippingOnly && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800">
              <Truck size={12} className="text-emerald-600" />
              Free Shipping
              <Link href={buildFilterUrl({ freeShipping: undefined, page: undefined })} className="text-emerald-500 hover:text-emerald-800">
                <X size={12} />
              </Link>
            </span>
          )}

          {minRating && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 border border-amber-200 text-amber-900">
              <Star size={12} className="fill-amber-400 text-amber-400" />
              {minRating}★ & Up
              <Link href={buildFilterUrl({ rating: undefined, page: undefined })} className="text-amber-500 hover:text-amber-800">
                <X size={12} />
              </Link>
            </span>
          )}

          {inStockOnly && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800">
              In-Stock Only
              <Link href={buildFilterUrl({ inStock: undefined, page: undefined })} className="text-emerald-500 hover:text-emerald-800">
                <X size={12} />
              </Link>
            </span>
          )}

          {(params.minPrice || params.maxPrice) && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white border border-slate-200 text-slate-700">
              Price: PKR {params.minPrice || "0"} – {params.maxPrice || "Any"}
              <Link href={buildFilterUrl({ minPrice: undefined, maxPrice: undefined, page: undefined })} className="text-slate-400 hover:text-slate-700">
                <X size={12} />
              </Link>
            </span>
          )}

          <Link
            href="/products"
            className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline ml-auto"
          >
            Clear All
          </Link>
        </div>
      )}

      {/* Main Catalog Layout with Amazon/Daraz Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <MarketplaceFilterSidebar
          categories={categories}
          brands={brands}
          currentParams={params}
          basePath="/products"
          totalResults={total}
        />

        {/* Product Grid & Results Area */}
        <div className="lg:col-span-3 space-y-6">

          {products.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Search size={22} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No matching products found</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Try loosening your filters, removing price boundaries, or selecting a different category.
              </p>
              <Link
                href="/products"
                className="inline-block mt-2 text-xs font-semibold bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Clear All Filters
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-200">
              <span className="text-xs text-slate-500">
                Page {page} of {totalPages} ({total} total products)
              </span>

              <div className="flex items-center gap-1.5">
                {hasPrevPage ? (
                  <Link
                    href={buildFilterUrl({ page: String(page - 1) })}
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
                  if (totalPages > 7 && Math.abs(pageNum - page) > 2 && pageNum !== 1 && pageNum !== totalPages) {
                    if (Math.abs(pageNum - page) === 3) {
                      return (
                        <span key={pageNum} className="px-1 text-slate-400 text-xs">
                          …
                        </span>
                      );
                    }
                    return null;
                  }

                  return (
                    <Link
                      key={pageNum}
                      href={buildFilterUrl({ page: String(pageNum) })}
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
                    href={buildFilterUrl({ page: String(page + 1) })}
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
      </div>
    </div>
  );
}
