"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/formatters";
import { SITE_CONFIG } from "@/lib/config";
import { SlidersHorizontal, Check, Star, X } from "lucide-react";
import { FOCUS_RING, MONO_LABEL } from "./catalog-ui";

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
    seller?: string;
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
  /**
   * "query" (default): department links filter the current listing via ?category=.
   * "path": department links navigate to /categories/{slug} (used on category pages,
   * where the listed departments are sub-categories).
   */
  categoryLinkMode?: "query" | "path";
  /** Label of the "all departments" link (e.g. "All Electronics" on a category page). */
  allCategoriesLabel?: string;
  totalResults?: number;
  /** Free-delivery threshold from admin commerce settings. */
  freeShippingThresholdMinor?: number;
  /**
   * "all" (default) renders the desktop sidebar and the mobile "Filters" pill.
   * "sidebar" renders only the desktop column; "trigger" only the mobile pill + drawer,
   * so pages can place the pill in their toolbar.
   */
  display?: "all" | "sidebar" | "trigger";
}

const PRESERVED_KEYS = [
  "q",
  "category",
  "brand",
  "seller",
  "minPrice",
  "maxPrice",
  "inStock",
  "rating",
  "deals",
  "freeShipping",
  "sort",
] as const;

const FILTER_KEYS = ["category", "brand", "seller", "minPrice", "maxPrice", "inStock", "rating", "deals", "freeShipping"] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-t border-line py-5">
      <h3 className={`${MONO_LABEL} text-mute`}>{title}</h3>
      {children}
    </section>
  );
}

