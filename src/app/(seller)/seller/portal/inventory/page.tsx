"use client";

import React, { useEffect, useState, use } from "react";
import { useSearchParams } from "next/navigation";
import {
  Boxes,
  AlertTriangle,
  Search,
  PlusCircle,
  MinusCircle,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function SellerInventoryPage() {
  const searchParams = useSearchParams();
  const initialLowStock = searchParams.get("lowStock") === "true";

  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [lowStockFilter, setLowStockFilter] = useState(initialLowStock);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Adjustment modal state
  const [selectedVariant, setSelectedVariant] = useState<any | null>(null);
  const [deltaUnits, setDeltaUnits] = useState<number>(5);
  const [reasonCode, setReasonCode] = useState<string>("RECEIVING");
  const [notes, setNotes] = useState<string>("");
  const [isAdjusting, setIsAdjusting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInventory();
  }, [lowStockFilter]);

  const loadInventory = async () => {
    setIsLoading(true);
    try {
      const url = new URL("/api/seller/inventory", window.location.origin);
      if (search) url.searchParams.set("query", search);
      if (lowStockFilter) url.searchParams.set("lowStock", "true");

      const res = await fetch(url.toString());
      const data = await res.json();
      if (res.ok) {
        setItems(data.items || []);
        setTotal(data.total || 0);
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVariant) return;
    setIsAdjusting(true);
    setError(null);
    setFeedback(null);

    try {
      const res = await fetch("/api/seller/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId: selectedVariant.variantId,
          deltaUnits: Number(deltaUnits),
          reasonCode,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to adjust inventory.");

      setFeedback(`Adjusted SKU "${selectedVariant.sku}" by ${deltaUnits > 0 ? "+" : ""}${deltaUnits} units.`);
      setSelectedVariant(null);
      setNotes("");
      loadInventory();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error adjusting inventory");
    } finally {
      setIsAdjusting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Inventory & Stock Balances
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor real-time warehouse stock, 15-minute checkout holds, and log inventory adjustments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={lowStockFilter ? "primary" : "outline"}
            onClick={() => setLowStockFilter(!lowStockFilter)}
          >
            <AlertTriangle size={14} />
            <span>Low Stock Filter</span>
          </Button>

          <Button size="sm" variant="ghost" onClick={loadInventory}>
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>

      {feedback && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{feedback}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading stock balances...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Boxes size={32} className="mx-auto text-slate-300" />
            <p className="text-xs text-slate-500">No inventory records matching current filter.</p>
          </div>
        ) : (
          <div>
            {/* Mobile Cards (Viewports < md) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {items.map((it) => (
                <div key={it.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold text-xs text-slate-900 block">{it.sku}</span>
                      <h4 className="font-semibold text-xs text-slate-800 mt-0.5">{it.productTitle}</h4>
                      <p className="text-[11px] text-slate-400">{it.variantTitle}</p>
                    </div>
                    <Badge
                      variant={
                        it.availableUnits === 0
                          ? "danger"
                          : it.isLowStock
                          ? "warning"
                          : "success"
                      }
                      size="sm"
                    >
                      {it.availableUnits === 0
                        ? "OUT OF STOCK"
                        : it.isLowStock
                        ? "LOW STOCK"
                        : "IN STOCK"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase font-bold">Available</span>
                      <span
                        className={`text-xs font-black ${
                          it.availableUnits === 0
                            ? "text-rose-600"
                            : it.isLowStock
                            ? "text-amber-600"
                            : "text-emerald-700"
                        }`}
                      >
                        {it.availableUnits}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase font-bold">Held</span>
                      <span className="text-xs font-bold text-slate-600 font-mono">
                        {it.reservedUnits || 0}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase font-bold">Threshold</span>
                      <span className="text-xs font-bold text-slate-600 font-mono">
                        {it.lowStockThreshold}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setSelectedVariant(it);
                        setDeltaUnits(10);
                        setReasonCode("RECEIVING");
                      }}
                      className="w-full sm:w-auto"
                    >
                      <span>Adjust Stock</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table (Viewports >= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-6">Variant SKU</th>
                    <th className="py-3 px-4">Product Title</th>
                    <th className="py-3 px-4">Available Units</th>
                    <th className="py-3 px-4">Active Holds</th>
                    <th className="py-3 px-4">Threshold</th>
                    <th className="py-3 px-4">Stock Health</th>
                    <th className="py-3 px-6 text-right">Stock Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {items.map((it) => (
                    <tr key={it.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-4 px-6 font-mono font-bold text-slate-900">
                        {it.sku}
                      </td>
                      <td className="py-4 px-4 font-semibold text-slate-800">
                        <div>{it.productTitle}</div>
                        <span className="text-[11px] text-slate-400">{it.variantTitle}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`text-sm font-black ${
                            it.availableUnits === 0
                              ? "text-rose-600"
                              : it.isLowStock
                              ? "text-amber-600"
                              : "text-emerald-700"
                          }`}
                        >
                          {it.availableUnits}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-mono text-slate-500">
                        {it.reservedUnits > 0 ? (
                          <span className="text-indigo-600 font-bold">
                            {it.reservedUnits} held
                          </span>
                        ) : (
                          "0"
                        )}
                      </td>
                      <td className="py-4 px-4 text-slate-500 font-mono">
                        {it.lowStockThreshold} units
                      </td>
                      <td className="py-4 px-4">
                        <Badge
                          variant={
                            it.availableUnits === 0
                              ? "danger"
                              : it.isLowStock
                              ? "warning"
                              : "success"
                          }
                          size="sm"
                        >
                          {it.availableUnits === 0
                            ? "OUT OF STOCK"
                            : it.isLowStock
                            ? "LOW STOCK"
                            : "IN STOCK"}
                        </Badge>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setSelectedVariant(it);
                            setDeltaUnits(10);
                            setReasonCode("RECEIVING");
                          }}
                        >
                          <span>Adjust Stock</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Stock Adjustment Modal */}
      {selectedVariant && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-slate-200 shadow-2xl space-y-5">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Adjust Inventory Balance
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                SKU: <strong className="font-mono text-slate-800">{selectedVariant.sku}</strong> ({selectedVariant.productTitle})
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs flex justify-between">
              <span className="text-slate-500">Current Available:</span>
              <strong className="text-slate-900">{selectedVariant.availableUnits} units</strong>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Quantity Delta (Positive to add, Negative to remove)
                </label>
                <input
                  type="number"
                  required
                  value={deltaUnits}
                  onChange={(e) => setDeltaUnits(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 p-2.5 font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  New Balance will be: <strong>{selectedVariant.availableUnits + Number(deltaUnits)} units</strong>
                </span>
              </div>

              <div>
                <label className="block font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Adjustment Reason
                </label>
                <select
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="RECEIVING">RECEIVING (New shipment / Restock)</option>
                  <option value="CYCLE_COUNT">CYCLE_COUNT (Physical inventory audit)</option>
                  <option value="DAMAGE">DAMAGE (Damaged / expired goods)</option>
                  <option value="ADMIN_OVERRIDE">ADMIN_OVERRIDE (Manual correction)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Audit Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. PO-8840 received from warehouse"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedVariant(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={isAdjusting} disabled={isAdjusting}>
                  Confirm Adjustment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
