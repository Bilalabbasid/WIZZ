"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  PlusCircle,
  Search,
  Layers,
  Edit3,
  FileSpreadsheet,
  AlertCircle,
  Clock,
  ExternalLink,
  Archive,
  ChevronLeft,
  ChevronRight,
  Tag,
  Loader2,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatPkr } from "@/lib/formatters";
import { SellerCsvImporter } from "@/components/seller-csv-importer";

/* eslint-disable @typescript-eslint/no-explicit-any */

type View = "all" | "live" | "review" | "attention" | "draft" | "offline" | "archived";

const TABS: Array<{ id: View; label: string }> = [
  { id: "all", label: "All" },
  { id: "live", label: "Live" },
  { id: "review", label: "In review" },
  { id: "attention", label: "Needs changes" },
  { id: "draft", label: "Drafts" },
  { id: "offline", label: "Offline" },
  { id: "archived", label: "Archived" },
];

const PAGE_SIZE = 20;

/** The seller's regular price/"was" price, even while a deal is live. */
const regularPrice = (v: any): number => v.dealRegularPriceMinor ?? v.priceMinor;
const regularCompareAt = (v: any): number | null =>
  v.dealRegularPriceMinor != null ? v.dealRegularCompareAtMinor : v.compareAtPriceMinor;

function dealBadge(variants: any[]) {
  const now = Date.now();
  if (variants.some((v) => v.dealRegularPriceMinor != null)) return "live" as const;
  if (variants.some((v) => v.dealPriceMinor != null && v.dealStartsAt && new Date(v.dealStartsAt).getTime() > now))
    return "scheduled" as const;
  return null;
}

function listingState(p: any): { label: string; variant: "success" | "warning" | "danger" | "neutral" } {
  if (p.status === "ARCHIVED") return { label: "Archived", variant: "neutral" };
  if (p.status === "PUBLISHED") return { label: "Live", variant: "success" };
  if (p.isApprovedByPlatform) return { label: "Offline", variant: "neutral" };
  if (p.moderationStatus === "PENDING_REVIEW") return { label: "In review", variant: "warning" };
  if (p.moderationStatus === "CHANGES_REQUESTED") return { label: "Changes requested", variant: "warning" };
  if (p.moderationStatus === "REJECTED") return { label: "Rejected", variant: "danger" };
  return { label: "Draft", variant: "neutral" };
}

interface QuickEditRow {
  variantId: string;
  title: string;
  sku: string;
  price: string;
  compareAt: string;
  stock: string;
  stockBaseline: number;
  reserved: number;
  isActive: boolean;
  dealLive: boolean;
}

