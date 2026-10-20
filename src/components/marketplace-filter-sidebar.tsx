"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  SlidersHorizontal,
  Check,
  Star,
  Tag,
  Truck,
  RotateCcw,
  X,
  ChevronRight,
  Filter,
  ArrowRight,
} from "lucide-react";

export interface CategoryFacet {
  id: string;
  name: string;
  slug: string;
  _count?: { products: number };
}

export interface BrandFacet {
  id: string;
  name: string;
  slug: string;
  _count?: { products: number };
  count?: number;
}

export interface MarketplaceFilterSidebarProps {
  categories: CategoryFacet[];
  brands: BrandFacet[];
  currentParams: {
    category?: string;
    brand?: string;
    minPrice?: string;
    maxPrice?: string;
    inStock?: string;
    rating?: string;
    deals?: string;
    freeShipping?: string;
    sort?: string;
    q?: string;
  };
  basePath?: string;
  totalResults?: number;
}

export function MarketplaceFilterSidebar({
  categories,
  brands,
  currentParams,
  basePath = "/products",
  totalResults,
}: MarketplaceFilterSidebarProps) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [brandSearchQuery, setBrandSearchQuery] = useState("");
  const filterTriggerRef = React.useRef<HTMLButtonElement>(null);

  const handleCloseMobileDrawer = () => {
    setMobileDrawerOpen(false);
    setTimeout(() => filterTriggerRef.current?.focus(), 50);
  };

  // Keyboard navigation & body scroll lock for mobile drawer
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && mobileDrawerOpen) {
        setMobileDrawerOpen(false);
        filterTriggerRef.current?.focus();
      }
    }
    if (mobileDrawerOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileDrawerOpen]);

  const inStockOnly = currentParams.inStock === "true";
  const dealsOnly = currentParams.deals === "true";
  const freeShippingOnly = currentParams.freeShipping === "true";
  const currentRating = currentParams.rating ? Number(currentParams.rating) : undefined;

  function buildUrl(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams();
    if (currentParams.q) next.set("q", currentParams.q);
    if (currentParams.category) next.set("category", currentParams.category);
    if (currentParams.brand) next.set("brand", currentParams.brand);
    if (currentParams.minPrice) next.set("minPrice", currentParams.minPrice);
    if (currentParams.maxPrice) next.set("maxPrice", currentParams.maxPrice);
    if (currentParams.inStock) next.set("inStock", currentParams.inStock);
    if (currentParams.rating) next.set("rating", currentParams.rating);
    if (currentParams.deals) next.set("deals", currentParams.deals);
    if (currentParams.freeShipping) next.set("freeShipping", currentParams.freeShipping);
    if (currentParams.sort) next.set("sort", currentParams.sort);

    for (const [key, val] of Object.entries(updates)) {
      if (val === undefined || val === "") {
        next.delete(key);
      } else {
        next.set(key, val);
      }
    }

    const qs = next.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  }

  const hasActiveFilters = Boolean(
    currentParams.category ||
      currentParams.brand ||
      currentParams.minPrice ||
      currentParams.maxPrice ||
      currentParams.inStock ||
      currentParams.rating ||
      currentParams.deals ||
      currentParams.freeShipping
  );

  const activeCategory = categories.find((c) => c.slug === currentParams.category);
  const activeBrand = brands.find((b) => b.slug === currentParams.brand);

  const filteredBrands = brands.filter((b) =>
    b.name.toLowerCase().includes(brandSearchQuery.toLowerCase())
  );

  const filterContent = (
    <div className="space-y-6">
      {/* Header & Reset */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
          <SlidersHorizontal size={15} className="text-emerald-600" />
          <span>Refine Results</span>
        </h3>
        {hasActiveFilters && (
          <Link
            href={buildUrl({
              category: undefined,
              brand: undefined,
              minPrice: undefined,
              maxPrice: undefined,
              inStock: undefined,
              rating: undefined,
              deals: undefined,
              freeShipping: undefined,
            })}
            className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline"
          >
            Clear All
          </Link>
        )}
      </div>

      {/* 1. Deals & Promotions (Amazon style) */}
      <div className="space-y-2 pb-4 border-b border-slate-100">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
          Deals & Promotions
        </span>
        <div className="space-y-1.5">
          <Link
            href={buildUrl({ deals: dealsOnly ? undefined : "true" })}
            className={`flex items-center justify-between p-2 rounded-lg text-xs font-semibold transition-colors ${
              dealsOnly
                ? "bg-rose-50 border border-rose-200 text-rose-800"
                : "hover:bg-slate-50 text-slate-700"
            }`}
          >
            <span className="flex items-center gap-2">
              <Tag size={13} className="text-rose-600" />
              <span>Today's Deals / On Sale</span>
            </span>
            {dealsOnly && <Check size={14} className="text-rose-600" />}
          </Link>

          <Link
            href={buildUrl({ freeShipping: freeShippingOnly ? undefined : "true" })}
            className={`flex items-center justify-between p-2 rounded-lg text-xs font-semibold transition-colors ${
              freeShippingOnly
                ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                : "hover:bg-slate-50 text-slate-700"
            }`}
          >
            <span className="flex items-center gap-2">
              <Truck size={13} className="text-emerald-600" />
              <span>Free Shipping (PKR 5,000+)</span>
            </span>
            {freeShippingOnly && <Check size={14} className="text-emerald-600" />}
          </Link>
        </div>
      </div>

      {/* 2. Availability / In-Stock Only */}
      <div className="space-y-2 pb-4 border-b border-slate-100">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
          Availability
        </span>
        <Link
          href={buildUrl({ inStock: inStockOnly ? undefined : "true" })}
          className={`flex items-center justify-between p-2 rounded-lg border text-xs font-semibold transition-all ${
            inStockOnly
              ? "bg-emerald-50/70 border-emerald-300 text-emerald-800"
              : "bg-slate-50/50 border-slate-200 text-slate-700 hover:bg-slate-100"
          }`}
        >
          <span className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                inStockOnly ? "bg-emerald-500" : "bg-slate-300"
              }`}
            />
            <span>In-Stock Items Only</span>
          </span>
          {inStockOnly && <Check size={14} className="text-emerald-600" />}
        </Link>
      </div>

      {/* 3. Customer Reviews (Amazon Star Rating Filter) */}
      <div className="space-y-2 pb-4 border-b border-slate-100">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
          Customer Reviews
        </span>
        <div className="space-y-1">
          {[4, 3, 2, 1].map((starThreshold) => {
            const isSelected = currentRating === starThreshold;
            return (
              <Link
                key={starThreshold}
                href={buildUrl({
                  rating: isSelected ? undefined : String(starThreshold),
                })}
                className={`flex items-center justify-between p-1.5 rounded-lg text-xs transition-colors ${
                  isSelected
                    ? "bg-amber-50 text-amber-900 font-bold border border-amber-200"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center text-amber-400">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={13}
                        className={
                          i < starThreshold
                            ? "fill-amber-400 text-amber-400"
                            : "text-slate-300 fill-slate-100"
                        }
                      />
                    ))}
                  </div>
                  <span className="text-[11px] font-medium text-slate-600">& Up</span>
                </div>
                {isSelected && <Check size={13} className="text-amber-700" />}
              </Link>
            );
          })}
        </div>
      </div>

      {/* 4. Departments / Categories */}
      {categories.length > 0 && (
        <div className="space-y-2 pb-4 border-b border-slate-100">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
            Department
          </span>
          <ul className="space-y-1 text-xs">
            <li>
              <Link
                href={buildUrl({ category: undefined })}
                className={`block py-1 px-2 rounded-lg transition-colors ${
                  !currentParams.category
                    ? "bg-emerald-50 text-emerald-800 font-bold"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                All Departments
              </Link>
            </li>
            {categories.map((c) => (
              <li key={c.id}>
                <Link
                  href={buildUrl({ category: c.slug })}
                  className={`flex items-center justify-between py-1 px-2 rounded-lg transition-colors ${
                    currentParams.category === c.slug
                      ? "bg-emerald-50 text-emerald-800 font-bold"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className="truncate pr-2">{c.name}</span>
                  {c._count?.products !== undefined && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      {c._count.products}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 5. Brands (Amazon & Daraz Checkboxes) */}
      {brands.length > 0 && (
        <div className="space-y-2 pb-4 border-b border-slate-100">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
            Featured Brands
          </span>

          {brands.length > 6 && (
            <input
              type="text"
              placeholder="Search brands..."
              value={brandSearchQuery}
              onChange={(e) => setBrandSearchQuery(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          )}

          <ul className="space-y-1 text-xs max-h-52 overflow-y-auto pr-1">
            <li>
              <Link
                href={buildUrl({ brand: undefined })}
                className={`flex items-center gap-2 py-1 px-2 rounded-lg transition-colors ${
                  !currentParams.brand
                    ? "bg-emerald-50 text-emerald-800 font-bold"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span
                  className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                    !currentParams.brand
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-slate-300 bg-white"
                  }`}
                >
                  {!currentParams.brand && <Check size={10} />}
                </span>
                <span>All Brands</span>
              </Link>
            </li>
            {filteredBrands.map((b) => {
              const isSelected = currentParams.brand === b.slug;
              const count = b._count?.products ?? b.count;
              return (
                <li key={b.id}>
                  <Link
                    href={buildUrl({ brand: isSelected ? undefined : b.slug })}
                    className={`flex items-center justify-between py-1 px-2 rounded-lg transition-colors ${
                      isSelected
                        ? "bg-emerald-50 text-emerald-800 font-bold"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate pr-2">
                      <span
                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                          isSelected
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {isSelected && <Check size={10} />}
                      </span>
                      <span className="truncate">{b.name}</span>
                    </span>
                    {count !== undefined && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({count})
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* 6. Price Range & Quick Presets (Daraz & Amazon) */}
      <div className="space-y-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
          Price (PKR)
        </span>

        {/* Quick Price Bands */}
        <div className="space-y-1 text-xs">
          {[
            { label: "Under PKR 5,000", min: "0", max: "5000" },
            { label: "PKR 5,000 to PKR 15,000", min: "5000", max: "15000" },
            { label: "PKR 15,000 to PKR 50,000", min: "15000", max: "5000" },
            { label: "Over PKR 50,000", min: "50000", max: "" },
          ].map((band, idx) => {
            const isBandActive =
              currentParams.minPrice === band.min &&
              (band.max ? currentParams.maxPrice === band.max : !currentParams.maxPrice);

            return (
              <Link
                key={idx}
                href={buildUrl({
                  minPrice: isBandActive ? undefined : band.min,
                  maxPrice: isBandActive ? undefined : band.max || undefined,
                })}
                className={`block py-1 px-2 rounded-lg transition-colors ${
                  isBandActive
                    ? "bg-emerald-50 text-emerald-800 font-bold"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {band.label}
              </Link>
            );
          })}
        </div>

        {/* Custom Min / Max Inputs */}
        <form method="GET" action={basePath} className="space-y-2 pt-2 border-t border-slate-100">
          {currentParams.q && <input type="hidden" name="q" value={currentParams.q} />}
          {currentParams.category && (
            <input type="hidden" name="category" value={currentParams.category} />
          )}
          {currentParams.brand && (
            <input type="hidden" name="brand" value={currentParams.brand} />
          )}
          {currentParams.inStock && (
            <input type="hidden" name="inStock" value={currentParams.inStock} />
          )}
          {currentParams.rating && (
            <input type="hidden" name="rating" value={currentParams.rating} />
          )}
          {currentParams.deals && (
            <input type="hidden" name="deals" value={currentParams.deals} />
          )}
          {currentParams.freeShipping && (
            <input type="hidden" name="freeShipping" value={currentParams.freeShipping} />
          )}
          {currentParams.sort && (
            <input type="hidden" name="sort" value={currentParams.sort} />
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <input
                type="number"
                name="minPrice"
                min="0"
                step="100"
                placeholder="Min PKR"
                defaultValue={currentParams.minPrice || ""}
                className="w-full text-xs rounded-lg border border-slate-300 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <input
                type="number"
                name="maxPrice"
                min="0"
                step="100"
                placeholder="Max PKR"
                defaultValue={currentParams.maxPrice || ""}
                className="w-full text-xs rounded-lg border border-slate-300 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full text-xs bg-slate-900 text-white font-bold py-1.5 rounded-lg hover:bg-slate-800 transition-colors shadow-xs flex items-center justify-center gap-1.5"
          >
            <span>Apply Price</span>
            <ArrowRight size={12} />
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden lg:block space-y-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs sticky top-28">
          {filterContent}
        </div>
      </aside>

      {/* Mobile Drawer Trigger Bar */}
      <div className="lg:hidden w-full">
        <button
          ref={filterTriggerRef}
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          aria-expanded={mobileDrawerOpen}
          aria-label="Open filter and refinement drawer"
          className="w-full flex items-center justify-between p-3.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs font-bold shadow-xs hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-emerald-500 min-h-[44px]"
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal size={15} className="text-emerald-600" />
            <span>Refine & Filter Products</span>
            {hasActiveFilters && (
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                Active
              </span>
            )}
          </span>
          <span className="text-[11px] text-emerald-700 flex items-center gap-1 font-bold">
            <span>Filter</span>
            <ChevronRight size={14} />
          </span>
        </button>

        {/* Mobile Slide-Over Drawer */}
        {mobileDrawerOpen && (
          <div className="fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
              onClick={handleCloseMobileDrawer}
              aria-hidden="true"
            />

            {/* Slide-over panel */}
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="filter-drawer-heading"
              className="relative ml-auto w-full max-w-xs sm:max-w-sm bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200"
            >
              <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <Filter size={16} className="text-emerald-600" />
                  <span id="filter-drawer-heading" className="font-extrabold text-sm text-slate-900">
                    Filters & Refinement
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCloseMobileDrawer}
                  aria-label="Close filters drawer"
                  className="w-11 h-11 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5">{filterContent}</div>

              <div className="p-4 border-t border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={handleCloseMobileDrawer}
                  className="w-full py-3 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 transition min-h-[44px] shadow-sm"
                >
                  View {totalResults ? `${totalResults} Products` : "Results"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
