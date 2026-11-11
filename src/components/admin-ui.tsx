import Link from "next/link";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";

/* Shared, server-safe building blocks for the dark admin console. */

export function AdminPageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div>
        <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">{eyebrow}</span>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1">{title}</h1>
        {description && <p className="text-xs text-slate-400 mt-1 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export type AdminTone = "success" | "warning" | "danger" | "info" | "neutral" | "accent";

const TONE_CLASSES: Record<AdminTone, string> = {
  success: "bg-emerald-950/60 text-emerald-300 border-emerald-800/60",
  warning: "bg-amber-950/60 text-amber-300 border-amber-800/60",
  danger: "bg-rose-950/60 text-rose-300 border-rose-800/60",
  info: "bg-sky-950/60 text-sky-300 border-sky-800/60",
  neutral: "bg-slate-800 text-slate-300 border-slate-700",
  accent: "bg-brand-950/60 text-brand-300 border-brand-800/60",
};

export function sellerStatusTone(status: string): AdminTone {
  if (status === "ACTIVE") return "success";
  if (status === "SUSPENDED") return "danger";
  if (status === "CLOSED") return "neutral";
  return "warning";
}

export function AdminBadge({ tone = "neutral", children }: { tone?: AdminTone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${TONE_CLASSES[tone]}`}>
      {children}
    </span>
  );
}

export function AdminEmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="text-center py-14 px-4 bg-slate-950/60 rounded-2xl border border-slate-800">
      <Inbox className="mx-auto text-slate-500 mb-3" size={28} aria-hidden="true" />
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
    </div>
  );
}

/** Builds a URL for the same page with updated query params (empty values removed). */
export function buildHref(basePath: string, params: Record<string, string | number | undefined | null>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v) !== "") qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${basePath}?${s}` : basePath;
}

export function AdminPagination({
  basePath,
  page,
  pageSize,
  total,
  params,
}: {
  basePath: string;
  page: number;
  pageSize: number;
  total: number;
  params: Record<string, string | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const linkCls =
    "inline-flex items-center gap-1 px-3 py-2 min-h-10 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400";
  const disabledCls = "inline-flex items-center gap-1 px-3 py-2 min-h-10 rounded-lg text-xs font-semibold bg-slate-900 text-slate-600 cursor-not-allowed";
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
      <span>
        Showing <strong className="text-slate-200">{from}</strong>–<strong className="text-slate-200">{to}</strong> of{" "}
        <strong className="text-slate-200">{total.toLocaleString("en-PK")}</strong>
      </span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link className={linkCls} href={buildHref(basePath, { ...params, page: page - 1 })} rel="prev">
            <ChevronLeft size={14} aria-hidden="true" /> Previous
          </Link>
        ) : (
          <span className={disabledCls} aria-disabled="true">
            <ChevronLeft size={14} aria-hidden="true" /> Previous
          </span>
        )}
        <span>
          Page {page} of {totalPages}
        </span>
        {page < totalPages ? (
          <Link className={linkCls} href={buildHref(basePath, { ...params, page: page + 1 })} rel="next">
            Next <ChevronRight size={14} aria-hidden="true" />
          </Link>
        ) : (
          <span className={disabledCls} aria-disabled="true">
            Next <ChevronRight size={14} aria-hidden="true" />
          </span>
        )}
      </div>
    </nav>
  );
}

export const adminInputCls =
  "w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 min-h-10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60";
export const adminLabelCls = "block text-[11px] font-bold text-slate-300 mb-1";
export const adminCardCls = "bg-slate-800/80 rounded-2xl border border-slate-700/80";
export const adminPrimaryBtn =
  "inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-10 rounded-lg text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300";
export const adminSecondaryBtn =
  "inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-10 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400";
export const adminDangerBtn =
  "inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-10 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300";

/** Search + optional select filter form that submits as a plain GET (works without JS). */
export function AdminFilterBar({
  basePath,
  q,
  placeholder,
  selectName,
  selectValue,
  selectOptions,
  selectLabel,
}: {
  basePath: string;
  q?: string;
  placeholder: string;
  selectName?: string;
  selectValue?: string;
  selectOptions?: Array<{ value: string; label: string }>;
  selectLabel?: string;
}) {
  return (
    <form method="get" action={basePath} className="flex flex-col sm:flex-row gap-2 sm:items-end" role="search">
      <div className="flex-1">
        <label htmlFor="admin-q" className={adminLabelCls}>
          Search
        </label>
        <input id="admin-q" name="q" type="search" defaultValue={q} placeholder={placeholder} className={adminInputCls} maxLength={120} />
      </div>
      {selectName && selectOptions && (
        <div className="sm:w-52">
          <label htmlFor="admin-select" className={adminLabelCls}>
            {selectLabel}
          </label>
          <select id="admin-select" name={selectName} defaultValue={selectValue ?? ""} className={adminInputCls}>
            {selectOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <button type="submit" className={adminPrimaryBtn}>
        Apply
      </button>
    </form>
  );
}
