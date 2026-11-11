"use client";

import React, { useState, useEffect, useRef, useId } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Search, ChevronDown, X, ArrowRight, Package } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

export interface SearchCategoryItem {
  id: string;
  name: string;
  slug: string;
}

export interface SuggestedProduct {
  id: string;
  title: string;
  slug: string;
  categoryName: string;
  brandName?: string | null;
  thumbnail?: string | null;
  priceMinor: number;
  compareAtPriceMinor?: number | null;
}

export interface MarketplaceSearchProps {
  categories: SearchCategoryItem[];
  defaultCategory?: string;
  defaultQuery?: string;
  /** Show the department select inside the pill (wide screens only). */
  showCategorySelect?: boolean;
}

/**
 * Compact header search pill (white, 1px hairline, 44px, fully rounded) with live
 * suggestions from /api/search/suggest. Submitting goes to /search?q=…&category=….
 */
export function MarketplaceSearch({
  categories,
  defaultCategory = "",
  defaultQuery = "",
  showCategorySelect = true,
}: MarketplaceSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultQuery);
  const [selectedCategory, setSelectedCategory] = useState(defaultCategory);
  const [isOpen, setIsOpen] = useState(false);
  const [suggestedCategories, setSuggestedCategories] = useState<SearchCategoryItem[]>([]);
  const [suggestedProducts, setSuggestedProducts] = useState<SuggestedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const popoverId = useId();
  const inputId = useId();

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Fetch suggestions with debounce. Stale responses (from an older query) are ignored.
  useEffect(() => {
    if (query.trim().length < 2) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setSuggestedCategories(data.categories || []);
          setSuggestedProducts(data.products || []);
        }
      } catch {
        // Aborted or network error: keep the plain search form usable
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsOpen(false);
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (selectedCategory) params.set("category", selectedCategory);
    router.push(`/search?${params.toString()}`);
  };

  // Suggestions only apply to queries of 2+ characters; shorter input shows nothing
  const hasQuery = query.trim().length >= 2;
  const visibleCategories = hasQuery ? suggestedCategories : [];
  const visibleProducts = hasQuery ? suggestedProducts : [];
  const hasSuggestions = visibleCategories.length > 0 || visibleProducts.length > 0;
  const showLoading = hasQuery && isLoading;
  const popoverVisible = isOpen && (hasSuggestions || (hasQuery && !showLoading));

  return (
    <div ref={wrapperRef} className="relative w-full">
      <form
        role="search"
        action="/search"
        method="GET"
        onSubmit={handleSubmit}
        className="flex items-center w-full h-11 rounded-full border border-line bg-white pl-4 pr-1 transition-colors hover:border-mute-2 focus-within:border-ink"
      >
        <label htmlFor={inputId} className="sr-only">
          Search products and brands
        </label>
        <Search size={17} strokeWidth={1.7} className="text-ink flex-shrink-0" aria-hidden="true" />
        <input
          ref={inputRef}
          id={inputId}
          name="q"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search products and brands"
          className="flex-1 min-w-0 h-full bg-transparent pl-2.5 pr-1 text-[15px] text-ink placeholder:text-mute focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls={popoverVisible ? popoverId : undefined}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="size-9 rounded-full flex items-center justify-center text-mute hover:text-ink hover:bg-canvas flex-shrink-0"
            aria-label="Clear search"
          >
            <X size={15} aria-hidden="true" />
          </button>
        )}

        {showCategorySelect && categories.length > 0 && (
          <div className="hidden xl:flex items-center relative h-7 border-l border-line pl-1 flex-shrink-0">
            <select
              name="category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="appearance-none bg-transparent h-full max-w-[140px] truncate pl-2 pr-6 text-[13px] text-mute hover:text-ink cursor-pointer focus:outline-none focus-visible:text-ink"
              aria-label="Search in category"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-1.5 text-mute pointer-events-none" aria-hidden="true" />
          </div>
        )}

        <button
          type="submit"
          className="ml-1 h-9 px-4 rounded-full bg-ink text-white text-[13px] font-medium hover:bg-ink-2 transition-colors flex-shrink-0"
        >
          Search
        </button>
      </form>

      {/* Live suggestions */}
      {popoverVisible && (
        <div
          id={popoverId}
          aria-label="Search suggestions"
          role="region"
          className="absolute top-full left-0 right-0 mt-2 bg-white rounded-[20px] border border-line-soft shadow-[0_24px_48px_-24px_rgba(14,14,13,0.35)] overflow-hidden z-50 max-h-[26rem] overflow-y-auto"
        >
          {visibleCategories.length > 0 && (
            <div className="p-2 border-b border-line-soft">
              <p className="px-3 pt-2 pb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-mute">Categories</p>
              {visibleCategories.map((c) => (
                <Link
                  key={c.id}
                  href={`/categories/${c.slug}`}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-between gap-3 px-3 min-h-[40px] rounded-xl text-sm text-ink hover:bg-canvas transition-colors"
                >
                  <span className="truncate">{c.name}</span>
                  <ArrowRight size={14} className="text-mute flex-shrink-0" aria-hidden="true" />
                </Link>
              ))}
            </div>
          )}

          {visibleProducts.length > 0 && (
            <div className="p-2">
              <p className="px-3 pt-2 pb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-mute">Products</p>
              {visibleProducts.map((p) => (
                <Link
                  key={p.id}
                  href={`/products/${p.slug}`}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-canvas transition-colors"
                >
                  <span className="size-11 rounded-lg bg-sand overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {p.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element -- tiny suggestion thumbnail from arbitrary upload hosts
                      <img src={p.thumbnail} alt="" width={44} height={44} className="w-full h-full object-cover" />
                    ) : (
                      <Package size={16} className="text-mute" aria-hidden="true" />
                    )}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-ink truncate">{p.title}</span>
                    <span className="block text-xs text-mute truncate">{p.categoryName}</span>
                  </span>
                  <span className="font-mono text-[13px] text-ink whitespace-nowrap flex-shrink-0">
                    {formatCurrency(p.priceMinor)}
                  </span>
                </Link>
              ))}
            </div>
          )}

          {!hasSuggestions && !showLoading && hasQuery && (
            <p className="px-5 py-6 text-center text-sm text-mute">
              No quick matches for &ldquo;{query.trim()}&rdquo;. Press Enter to search the whole catalogue.
            </p>
          )}

          {query.trim() && (
            <div className="p-2 border-t border-line-soft">
              <button
                type="button"
                onClick={handleSubmit}
                className="w-full min-h-[40px] rounded-xl text-sm font-medium text-ink hover:bg-canvas flex items-center justify-center gap-1.5"
              >
                <span className="truncate">See all results for &ldquo;{query.trim()}&rdquo;</span>
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Header search that steps aside on the homepage, where the hero already has
 * the large search form (used for the mobile header row).
 */
export function HeaderSearchOutsideHome(props: MarketplaceSearchProps & { className?: string }) {
  const pathname = usePathname();
  if (pathname === "/") return null;
  const { className = "", ...rest } = props;
  return (
    <div className={className}>
      <MarketplaceSearch {...rest} />
    </div>
  );
}
