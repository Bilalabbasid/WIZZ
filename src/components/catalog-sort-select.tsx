"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { FOCUS_RING } from "./catalog-ui";

export const SORT_OPTIONS = [
  { id: "featured", label: "Featured" },
  { id: "newest", label: "Newest" },
  { id: "price_asc", label: "Price: low to high" },
  { id: "price_desc", label: "Price: high to low" },
  { id: "rating", label: "Top rated" },
] as const;

/**
 * Pill sort select. Changing it navigates client-side to the same listing with
 * the new sort (page reset to 1). Without JavaScript it falls back to a GET form
 * with an "Apply" button, carrying the other filters as hidden fields.
 */
export function CatalogSortSelect({
  basePath,
  value,
  params,
  id = "catalog-sort",
}: {
  basePath: string;
  value?: string;
  /** The listing's other query params (sort and page are ignored). */
  params: Record<string, string | undefined>;
  id?: string;
}) {
  const router = useRouter();
  const current = value || "featured";

  const kept = Object.entries(params).filter(
    ([key, v]) => key !== "sort" && key !== "page" && typeof v === "string" && v !== ""
  ) as Array<[string, string]>;

  const hrefFor = (sort: string) => {
    const qs = new URLSearchParams(kept);
    if (sort && sort !== "featured") qs.set("sort", sort);
    const s = qs.toString();
    return `${basePath}${s ? `?${s}` : ""}`;
  };

  return (
    <form
      method="GET"
      action={basePath}
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        router.push(hrefFor(String(data.get("sort") || "")));
      }}
    >
      {kept.map(([key, v]) => (
        <input key={key} type="hidden" name={key} value={v} />
      ))}
      {/* Visible from sm up; on phones the select's own text ("Featured", …) carries the meaning */}
      <label htmlFor={id} className="sr-only text-[13px] text-mute sm:not-sr-only">
        Sort
      </label>
      <span className="relative inline-flex">
        <select
          id={id}
          name="sort"
          defaultValue={current}
          key={current}
          onChange={(e) => router.push(hrefFor(e.target.value))}
          className={`h-11 cursor-pointer appearance-none rounded-full border border-line bg-white pl-4 pr-10 text-sm text-ink transition-colors hover:border-ink ${FOCUS_RING}`}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink" />
      </span>
      <noscript>
        <button type="submit" className="h-11 rounded-full bg-ink px-4 text-sm font-medium text-white">
          Apply
        </button>
      </noscript>
    </form>
  );
}
