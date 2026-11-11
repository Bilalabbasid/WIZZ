import React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, X } from "lucide-react";

/**
 * Shared building blocks for the catalog pages (listing, search, category,
 * product, wishlist). Server-safe: no hooks, no browser APIs, so both server
 * pages and client components can import the class constants.
 */

/** Visible ink focus ring used across catalog controls. */
export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

/** Page container: 1360px max, 20px gutters on mobile, 40px from sm up. */
export const CATALOG_CONTAINER = "mx-auto w-full max-w-[1360px] px-5 sm:px-10";

/** Product grid: 2 / 3 / 4 columns, 32px row gap, 20px column gap (12px on phones). */
export const CATALOG_GRID = "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-3 sm:gap-x-5 gap-y-8";

/** Small mono uppercase label (eyebrows, <dt>, card tags). */
export const MONO_LABEL = "font-mono text-[11px] uppercase tracking-[0.06em]";

/** 44px outline pill used for secondary links and chips. */
export const PILL_OUTLINE = `inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line bg-white px-[18px] text-sm font-medium text-ink transition-colors hover:border-ink ${FOCUS_RING}`;

/** 44px ink pill used for primary links. */
export const PILL_INK = `inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-white transition-colors hover:bg-ink-2 ${FOCUS_RING}`;

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/** Mono breadcrumb (Home / Category / Item). The last item is the current page. */
export function CatalogBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="font-mono text-xs text-mute">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex min-w-0 items-center gap-2">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className={`rounded-sm text-mute underline-offset-4 hover:text-ink hover:underline ${FOCUS_RING}`}
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isLast ? "page" : undefined} className="max-w-[60vw] truncate text-ink sm:max-w-md">
                  {item.label}
                </span>
              )}
              {!isLast && <span aria-hidden="true">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Listing page header: breadcrumb, oversized title, result count and a slot for sort/filter controls. */
export function CatalogPageHeader({
  breadcrumb,
  eyebrow,
  title,
  subtitle,
  description,
  actions,
}: {
  breadcrumb: BreadcrumbItem[];
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="space-y-6 pt-4">
      <CatalogBreadcrumb items={breadcrumb} />
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="min-w-0 max-w-3xl space-y-3">
          {eyebrow && <p className={`${MONO_LABEL} text-mute`}>{eyebrow}</p>}
          <h1 className="break-words text-[clamp(32px,4.5vw,56px)] font-semibold leading-[0.98] tracking-[-0.045em] text-ink">
            {title}
          </h1>
          {subtitle && <p className="text-[15px] text-mute">{subtitle}</p>}
          {description && <div className="max-w-2xl text-[15px] leading-relaxed text-ink-2">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export interface ActiveFilterChip {
  key: string;
  label: string;
  /** URL with this filter removed. */
  removeHref: string;
}

/** Removable chips for the filters currently applied, plus "Clear all". */
export function CatalogActiveFilters({ chips, clearHref }: { chips: ActiveFilterChip[]; clearHref: string }) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Active filters" role="group">
      {chips.map((chip) => (
        <Link
          key={chip.key}
          href={chip.removeHref}
          className={`inline-flex min-h-11 items-center gap-2 rounded-full border border-ink bg-white pl-4 pr-3 text-[13px] font-medium text-ink transition-colors hover:bg-canvas ${FOCUS_RING}`}
        >
          <span className="max-w-[220px] truncate">{chip.label}</span>
          <X size={14} aria-hidden="true" />
          <span className="sr-only">(remove filter)</span>
        </Link>
      ))}
      <Link
        href={clearHref}
        className={`inline-flex min-h-11 items-center rounded-full px-3 text-[13px] font-medium text-ink underline underline-offset-4 hover:text-ink-2 ${FOCUS_RING}`}
      >
        Clear all
      </Link>
    </div>
  );
}

/** Pill pagination. Page numbers collapse to "Page x of y" on phones. */
export function CatalogPagination({
  page,
  totalPages,
  hrefForPage,
  totalLabel,
}: {
  page: number;
  totalPages: number;
  hrefForPage: (page: number) => string;
  totalLabel?: string;
}) {
  if (totalPages <= 1) return null;

  const pages: Array<number | "gap"> = [];
  for (let p = 1; p <= totalPages; p++) {
    const near = Math.abs(p - page) <= 1;
    if (p === 1 || p === totalPages || near || totalPages <= 7) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== "gap") {
      pages.push("gap");
    }
  }

  const stepBase = `inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-medium`;

  return (
    <nav aria-label="Pagination" className="flex flex-col items-center gap-4 border-t border-line pt-8 sm:flex-row sm:justify-between">
      <p className="font-mono text-xs text-mute">
        Page {page} of {totalPages}
        {totalLabel ? ` · ${totalLabel}` : ""}
      </p>
      <div className="flex items-center gap-1.5">
        {page > 1 ? (
          <Link href={hrefForPage(page - 1)} rel="prev" className={`${stepBase} border border-line bg-white text-ink hover:border-ink ${FOCUS_RING}`}>
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Previous</span>
          </Link>
        ) : (
          <span aria-disabled="true" className={`${stepBase} border border-line-soft text-mute-2`}>
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Previous</span>
          </span>
        )}

        <ol className="hidden items-center gap-1.5 sm:flex">
          {pages.map((p, i) =>
            p === "gap" ? (
              <li key={`gap-${i}`} aria-hidden="true" className="px-1 font-mono text-sm text-mute">
                …
              </li>
            ) : (
              <li key={p}>
                <Link
                  href={hrefForPage(p)}
                  aria-current={p === page ? "page" : undefined}
                  aria-label={`Page ${p}`}
                  className={`inline-flex h-11 min-w-11 items-center justify-center rounded-full px-3 font-mono text-sm transition-colors ${FOCUS_RING} ${
                    p === page ? "bg-ink text-white" : "border border-line bg-white text-ink hover:border-ink"
                  }`}
                >
                  {p}
                </Link>
              </li>
            )
          )}
        </ol>

        {page < totalPages ? (
          <Link href={hrefForPage(page + 1)} rel="next" className={`${stepBase} border border-line bg-white text-ink hover:border-ink ${FOCUS_RING}`}>
            <span>Next</span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        ) : (
          <span aria-disabled="true" className={`${stepBase} border border-line-soft text-mute-2`}>
            <span>Next</span>
            <ArrowRight size={16} aria-hidden="true" />
          </span>
        )}
      </div>
    </nav>
  );
}

/** Empty / no-results block in the system style (white surface, hairline, 28px radius). */
export function CatalogEmptyState({
  icon,
  title,
  children,
  actions,
}: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-line-soft bg-white px-6 py-14 text-center">
      {icon && (
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-canvas text-ink" aria-hidden="true">
          {icon}
        </div>
      )}
      <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-ink">{title}</h2>
      {children && <div className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-mute">{children}</div>}
      {actions && <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
    </div>
  );
}

/** Card skeleton with the same geometry as ProductCard (4:5 photo, title/price row, meta row). */
export function CatalogCardSkeleton() {
  return (
    <div className="flex flex-col gap-3.5" aria-hidden="true">
      <div className="aspect-[4/5] w-full rounded-[20px] bg-sand" />
      <div className="space-y-2 px-1">
        <div className="flex items-baseline justify-between gap-3">
          <div className="h-4 w-3/5 rounded-full bg-sand" />
          <div className="h-4 w-1/4 rounded-full bg-sand" />
        </div>
        <div className="flex justify-between gap-3">
          <div className="h-3 w-2/5 rounded-full bg-line-soft" />
          <div className="h-3 w-1/5 rounded-full bg-line-soft" />
        </div>
      </div>
    </div>
  );
}
