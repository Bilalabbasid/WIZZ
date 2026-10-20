import { notFound } from "next/navigation";
import { getCategoryBySlug, getCategoryFilterMetadata, getProducts } from "@/modules/catalog/services";
import { ProductCard } from "@/components/product-card";
import { SITE_CONFIG } from "@/lib/config";
import Link from "next/link";
import { ChevronRight, Layers, SlidersHorizontal, Check, ArrowUpDown, Star, Tag, Truck, X } from "lucide-react";
import { MarketplaceFilterSidebar } from "@/components/marketplace-filter-sidebar";
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

export async function generateMetadata({ params, searchParams }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const sParams = await searchParams;
  const category = await getCategoryBySlug(slug);

  if (!category) {
    return {
      title: "Category Not Found | WIZZ.PK",
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
  const { slug } = await params;
  const sParams = await searchParams;
  const page = Math.max(1, Number(sParams.page || "1"));
  const minPriceMinor = sParams.minPrice ? Math.round(Number(sParams.minPrice) * 100) : undefined;
  const maxPriceMinor = sParams.maxPrice ? Math.round(Number(sParams.maxPrice) * 100) : undefined;
  const inStockOnly = sParams.inStock === "true";
  const dealsOnly = sParams.deals === "true";
  const freeShippingOnly = sParams.freeShipping === "true";
  const minRating = sParams.rating ? Number(sParams.rating) : undefined;

  const [filterMeta, catalogData] = await Promise.all([
    getCategoryFilterMetadata(slug),
    getProducts({
      categorySlug: slug,
      brandSlug: sParams.brand,
      minPriceMinor,
      maxPriceMinor,
      inStockOnly,
      minRating,
      dealsOnly,
      freeShippingOnly,
      sort: sParams.sort,
      page,
      limit: 12,
    }),
  ]);

  if (!filterMeta) {
    notFound();
  }

  const { category, subcategories, availableBrands, priceRange } = filterMeta;
  const { products, total, totalPages, hasPrevPage, hasNextPage } = catalogData;

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

  // Helper to build URL query strings preserving other filter parameters
  function buildFilterUrl(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams();
    if (sParams.brand) next.set("brand", sParams.brand);
    if (sParams.minPrice) next.set("minPrice", sParams.minPrice);
    if (sParams.maxPrice) next.set("maxPrice", sParams.maxPrice);
    if (sParams.inStock) next.set("inStock", sParams.inStock);
    if (sParams.rating) next.set("rating", sParams.rating);
    if (sParams.deals) next.set("deals", sParams.deals);
    if (sParams.freeShipping) next.set("freeShipping", sParams.freeShipping);
    if (sParams.sort) next.set("sort", sParams.sort);
    if (sParams.page && sParams.page !== "1") next.set("page", sParams.page);

    for (const [key, val] of Object.entries(updates)) {
      if (val === undefined || val === "") {
        next.delete(key);
      } else {
        next.set(key, val);
      }
    }

    const qs = next.toString();
    return `/categories/${slug}${qs ? `?${qs}` : ""}`;
  }

  const hasActiveFilters = Boolean(
    sParams.brand ||
    sParams.minPrice ||
    sParams.maxPrice ||
    sParams.inStock ||
    sParams.rating ||
    sParams.deals ||
    sParams.freeShipping
  );

  const activeBrand = availableBrands.find((b) => b.slug === sParams.brand);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Schema.org CollectionPage & BreadcrumbList */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-500 overflow-x-auto whitespace-nowrap">
        <Link href="/" className="hover:text-slate-900 transition-colors">Home</Link>
        <ChevronRight size={14} />
        <Link href="/products" className="hover:text-slate-900 transition-colors">Categories</Link>
        {category.parent && (
          <>
            <ChevronRight size={14} />
            <Link href={`/categories/${category.parent.slug}`} className="hover:text-slate-900 transition-colors">
              {category.parent.name}
            </Link>
          </>
        )}
        <ChevronRight size={14} />
        <span className="font-semibold text-slate-900 truncate">{category.name}</span>
      </nav>

      {/* Category Header (Compact marketplace style, products near top) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-xs">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
              Department
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500 font-medium">
              {total} verified product{total === 1 ? "" : "s"}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            {category.name}
          </h1>
          {category.description && (
            <p className="text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed">
              {category.description}
            </p>
          )}

          {/* Subcategory Taxonomy Pills */}
          {subcategories.length > 0 && (
            <div className="pt-3 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                Sub-categories:
              </span>
              {subcategories.map((sub) => (
                <Link
                  key={sub.id}
                  href={`/categories/${sub.slug}`}
                  className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 hover:border-emerald-600 hover:text-emerald-700 hover:bg-emerald-50/50 transition-all"
                >
                  {sub.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Catalog Section: Filter Sidebar & Product Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Marketplace Refinement Sidebar */}
        <MarketplaceFilterSidebar
          categories={subcategories.map((s) => ({
            id: s.id,
            name: s.name,
            slug: s.slug,
          }))}
          brands={availableBrands.map((b) => ({
            id: b.id,
            name: b.name,
            slug: b.slug,
            count: b.count,
          }))}
          currentParams={{
            brand: sParams.brand,
            minPrice: sParams.minPrice,
            maxPrice: sParams.maxPrice,
            inStock: sParams.inStock,
            rating: sParams.rating,
            deals: sParams.deals,
            freeShipping: sParams.freeShipping,
            sort: sParams.sort,
          }}
          basePath={`/categories/${slug}`}
          totalResults={total}
        />

        {/* Product Grid Area */}
        <main className="lg:col-span-3 space-y-6">
          {/* Active Filter Chips */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 pt-1 pb-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                Active Filters:
              </span>

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

              {(sParams.minPrice || sParams.maxPrice) && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white border border-slate-200 text-slate-700">
                  Price: PKR {sParams.minPrice || "0"} – {sParams.maxPrice || "Any"}
                  <Link href={buildFilterUrl({ minPrice: undefined, maxPrice: undefined, page: undefined })} className="text-slate-400 hover:text-slate-700">
                    <X size={12} />
                  </Link>
                </span>
              )}

              <Link
                href={`/categories/${slug}`}
                className="text-xs font-bold text-rose-600 hover:underline ml-1"
              >
                Clear All
              </Link>
            </div>
          )}

          {/* Top Sort & Count Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <span className="text-xs font-semibold text-slate-600">
              Showing <span className="font-bold text-slate-900">{products.length}</span> of{" "}
              <span className="font-bold text-slate-900">{total}</span> listings
            </span>

            {/* Sort Controls */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <ArrowUpDown size={14} className="text-slate-400" />
              <label htmlFor="category-sort" className="text-xs font-semibold text-slate-600 whitespace-nowrap">Sort by:</label>
              <form method="GET" action={`/categories/${slug}`} className="flex items-center gap-2">
                {sParams.brand && <input type="hidden" name="brand" value={sParams.brand} />}
                {sParams.minPrice && <input type="hidden" name="minPrice" value={sParams.minPrice} />}
                {sParams.maxPrice && <input type="hidden" name="maxPrice" value={sParams.maxPrice} />}
                {sParams.inStock && <input type="hidden" name="inStock" value={sParams.inStock} />}
                {sParams.rating && <input type="hidden" name="rating" value={sParams.rating} />}
                {sParams.deals && <input type="hidden" name="deals" value={sParams.deals} />}
                {sParams.freeShipping && <input type="hidden" name="freeShipping" value={sParams.freeShipping} />}
                <select
                  id="category-sort"
                  name="sort"
                  defaultValue={sParams.sort || "featured"}
                  className="text-xs font-semibold rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="featured">Featured First</option>
                  <option value="newest">Newest Arrivals</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="rating">Highest Rated</option>
                </select>
                <button
                  type="submit"
                  className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-slate-800 transition-colors shadow-xs"
                >
                  Sort
                </button>
              </form>
            </div>
          </div>

          {/* Grid Display: 2 cols on mobile, 3 cols on desktop */}
          {products.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <SlidersHorizontal size={22} />
              </div>
              <h3 className="font-bold text-lg text-slate-900">No products match your filter criteria</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Try loosening your price boundaries or unchecking brand restrictions to view more listings.
              </p>
              <Link
                href={`/categories/${slug}`}
                className="inline-block mt-2 text-xs font-bold px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
              >
                Reset Filters
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 gap-3.5 sm:gap-4.5">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <nav aria-label="Pagination" className="pt-8 border-t border-slate-200 flex items-center justify-between">
              <div>
                {hasPrevPage ? (
                  <Link
                    href={buildFilterUrl({ page: String(page - 1) })}
                    className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    ← Previous
                  </Link>
                ) : (
                  <span className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-400 cursor-not-allowed">
                    ← Previous
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pNum) => (
                  <Link
                    key={pNum}
                    href={buildFilterUrl({ page: String(pNum) })}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                      pNum === page
                        ? "bg-slate-900 text-white shadow-sm"
                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                    }`}
                  >
                    {pNum}
                  </Link>
                ))}
              </div>

              <div>
                {hasNextPage ? (
                  <Link
                    href={buildFilterUrl({ page: String(page + 1) })}
                    className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Next →
                  </Link>
                ) : (
                  <span className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-400 cursor-not-allowed">
                    Next →
                  </span>
                )}
              </div>
            </nav>
          )}
        </main>
      </div>
    </div>
  );
}
