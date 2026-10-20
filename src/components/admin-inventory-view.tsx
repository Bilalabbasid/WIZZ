"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/formatters";
import { Boxes, Plus, Minus, AlertCircle, CheckCircle2, History } from "lucide-react";

export interface VariantInventoryItem {
  id: string;
  sku: string;
  title: string;
  product: { title: string; sellerOrgId: string };
  inventoryLevel?: {
    availableUnits: number;
    reservedUnits: number;
    safetyStock: number;
    lowStockThreshold: number;
  } | null;
}

export interface AdjustmentLogItem {
  id: string;
  deltaUnits: number;
  balanceAfter: number;
  reasonCode: string;
  notes?: string | null;
  createdAt: Date | string;
  variant: { sku: string; title: string };
}

export function AdminInventoryView({
  variants,
  recentAdjustments,
}: {
  variants: VariantInventoryItem[];
  recentAdjustments: AdjustmentLogItem[];
}) {
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [deltaUnits, setDeltaUnits] = useState<number>(10);
  const [reasonCode, setReasonCode] = useState<string>("RECEIVING");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedVariant = variants.find((v) => v.id === selectedVariantId);

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVariant) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/admin/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId: selectedVariant.id,
          sellerOrgId: selectedVariant.product.sellerOrgId,
          deltaUnits: Number(deltaUnits),
          reasonCode,
          notes: notes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to adjust inventory.");

      window.location.reload();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Error adjusting stock");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Stock Balances Table */}
      <div className="bg-slate-800/80 rounded-3xl border border-slate-700/80 p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-700">
          <h3 className="font-bold text-sm text-white">
            Current Variant Stock Balances ({variants.length})
          </h3>
          <p className="text-[11px] text-slate-400">
            Atomic row-level tracking • Concurrency-safe checkout hold
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-700">
              <tr>
                <th className="pb-3">Product & Variant</th>
                <th className="pb-3">SKU</th>
                <th className="pb-3 text-center">Available Units</th>
                <th className="pb-3 text-center">Checkout Reserved</th>
                <th className="pb-3 text-center">Net Sellable</th>
                <th className="pb-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {variants.map((v) => {
                const avail = v.inventoryLevel?.availableUnits || 0;
                const reserved = v.inventoryLevel?.reservedUnits || 0;
                const net = Math.max(0, avail - reserved);
                const isLow = net <= (v.inventoryLevel?.lowStockThreshold || 5);

                return (
                  <tr key={v.id} className="hover:bg-slate-700/30">
                    <td className="py-3.5 pr-4">
                      <span className="font-bold text-white block">{v.product.title}</span>
                      <span className="text-slate-400 text-[11px]">{v.title}</span>
                    </td>
                    <td className="py-3.5 font-mono text-indigo-300">{v.sku}</td>
                    <td className="py-3.5 text-center font-bold text-white">{avail}</td>
                    <td className="py-3.5 text-center text-amber-400 font-semibold">{reserved}</td>
                    <td className="py-3.5 text-center">
                      <Badge variant={net === 0 ? "danger" : isLow ? "warning" : "success"} size="sm">
                        {net} units
                      </Badge>
                    </td>
                    <td className="py-3.5 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setSelectedVariantId(v.id);
                          setShowAdjustModal(true);
                        }}
                      >
                        Adjust Stock
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Inventory Adjustment Logs */}
      <div className="bg-slate-800/80 rounded-3xl border border-slate-700/80 p-6 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-700">
          <History size={16} className="text-indigo-400" />
          <h3 className="font-bold text-sm text-white">Stock Adjustment Audit Log</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-700">
              <tr>
                <th className="pb-3">Timestamp</th>
                <th className="pb-3">SKU</th>
                <th className="pb-3">Adjustment Delta</th>
                <th className="pb-3">Balance After</th>
                <th className="pb-3">Reason Code</th>
                <th className="pb-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {recentAdjustments.map((adj) => (
                <tr key={adj.id}>
                  <td className="py-3 text-slate-400">{formatDateTime(adj.createdAt)}</td>
                  <td className="py-3 font-mono text-white">{adj.variant.sku}</td>
                  <td className="py-3 font-bold">
                    <span className={adj.deltaUnits > 0 ? "text-emerald-400" : "text-rose-400"}>
                      {adj.deltaUnits > 0 ? `+${adj.deltaUnits}` : adj.deltaUnits}
                    </span>
                  </td>
                  <td className="py-3 text-white font-semibold">{adj.balanceAfter}</td>
                  <td className="py-3">
                    <Badge variant="neutral" size="sm">
                      {adj.reasonCode}
                    </Badge>
                  </td>
                  <td className="py-3 text-slate-400 truncate max-w-xs">{adj.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust Stock Modal */}
      {showAdjustModal && selectedVariant && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl border border-slate-700 max-w-md w-full p-6 space-y-4 text-slate-100 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base text-white">Manual Stock Adjustment</h3>
              <button
                type="button"
                onClick={() => setShowAdjustModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Target SKU: <strong className="text-white">{selectedVariant.sku}</strong> (
              {selectedVariant.product.title})
            </p>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleAdjustStock} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold uppercase text-[10px]">
                  Delta Units (Use positive to add, negative to decrement)
                </label>
                <input
                  type="number"
                  required
                  value={deltaUnits}
                  onChange={(e) => setDeltaUnits(Number(e.target.value))}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 p-2.5 text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold uppercase text-[10px]">
                  Reason Code
                </label>
                <select
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value)}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 p-2.5 text-white"
                >
                  <option value="RECEIVING">RECEIVING (Warehouse Inbound)</option>
                  <option value="CYCLE_COUNT">CYCLE_COUNT (Physical Audit Correction)</option>
                  <option value="DAMAGE">DAMAGE (Scrapped or Expired)</option>
                  <option value="ADMIN_OVERRIDE">ADMIN_OVERRIDE (Emergency Override)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold uppercase text-[10px]">
                  Audit Notes / Reason Explanation
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Inbound PO #8892 received from factory..."
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 p-2.5 text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdjustModal(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" isLoading={isSubmitting}>
                  Execute Stock Adjustment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
