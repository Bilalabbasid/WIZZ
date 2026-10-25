"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, ChevronDown, X, ArrowRight, Tag, Package } from "lucide-react";
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
}

export function MarketplaceSearch({
  categories,
  defaultCategory = "",
  defaultQuery = "",
}: MarketplaceSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultQuery);
  const [selectedCategory, setSelectedCategory] = useState(defaultCategory);
  const [isOpen, setIsOpen] = useState(false);
  const [suggestedCategories, setSuggestedCategories] = useState<SearchCategoryItem[]>([]);
  const [suggestedProducts, setSuggestedProducts] = useState<SuggestedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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

  // Fetch suggestions with debounce
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setSuggestedCategories([]);
      setSuggestedProducts([]);
      setIsLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestedCategories(data.categories || []);
          setSuggestedProducts(data.products || []);
        }
      } catch {
        // Ignore fetch errors
      } finally {
        setIsLoading(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsOpen(false);
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (selectedCategory) params.set("category", selectedCategory);
    router.push(`/search?${params.toString()}`);
  };

  const hasSuggestions = suggestedCategories.length > 0 || suggestedProducts.length > 0;

  return (
    <div ref={wrapperRef} className="relative w-full">
      <form
        onSubmit={handleSubmit}
        className="flex items-stretch w-full h-11 rounded-lg border-2 border-transparent focus-within:border-orange-400 transition-colors bg-white overflow-hidden"
      >
        {/* Category Dropdown (Desktop) */}
        <div className="hidden md:flex items-center relative border-r border-slate-200 bg-slate-100 hover:bg-slate-200/70 transition-colors">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="appearance-none bg-transparent h-full max-w-[150px] truncate pl-3 pr-7 text-xs font-semibold text-slate-700 cursor-pointer focus:outline-none"
            aria-label="Filter by department"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <ChevronDown
            size={12}
            className="absolute right-2 text-slate-400 pointer-events-none"
          />
        </div>

        {/* Input */}
        <div className="relative flex-1 flex items-center">
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Search products and brands"
            className="w-full h-full pl-3.5 pr-8 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none font-medium [&::-webkit-search-cancel-button]:hidden"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={isOpen && hasSuggestions}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5"
              aria-label="Clear search input"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Search Submit Button */}
        <button
          type="submit"
          className="bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white w-12 sm:w-14 flex items-center justify-center transition-colors flex-shrink-0"
          aria-label="Submit search"
        >
          <Search size={18} />
        </button>
      </form>

      {/* Live Auto-Suggest Popover */}
      {isOpen && (hasSuggestions || (query.length >= 2 && !isLoading)) && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden z-50 divide-y divide-slate-100 max-h-96 overflow-y-auto animate-in fade-in-50 duration-100">
          {/* Matched Categories */}
          {suggestedCategories.length > 0 && (
            <div className="p-2.5 bg-slate-50/70">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 block mb-1">
                Matching Categories
              </span>
              <div className="space-y-0.5">
                {suggestedCategories.map((c) => (
                  <Link
                    key={c.id}
                    href={`/categories/${c.slug}`}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <Tag size={13} className="text-emerald-600" />
                      {c.name}
                    </span>
                    <ArrowRight size={12} className="text-slate-400" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Matched Products */}
          {suggestedProducts.length > 0 && (
            <div className="p-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 block mb-1">
                Suggested Products
              </span>
              <div className="divide-y divide-slate-100">
                {suggestedProducts.map((p) => (
                  <Link
                    key={p.id}
                    href={`/products/${p.slug}`}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200/80 overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {p.thumbnail ? (
                        <img
                          src={p.thumbnail}
                          alt={p.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package size={16} className="text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-600 truncate transition-colors">
                        {p.title}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        in <span className="text-slate-600 font-medium">{p.categoryName}</span>
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-xs font-extrabold text-slate-900 block">
                        {formatCurrency(p.priceMinor)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* View All Action */}
          {query.trim() && (
            <div className="p-2 bg-slate-50">
              <button
                type="button"
                onClick={handleSubmit}
                className="w-full text-center text-xs font-bold text-emerald-700 hover:text-emerald-800 py-1.5 flex items-center justify-center gap-1.5"
              >
                <span>See all results for "{query}"</span>
                <ArrowRight size={13} />
              </button>
            </div>
          )}

          {/* Empty State */}
          {!hasSuggestions && !isLoading && query.length >= 2 && (
            <div className="p-6 text-center text-slate-500 text-xs">
              No immediate matches found for "{query}". Press Enter to perform full catalog search.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