export default function SellerProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [view, setView] = useState<View>("all");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRows, setEditRows] = useState<QuickEditRow[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    const url = new URL("/api/seller/products", window.location.origin);
    if (appliedSearch) url.searchParams.set("query", appliedSearch);
    if (view !== "all") url.searchParams.set("view", view);
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", String(PAGE_SIZE));
    const res = await fetch(url.toString());
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load products.");
    return data;
  }, [appliedSearch, view, page]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyResult = (data: any) => {
    setProducts(data.products || []);
    setTotal(data.total || 0);
    setCounts(data.counts || {});
    setLoadError(null);
  };

  /** Reload after a change (filters set isLoading in their event handlers). */
  const loadProducts = useCallback(async () => {
    try {
      applyResult(await fetchProducts());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load products.");
    } finally {
      setIsLoading(false);
    }
  }, [fetchProducts]);

  useEffect(() => {
    let cancelled = false;
    fetchProducts()
      .then((data) => {
        if (!cancelled) applyResult(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Could not load products.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchProducts]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setPage(1);
    setAppliedSearch(search.trim());
  };

  const goToPage = (n: number) => {
    setIsLoading(true);
    setPage(n);
  };

  const openQuickEdit = (p: any) => {
    setEditError(null);
    setNotice(null);
    setEditingId(p.id);
    setEditRows(
      (p.variants || [])
        .filter((v: any) => v.isActive)
        .map((v: any) => ({
          variantId: v.id,
          title: v.title,
          sku: v.sku,
          price: String(regularPrice(v) / 100),
          compareAt: regularCompareAt(v) ? String(regularCompareAt(v)! / 100) : "",
          stock: String(v.inventoryLevel?.availableUnits ?? 0),
          stockBaseline: v.inventoryLevel?.availableUnits ?? 0,
          reserved: v.inventoryLevel?.reservedUnits ?? 0,
          isActive: v.isActive,
          dealLive: v.dealRegularPriceMinor != null,
        }))
    );
  };

  const updateRow = (i: number, patch: Partial<QuickEditRow>) =>
    setEditRows((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const saveQuickEdit = async () => {
    setEditError(null);
    const updates = [];
    for (const r of editRows) {
      const price = Number(r.price);
      const compareAt = r.compareAt === "" ? null : Number(r.compareAt);
      const stock = Number(r.stock);
      if (!(price > 0)) return setEditError(`${r.sku}: price must be greater than zero.`);
      if (compareAt !== null && !(compareAt > price)) return setEditError(`${r.sku}: "Was" price must be higher than the price.`);
      if (!Number.isInteger(stock) || stock < 0) return setEditError(`${r.sku}: stock must be a whole number, 0 or more.`);
      if (stock < r.reserved) return setEditError(`${r.sku}: ${r.reserved} unit(s) are held in open checkouts; stock can't go below that.`);
      updates.push({
        variantId: r.variantId,
        priceMinor: Math.round(price * 100),
        compareAtPriceMinor: compareAt === null ? null : Math.round(compareAt * 100),
        stock,
        stockBaseline: r.stockBaseline,
        isActive: r.isActive,
      });
    }

    setIsSavingEdit(true);
    try {
      const res = await fetch("/api/seller/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save changes.");
      setEditingId(null);
      setNotice("Price and stock saved. Changes are live.");
      await loadProducts();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Could not save changes.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const archiveProduct = async (p: any) => {
    if (!window.confirm(`Archive "${p.title}"? It will be removed from the store. Order history is kept.`)) return;
    setNotice(null);
    try {
      const res = await fetch(`/api/seller/products/${p.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not archive product.");
      setNotice(`"${p.title}" archived.`);
      await loadProducts();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not archive product.");
    }
  };

  const renderQuickEdit = () => (
    <div className="bg-slate-50 border-t border-slate-200 px-4 md:px-6 py-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold text-slate-900">Quick edit price and stock</p>
        <p className="text-[11px] text-slate-500">Saved changes go live immediately.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="py-1.5 pr-3 font-semibold">Variant</th>
              <th className="py-1.5 pr-3 font-semibold">Price (Rs.)</th>
              <th className="py-1.5 pr-3 font-semibold">&ldquo;Was&rdquo; price (Rs.)</th>
              <th className="py-1.5 pr-3 font-semibold">Stock</th>
              <th className="py-1.5 font-semibold">Selling</th>
            </tr>
          </thead>
          <tbody>
            {editRows.map((r, i) => (
              <tr key={r.variantId} className="align-top">
                <td className="py-1.5 pr-3">
                  <span className="block font-semibold text-slate-800">{r.title}</span>
                  <span className="block font-mono text-[10px] text-slate-500">{r.sku}</span>
                  {r.dealLive && (
                    <span className="inline-block mt-0.5 text-[10px] font-bold text-orange-700">
                      Deal live: this edits the regular price
                    </span>
                  )}
                </td>
                <td className="py-1.5 pr-3">
                  <input
                    type="number"
                    min={1}
                    step="any"
                    aria-label={`Price for ${r.sku}`}
                    value={r.price}
                    onChange={(e) => updateRow(i, { price: e.target.value })}
                    className="w-28 rounded-lg border border-slate-300 p-1.5 bg-white font-bold"
                  />
                </td>
                <td className="py-1.5 pr-3">
                  <input
                    type="number"
                    min={1}
                    step="any"
                    placeholder="Optional"
                    aria-label={`Was price for ${r.sku}`}
                    value={r.compareAt}
                    onChange={(e) => updateRow(i, { compareAt: e.target.value })}
                    className="w-28 rounded-lg border border-slate-300 p-1.5 bg-white"
                  />
                </td>
                <td className="py-1.5 pr-3">
                  <input
                    type="number"
                    min={0}
                    aria-label={`Stock for ${r.sku}`}
                    value={r.stock}
                    onChange={(e) => updateRow(i, { stock: e.target.value })}
                    className="w-24 rounded-lg border border-slate-300 p-1.5 bg-white"
                  />
                  {r.reserved > 0 && <span className="block text-[10px] text-slate-500 mt-0.5">{r.reserved} in checkouts</span>}
                </td>
                <td className="py-1.5">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={r.isActive}
                      onChange={(e) => updateRow(i, { isActive: e.target.checked })}
                      className="w-4 h-4 accent-emerald-600"
                    />
                    <span className="text-slate-700">{r.isActive ? "On" : "Off"}</span>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editError && (
        <p role="alert" className="text-xs font-semibold text-rose-700 flex items-center gap-1.5">
          <AlertCircle size={14} /> {editError}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" onClick={saveQuickEdit} isLoading={isSavingEdit} disabled={isSavingEdit}>
          Save
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)} disabled={isSavingEdit}>
          Cancel
        </Button>
        <span className="text-[11px] text-slate-500 ml-1">
          Deals, photos and descriptions are edited on the full listing page.
        </span>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Products</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Add listings, update prices and stock, run deals, and track review status.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button type="button" variant="outline" size="sm" onClick={() => setIsCsvModalOpen(true)} className="text-xs font-bold">
            <FileSpreadsheet size={15} />
            <span>Import CSV</span>
          </Button>
          <Link
            href="/seller/portal/products/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-sm"
          >
            <PlusCircle size={15} />
            <span>Add product</span>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Product status" className="flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-slate-200">
        {TABS.map((tab) => {
          const active = view === tab.id;
          const count = counts[tab.id];
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => {
                if (tab.id !== view) setIsLoading(true);
                setView(tab.id);
                setPage(1);
                setEditingId(null);
              }}
              className={`relative px-3 py-2.5 text-xs font-bold whitespace-nowrap transition-colors ${
                active ? "text-emerald-800" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
              {typeof count === "number" && (
                <span
                  className={`ml-1.5 tabular-nums rounded-full px-1.5 py-0.5 text-[10px] ${
                    tab.id === "attention" && count > 0
                      ? "bg-amber-100 text-amber-800"
                      : active
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {count}
                </span>
              )}
              {active && <span className="absolute inset-x-2 -bottom-px h-0.5 bg-emerald-600 rounded-full" />}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 max-w-lg">
        <Input
          placeholder="Search by product name or SKU"
          aria-label="Search products"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button type="submit" size="sm" variant="secondary" aria-label="Search">
          <Search size={14} />
        </Button>
        {appliedSearch && (
          <button
            type="button"
            onClick={() => {
              setIsLoading(true);
              setSearch("");
              setAppliedSearch("");
              setPage(1);
            }}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 whitespace-nowrap"
          >
            Clear
          </button>
        )}
      </form>

      {notice && (
        <p role="status" className="text-xs font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          {notice}
        </p>
      )}
      {loadError && (
        <p role="alert" className="text-xs font-semibold text-rose-900 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <AlertCircle size={14} /> {loadError}
          <button
            type="button"
            onClick={() => {
              setIsLoading(true);
              loadProducts();
            }}
            className="ml-auto underline"
          >
            Retry
          </button>
        </p>
      )}

      {/* List */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" /> Loading products...
          </div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Layers size={36} className="mx-auto text-slate-300" />
            <h3 className="font-bold text-sm text-slate-700">
              {appliedSearch ? "No products match your search" : view === "all" ? "No products yet" : "Nothing here"}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {view === "all" && !appliedSearch
                ? "Add your first product, or import many at once from a CSV file."
                : "Try another tab or search term."}
            </p>
            {view === "all" && !appliedSearch && (
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsCsvModalOpen(true)} className="text-xs font-semibold">
                  <FileSpreadsheet size={14} />
                  <span>Import CSV</span>
                </Button>
                <Link
                  href="/seller/portal/products/new"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition"
                >
                  <PlusCircle size={14} />
                  <span>Add product</span>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            <li className="hidden lg:grid grid-cols-[minmax(0,1fr)_140px_70px_150px_210px] gap-4 px-6 py-2.5 bg-slate-50 text-[11px] font-bold text-slate-500">
              <span>Product</span>
              <span>Price</span>
              <span>Stock</span>
              <span>Status</span>
              <span className="text-right">Actions</span>
            </li>
            {products.map((p) => {
              const active = (p.variants || []).filter((v: any) => v.isActive);
              const prices = active.map((v: any) => v.priceMinor);
              const minPrice = prices.length ? Math.min(...prices) : 0;
              const maxPrice = prices.length ? Math.max(...prices) : 0;
              const sellable = active.reduce(
                (acc: number, v: any) =>
                  acc + Math.max(0, (v.inventoryLevel?.availableUnits || 0) - (v.inventoryLevel?.reservedUnits || 0)),
                0
              );
              const thumbnail = p.media?.find((m: any) => m.isThumbnail)?.url || p.media?.[0]?.url;
              const state = listingState(p);
              const deal = dealBadge(active);
              const isEditing = editingId === p.id;

              return (
                <li key={p.id}>
                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_140px_70px_150px_210px] gap-2 lg:gap-4 lg:items-center px-4 lg:px-6 py-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      {thumbnail ? (
                        <img src={thumbnail} alt="" className="w-12 h-12 rounded-lg object-cover border border-slate-200 bg-slate-50 shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                          <Layers size={18} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <Link href={`/seller/portal/products/${p.id}`} className="block font-bold text-sm text-slate-900 hover:text-emerald-800 line-clamp-1">
                          {p.title}
                        </Link>
                        <p className="text-[11px] text-slate-500 truncate">
                          {p.category?.name || "Uncategorised"}
                          {active.length > 1 ? `, ${active.length} variants` : active[0] ? `, SKU ${active[0].sku}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="text-xs">
                      <span className="lg:hidden text-slate-500 mr-1">Price:</span>
                      <span className="font-extrabold text-slate-900 tabular-nums">
                        {minPrice === maxPrice ? formatPkr(minPrice) : `${formatPkr(minPrice)} – ${formatPkr(maxPrice)}`}
                      </span>
                      {deal && (
                        <span
                          className={`ml-1.5 lg:ml-0 lg:mt-0.5 inline-flex lg:flex items-center gap-1 text-[10px] font-bold ${
                            deal === "live" ? "text-orange-700" : "text-slate-500"
                          }`}
                        >
                          <Tag size={10} /> {deal === "live" ? "Deal live" : "Deal scheduled"}
                        </span>
                      )}
                    </div>

                    <div className="text-xs">
                      <span className="lg:hidden text-slate-500 mr-1">Stock:</span>
                      <span
                        className={`font-bold tabular-nums ${
                          sellable === 0 ? "text-rose-600" : sellable <= 5 ? "text-amber-600" : "text-slate-800"
                        }`}
                      >
                        {sellable}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1">
                      <Badge variant={state.variant} size="sm">
                        {state.label}
                      </Badge>
                      {p.pendingChangesJson && p.moderationStatus === "PENDING_REVIEW" && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 inline-flex items-center gap-1">
                          <Clock size={10} /> Edits in review
                        </span>
                      )}
                      {p.isApprovedByPlatform && p.moderationStatus === "CHANGES_REQUESTED" && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Edits need changes</span>
                      )}
                    </div>

                    <div className="flex items-center lg:justify-end gap-1 flex-wrap">
                      {p.status !== "ARCHIVED" && active.length > 0 && (
                        <button
                          type="button"
                          onClick={() => (isEditing ? setEditingId(null) : openQuickEdit(p))}
                          aria-expanded={isEditing}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100"
                        >
                          <SlidersHorizontal size={13} /> Quick edit
                        </button>
                      )}
                      <Link
                        href={`/seller/portal/products/${p.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-emerald-700 hover:bg-emerald-50"
                      >
                        <Edit3 size={13} /> Edit
                      </Link>
                      {p.status === "PUBLISHED" && (
                        <a
                          href={`/products/${p.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                          aria-label={`View ${p.title} on the store`}
                          title="View on store"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                      {p.status !== "ARCHIVED" && (
                        <button
                          type="button"
                          onClick={() => archiveProduct(p)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          aria-label={`Archive ${p.title}`}
                          title="Archive"
                        >
                          <Archive size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  {isEditing && renderQuickEdit()}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <nav aria-label="Pagination" className="flex items-center justify-between text-xs text-slate-600">
          <span className="tabular-nums">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => goToPage(page - 1)} aria-label="Previous page">
              <ChevronLeft size={14} />
            </Button>
            <span className="px-2 tabular-nums">
              Page {page} of {totalPages}
            </span>
            <Button type="button" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => goToPage(page + 1)} aria-label="Next page">
              <ChevronRight size={14} />
            </Button>
          </div>
        </nav>
      )}

      <SellerCsvImporter
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        onSuccess={() => {
          setIsCsvModalOpen(false);
          loadProducts();
        }}
      />
    </div>
  );
}