/** Square ink checkbox visual for link-based toggles. */
function CheckMark({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border ${
        on ? "border-ink bg-ink text-white" : "border-mute-2 bg-white"
      }`}
    >
      {on && <Check size={12} strokeWidth={2.5} />}
    </span>
  );
}

const rowLink = `flex min-h-11 items-center justify-between gap-3 rounded-xl px-2 -mx-2 text-sm text-ink transition-colors hover:bg-white ${FOCUS_RING}`;

const chip = (on: boolean) =>
  `inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-[13px] font-medium transition-colors ${FOCUS_RING} ${
    on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"
  }`;

export function MarketplaceFilterSidebar({
  categories,
  brands,
  currentParams,
  basePath = "/products",
  categoryLinkMode = "query",
  allCategoriesLabel = "All departments",
  totalResults,
  freeShippingThresholdMinor = SITE_CONFIG.shipping.freeShippingThresholdMinor,
  display = "all",
}: MarketplaceFilterSidebarProps) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [brandSearchQuery, setBrandSearchQuery] = useState("");
  const filterTriggerRef = React.useRef<HTMLButtonElement>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  const handleCloseMobileDrawer = () => {
    setMobileDrawerOpen(false);
    setTimeout(() => filterTriggerRef.current?.focus(), 50);
  };

  // Keyboard handling (Escape, focus trap) & body scroll lock for the mobile drawer
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!mobileDrawerOpen) return;
      if (e.key === "Escape") {
        setMobileDrawerOpen(false);
        filterTriggerRef.current?.focus();
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    if (mobileDrawerOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
      closeButtonRef.current?.focus();
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
    for (const key of PRESERVED_KEYS) {
      const v = currentParams[key];
      if (typeof v === "string" && v !== "") next.set(key, v);
    }
    for (const [key, val] of Object.entries(updates)) {
      if (val === undefined || val === "") next.delete(key);
      else next.set(key, val);
    }
    const qs = next.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  }

  const activeFilterCount = FILTER_KEYS.filter((k) => {
    const v = currentParams[k];
    return typeof v === "string" && v !== "";
  }).length - (currentParams.minPrice && currentParams.maxPrice ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;

  const filteredBrands = brands.filter((b) => b.name.toLowerCase().includes(brandSearchQuery.toLowerCase()));

  const clearHref = buildUrl(Object.fromEntries(FILTER_KEYS.map((k) => [k, undefined])));

  const filterContent = (idPrefix: string) => (
    <div>
      {/* Header & reset */}
      <div className={`flex min-h-11 items-center justify-between gap-3 pb-3 ${idPrefix === "mobile" && !hasActiveFilters ? "hidden" : ""}`}>
        {/* The drawer already has its own title */}
        <h2 className={idPrefix === "mobile" ? "sr-only" : "text-[17px] font-semibold tracking-[-0.02em] text-ink"}>Filters</h2>
        {hasActiveFilters && (
          <Link
            href={clearHref}
            className={`inline-flex min-h-11 items-center rounded-full px-2 text-[13px] font-medium text-ink underline underline-offset-4 ${FOCUS_RING}`}
          >
            Clear all
          </Link>
        )}
      </div>

      {/* Deals, delivery and availability toggles */}
      <Section title="Offers & availability">
        <ul className="space-y-0.5">
          <li>
            <Link href={buildUrl({ deals: dealsOnly ? undefined : "true" })} className={rowLink}>
              <span className="flex items-center gap-3">
                <CheckMark on={dealsOnly} />
                <span>On sale</span>
              </span>
              <span className="sr-only">{dealsOnly ? "(selected)" : ""}</span>
            </Link>
          </li>
          <li>
            <Link href={buildUrl({ freeShipping: freeShippingOnly ? undefined : "true" })} className={rowLink}>
              <span className="flex items-center gap-3">
                <CheckMark on={freeShippingOnly} />
                <span>
                  Free delivery <span className="text-mute">({formatCurrency(freeShippingThresholdMinor)}+)</span>
                </span>
              </span>
              <span className="sr-only">{freeShippingOnly ? "(selected)" : ""}</span>
            </Link>
          </li>
          <li>
            <Link href={buildUrl({ inStock: inStockOnly ? undefined : "true" })} className={rowLink}>
              <span className="flex items-center gap-3">
                <CheckMark on={inStockOnly} />
                <span>In stock only</span>
              </span>
              <span className="sr-only">{inStockOnly ? "(selected)" : ""}</span>
            </Link>
          </li>
        </ul>
      </Section>

      {/* Customer rating */}
      <Section title="Customer rating">
        <div className="flex flex-wrap gap-2">
          {[4, 3, 2, 1].map((stars) => {
            const isSelected = currentRating === stars;
            return (
              <Link
                key={stars}
                href={buildUrl({ rating: isSelected ? undefined : String(stars) })}
                aria-current={isSelected ? "true" : undefined}
                className={chip(isSelected)}
              >
                <Star size={13} aria-hidden="true" className={isSelected ? "fill-white text-white" : "fill-ink text-ink"} />
                <span>{stars}+</span>
                <span className="sr-only"> stars and up</span>
              </Link>
            );
          })}
        </div>
      </Section>

      {/* Departments / categories */}
      {categories.length > 0 && (
        <Section title="Department">
          <ul className="space-y-0.5">
            <li>
              <Link
                href={buildUrl({ category: undefined })}
                aria-current={!currentParams.category ? "true" : undefined}
                className={`${rowLink} ${!currentParams.category ? "font-semibold" : ""}`}
              >
                <span className="flex items-center gap-3">
                  <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${!currentParams.category ? "bg-ink" : "bg-transparent"}`} />
                  <span>{allCategoriesLabel}</span>
                </span>
              </Link>
            </li>
            {categories.map((c) => {
              const isSelected = currentParams.category === c.slug;
              return (
                <li key={c.id}>
                  <Link
                    href={categoryLinkMode === "path" ? `/categories/${c.slug}` : buildUrl({ category: c.slug })}
                    aria-current={isSelected ? "true" : undefined}
                    className={`${rowLink} ${isSelected ? "font-semibold" : ""}`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${isSelected ? "bg-ink" : "bg-transparent"}`} />
                      <span className="truncate">{c.name}</span>
                    </span>
                    {c._count?.products !== undefined && (
                      <span className="font-mono text-xs text-mute">{c._count.products}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {/* Brands */}
      {brands.length > 0 && (
        <Section title="Brand">
          {brands.length > 6 && (
            <div>
              <label htmlFor={`${idPrefix}-brand-search`} className="sr-only">
                Search brands
              </label>
              <input
                id={`${idPrefix}-brand-search`}
                type="search"
                placeholder="Search brands"
                value={brandSearchQuery}
                onChange={(e) => setBrandSearchQuery(e.target.value)}
                className={`h-11 w-full rounded-full border border-line bg-white px-4 text-sm text-ink placeholder:text-mute-2 ${FOCUS_RING}`}
              />
            </div>
          )}

          <ul className="max-h-64 space-y-0.5 overflow-y-auto pr-1">
            <li>
              <Link href={buildUrl({ brand: undefined })} className={rowLink}>
                <span className="flex items-center gap-3">
                  <CheckMark on={!currentParams.brand} />
                  <span>All brands</span>
                </span>
                <span className="sr-only">{!currentParams.brand ? "(selected)" : ""}</span>
              </Link>
            </li>
            {filteredBrands.map((b) => {
              const isSelected = currentParams.brand === b.slug;
              const count = b._count?.products ?? b.count;
              return (
                <li key={b.id}>
                  <Link href={buildUrl({ brand: isSelected ? undefined : b.slug })} className={rowLink}>
                    <span className="flex min-w-0 items-center gap-3">
                      <CheckMark on={isSelected} />
                      <span className="truncate">{b.name}</span>
                      <span className="sr-only">{isSelected ? "(selected)" : ""}</span>
                    </span>
                    {count !== undefined && <span className="font-mono text-xs text-mute">{count}</span>}
                  </Link>
                </li>
              );
            })}
            {filteredBrands.length === 0 && (
              <li className="px-1 py-2 text-[13px] text-mute">No brands match &ldquo;{brandSearchQuery}&rdquo;.</li>
            )}
          </ul>
        </Section>
      )}

      {/* Price */}
      <Section title="Price (PKR)">
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Under 5,000", min: "0", max: "5000" },
            { label: "5,000–15,000", min: "5000", max: "15000" },
            { label: "15,000–50,000", min: "15000", max: "50000" },
            { label: "50,000+", min: "50000", max: "" },
          ].map((band) => {
            const isBandActive =
              currentParams.minPrice === band.min &&
              (band.max ? currentParams.maxPrice === band.max : !currentParams.maxPrice);
            return (
              <Link
                key={band.label}
                href={buildUrl({
                  minPrice: isBandActive ? undefined : band.min,
                  maxPrice: isBandActive ? undefined : band.max || undefined,
                })}
                aria-current={isBandActive ? "true" : undefined}
                className={chip(isBandActive)}
              >
                <span className="font-mono">{band.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Custom min / max */}
        <form method="GET" action={basePath} className="space-y-2 pt-2">
          {PRESERVED_KEYS.filter((k) => k !== "minPrice" && k !== "maxPrice").map((k) => {
            const v = currentParams[k];
            return typeof v === "string" && v !== "" ? <input key={k} type="hidden" name={k} value={v} /> : null;
          })}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor={`${idPrefix}-min-price`} className="mb-1 block text-xs text-mute">
                Min
              </label>
              <input
                id={`${idPrefix}-min-price`}
                type="number"
                inputMode="numeric"
                name="minPrice"
                min="0"
                step="100"
                placeholder="0"
                defaultValue={currentParams.minPrice || ""}
                className={`h-11 w-full rounded-full border border-line bg-white px-4 font-mono text-sm text-ink placeholder:text-mute-2 ${FOCUS_RING}`}
              />
            </div>
            <div>
              <label htmlFor={`${idPrefix}-max-price`} className="mb-1 block text-xs text-mute">
                Max
              </label>
              <input
                id={`${idPrefix}-max-price`}
                type="number"
                inputMode="numeric"
                name="maxPrice"
                min="0"
                step="100"
                placeholder="Any"
                defaultValue={currentParams.maxPrice || ""}
                className={`h-11 w-full rounded-full border border-line bg-white px-4 font-mono text-sm text-ink placeholder:text-mute-2 ${FOCUS_RING}`}
              />
            </div>
          </div>
          <button
            type="submit"
            className={`h-11 w-full rounded-full bg-ink text-sm font-medium text-white transition-colors hover:bg-ink-2 ${FOCUS_RING}`}
          >
            Apply price
          </button>
        </form>
      </Section>
    </div>
  );

  return (
    <>
      {/* Desktop column */}
      {display !== "trigger" && (
        <aside aria-label="Filters" className="hidden lg:block">
          <div className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto pb-6 pr-2 [scrollbar-width:thin]">{filterContent("desktop")}</div>
        </aside>
      )}

      {/* Mobile "Filters" pill + drawer */}
      {display !== "sidebar" && (
        <div className="lg:hidden">
          <button
            ref={filterTriggerRef}
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            aria-expanded={mobileDrawerOpen}
            aria-haspopup="dialog"
            className={`inline-flex h-11 items-center gap-2 rounded-full border border-line bg-white px-[18px] text-sm font-medium text-ink transition-colors hover:border-ink ${FOCUS_RING}`}
          >
            <SlidersHorizontal size={16} aria-hidden="true" />
            <span>Filters</span>
            {hasActiveFilters && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1.5 font-mono text-[11px] text-white">
                {activeFilterCount}
                <span className="sr-only"> active</span>
              </span>
            )}
          </button>

          {mobileDrawerOpen && (
            <div className="fixed inset-0 z-50 flex">
              <div className="fixed inset-0 bg-ink/50" onClick={handleCloseMobileDrawer} aria-hidden="true" />
              <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="filter-drawer-heading"
                className="relative z-10 ml-auto flex h-full w-full max-w-sm flex-col bg-canvas"
              >
                <div className="flex items-center justify-between border-b border-line px-5 py-3">
                  <span id="filter-drawer-heading" className="text-[17px] font-semibold tracking-[-0.02em] text-ink">
                    Filter products
                  </span>
                  <button
                    ref={closeButtonRef}
                    type="button"
                    onClick={handleCloseMobileDrawer}
                    aria-label="Close filters"
                    className={`flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-ink hover:border-ink ${FOCUS_RING}`}
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 pt-2">{filterContent("mobile")}</div>

                <div className="border-t border-line bg-canvas px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                  <button
                    type="button"
                    onClick={handleCloseMobileDrawer}
                    className={`h-[52px] w-full rounded-full bg-ink text-[15px] font-medium text-white hover:bg-ink-2 ${FOCUS_RING}`}
                  >
                    {typeof totalResults === "number"
                      ? `Show ${totalResults} result${totalResults === 1 ? "" : "s"}`
                      : "Show results"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
