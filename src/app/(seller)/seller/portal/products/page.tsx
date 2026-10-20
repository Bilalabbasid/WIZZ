"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  PlusCircle,
  Search,
  Layers,
  Boxes,
  Tag,
  ExternalLink,
  Edit3,
  Trash2,
  FileSpreadsheet,
  AlertCircle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatPkr } from "@/lib/formatters";
import { SellerCsvImporter } from "@/components/seller-csv-importer";

export default function SellerProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);

  useEffect(() => {
    loadProducts();
  }, [statusFilter]);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const url = new URL("/api/seller/products", window.location.origin);
      if (search) url.searchParams.set("query", search);
      if (statusFilter) url.searchParams.set("status", statusFilter);

      const res = await fetch(url.toString());
      const data = await res.json();
      if (res.ok) {
        setProducts(data.products || []);
        setTotal(data.total || 0);
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadProducts();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Product Catalog
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your merchant SKUs, variant pricing, inventory, and media.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* CSV Import Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsCsvModalOpen(true)}
            className="text-xs font-bold"
          >
            <FileSpreadsheet size={15} />
            <span>Import CSV</span>
          </Button>

          <Link
            href="/seller/portal/products/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition shadow-sm"
          >
            <PlusCircle size={15} />
            <span>Add New Listing</span>
          </Link>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md flex items-center gap-2">
          <Input
            placeholder="Search by title, description, or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button type="submit" size="sm" variant="secondary">
            <Search size={14} />
          </Button>
        </form>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs rounded-xl border border-slate-200 p-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
          >
            <option value="">All Statuses ({total})</option>
            <option value="PUBLISHED">Published (Live)</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
      </div>

      {/* Catalog Table */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading listings...</div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Layers size={36} className="mx-auto text-slate-300" />
            <h3 className="font-bold text-sm text-slate-700">No products found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Create your first merchant product or adjust search filters to locate catalog listings.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCsvModalOpen(true)}
                className="text-xs font-semibold"
              >
                <FileSpreadsheet size={14} />
                <span>Bulk CSV Import</span>
              </Button>
              <Link
                href="/seller/portal/products/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition"
              >
                <PlusCircle size={14} />
                <span>Create Product</span>
              </Link>
            </div>
          </div>
        ) : (
          <div>
            {/* Mobile Cards (Viewports < md) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {products.map((p) => {
                const totalStock = p.variants?.reduce(
                  (acc: number, v: any) => acc + (v.inventoryLevel?.availableUnits || 0),
                  0
                );
                const minPrice = Math.min(...(p.variants?.map((v: any) => v.priceMinor) || [0]));
                const maxPrice = Math.max(...(p.variants?.map((v: any) => v.priceMinor) || [0]));
                const thumbnail = p.media?.[0]?.url;

                return (
                  <div key={p.id} className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      {thumbnail ? (
                        <img
                          src={thumbnail}
                          alt={p.title}
                          className="w-14 h-14 rounded-xl object-cover border border-slate-200 bg-slate-50 shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                          <Layers size={18} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-xs text-slate-900 line-clamp-1">{p.title}</h4>
                        <p className="text-[11px] text-slate-500">{p.category?.name || "General"}</p>
                        <p className="font-extrabold text-xs text-slate-900 mt-1">
                          {minPrice === maxPrice
                            ? formatPkr(minPrice)
                            : `${formatPkr(minPrice)} - ${formatPkr(maxPrice)}`}
                        </p>
                      </div>
                      <Badge
                        variant={
                          p.status === "PUBLISHED"
                            ? "success"
                            : p.status === "ARCHIVED"
                            ? "danger"
                            : "neutral"
                        }
                        size="sm"
                      >
                        {p.status}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                      <span className="text-[11px] text-slate-500">
                        Stock: <strong className={totalStock === 0 ? "text-rose-600" : "text-emerald-700"}>{totalStock} units</strong>
                      </span>
                      <Link
                        href={`/seller/portal/products/${p.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition"
                      >
                        <Edit3 size={12} />
                        <span>Edit Listing</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table (Viewports >= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-6">Product Item</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Variants</th>
                    <th className="py-3 px-4">Price Range</th>
                    <th className="py-3 px-4">Stock Balance</th>
                    <th className="py-3 px-4">Status & Moderation</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                {products.map((p) => {
                  const totalStock = p.variants?.reduce(
                    (acc: number, v: any) => acc + (v.inventoryLevel?.availableUnits || 0),
                    0
                  );
                  const minPrice = Math.min(...(p.variants?.map((v: any) => v.priceMinor) || [0]));
                  const maxPrice = Math.max(...(p.variants?.map((v: any) => v.priceMinor) || [0]));
                  const thumbnail = p.media?.[0]?.url || "/placeholder.png";
                  const hasStagedEdits = Boolean(p.pendingChangesJson);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <img
                            src={thumbnail}
                            alt={p.title}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-200 bg-slate-50 shrink-0"
                          />
                          <div>
                            <div className="font-bold text-slate-900 line-clamp-1">{p.title}</div>
                            <span className="text-[11px] text-slate-400 font-mono">
                              SKU: {p.variants?.[0]?.sku || "N/A"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 font-medium text-slate-600">
                        {p.category?.name || "General"}
                      </td>
                      <td className="py-4 px-4 font-semibold text-slate-700">
                        {p.variants?.length || 1} {p.variants?.length === 1 ? "variant" : "variants"}
                      </td>
                      <td className="py-4 px-4 font-bold text-slate-900">
                        {minPrice === maxPrice
                          ? formatPkr(minPrice)
                          : `${formatPkr(minPrice)} - ${formatPkr(maxPrice)}`}
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`font-bold ${
                            totalStock === 0
                              ? "text-rose-600"
                              : totalStock <= 5
                              ? "text-amber-600"
                              : "text-emerald-700"
                          }`}
                        >
                          {totalStock} units
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <Badge
                            variant={
                              p.status === "PUBLISHED"
                                ? "success"
                                : p.status === "ARCHIVED"
                                ? "danger"
                                : "neutral"
                            }
                            size="sm"
                          >
                            {p.status}
                          </Badge>

                          {hasStagedEdits && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 flex items-center gap-1">
                              <Clock size={10} /> Pending Revision
                            </span>
                          )}

                          {p.moderationStatus === "CHANGES_REQUESTED" && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 flex items-center gap-1">
                              <AlertCircle size={10} /> Changes Requested
                            </span>
                          )}

                          {p.moderationStatus === "REJECTED" && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                              Rejected
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <Link
                          href={`/seller/portal/products/${p.id}`}
                          className="inline-flex items-center gap-1 font-bold text-indigo-600 hover:text-indigo-800"
                        >
                          <Edit3 size={13} />
                          <span>Edit</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>

      {/* CSV Import Modal */}
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
