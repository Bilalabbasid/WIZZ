"use client";

import React, { useId, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HomeProductTile, type HomeTileProduct } from "./home-product-tile";

export interface JustListedCategory {
  slug: string;
  name: string;
}

type SortKey = "newest" | "price_asc" | "price_desc";

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

const ALL = "";
const PAGE_SIZE = 18;

/**
 * "Just listed" on the homepage: the newest public products (ordered newest first by the
 * server), filtered by category pills and re-sorted on the client. Shows 18 at a time.
 */
export function HomeJustListed({
  products,
  categories,
}: {
  products: HomeTileProduct[];
  categories: JustListedCategory[];
}) {
  const [category, setCategory] = useState<string>(ALL);
  const [sort, setSort] = useState<SortKey>("newest");
  const [shown, setShown] = useState(PAGE_SIZE);
  const sortId = useId();
  const headingId = useId();

  const filtered = useMemo(() => {
    const list = category === ALL ? products : products.filter((p) => p.categorySlug === category);
    if (sort === "newest") return list;
    // Unpriced (unavailable) products always go last
    const price = (p: HomeTileProduct, fallback: number) => p.priceMinor ?? fallback;
    return [...list].sort((a, b) =>
      sort === "price_asc"
        ? price(a, Number.POSITIVE_INFINITY) - price(b, Number.POSITIVE_INFINITY)
        : price(b, Number.NEGATIVE_INFINITY) - price(a, Number.NEGATIVE_INFINITY)
    );
  }, [products, category, sort]);

  const visible = filtered.slice(0, shown);
  const hasMore = filtered.length > shown;
  const activeCategory = categories.find((c) => c.slug === category);

  const pick = (value: string) => {
    setCategory(value);
    setShown(PAGE_SIZE);
  };

  const pill = (value: string, label: string) => {
    const on = category === value;
    return (
      <button
        key={value || "all"}
        type="button"
        aria-pressed={on}
        onClick={() => pick(value)}
        className={`flex-none snap-start h-10 px-4 rounded-full border text-[13px] font-medium whitespace-nowrap transition-colors ${
          on ? "bg-ink border-ink text-white" : "bg-white border-line text-ink hover:border-ink"
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={headingId} className="text-[22px] md:text-2xl font-semibold leading-tight tracking-[-0.03em] text-ink">
          Just listed
        </h2>
        <div className="flex items-center gap-2">
          <label htmlFor={sortId} className="text-[13px] text-mute">
            Sort
          </label>
          <select
            id={sortId}
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as SortKey);
              setShown(PAGE_SIZE);
            }}
            className="h-10 rounded-full border border-line bg-white pl-4 pr-3 text-[13px] text-ink hover:border-ink cursor-pointer"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {categories.length > 0 && (
        <div
          role="group"
          aria-label="Filter by category"
          className="flex gap-2 overflow-x-auto no-scrollbar snap-x -mx-5 px-5 md:mx-0 md:px-0 md:flex-wrap md:overflow-visible"
        >
          {pill(ALL, "All")}
          {categories.map((c) => pill(c.slug, c.name))}
        </div>
      )}

      {products.length === 0 ? (
        <p className="py-12 text-center text-[15px] text-mute">No products are listed yet. Check back soon.</p>
      ) : visible.length > 0 ? (
        <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-x-3 gap-y-6 md:gap-x-4">
          {visible.map((p, i) => (
            <li key={p.id} className="min-w-0">
              <HomeProductTile product={p} eager={i < 6} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-12 text-center text-[15px] text-mute">Nothing in this category yet.</p>
      )}

      <div className="flex flex-wrap justify-center gap-3 pt-2">
        {hasMore ? (
          <button
            type="button"
            onClick={() => setShown((n) => n + PAGE_SIZE)}
            className="inline-flex items-center h-11 px-6 rounded-full border border-ink text-ink text-sm font-medium hover:bg-white"
          >
            Load more
          </button>
        ) : (
          <Link
            href={activeCategory ? `/categories/${activeCategory.slug}` : "/products"}
            className="inline-flex items-center gap-2 h-11 px-6 rounded-full border border-ink text-ink text-sm font-medium hover:bg-white"
          >
            {activeCategory ? `All of ${activeCategory.name}` : "Browse all products"}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        )}
      </div>
    </section>
  );
}
