"use client";

import React, { useEffect, useState } from "react";
import {
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Eye,
  Boxes,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function SellerReturnsPage() {
  const [returns, setReturns] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReturn, setSelectedReturn] = useState<any | null>(null);
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [inspectionResult, setInspectionResult] = useState("Goods inspected and intact in original condition");
  const [isResolving, setIsResolving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReturns();
  }, []);

  const loadReturns = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/seller/returns");
      const data = await res.json();
      if (res.ok) {
        setReturns(data.returns || []);
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReturn) return;
    setIsResolving(true);
    setError(null);
    setFeedback(null);

    try {
      const res = await fetch(`/api/seller/returns/${selectedReturn.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          inspectionResult,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resolve return");

      setFeedback(`Return #${selectedReturn.id.slice(-6)} marked ${decision} successfully.`);
      setSelectedReturn(null);
      loadReturns();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error resolving return");
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Returns & Disputes Inspection
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Evaluate customer return requests, inspect physical goods upon receipt, and trigger inventory restocking.
          </p>
        </div>

        <Button size="sm" variant="ghost" onClick={loadReturns}>
          <RefreshCw size={14} />
          <span>Refresh</span>
        </Button>
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
          <div className="p-12 text-center text-xs text-slate-400">Loading return requests...</div>
        ) : returns.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <RotateCcw size={32} className="mx-auto text-slate-300" />
            <p className="text-xs text-slate-500">No return requests currently recorded.</p>
          </div>
        ) : (
          <div>
            {/* Mobile Cards (Viewports < md) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {returns.map((r) => (
                <div key={r.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-xs text-slate-900 block">RET-#{r.id.slice(-6)}</span>
                      <span className="text-[11px] font-mono text-slate-500">Order: {r.sellerOrder?.sellerOrderNumber}</span>
                    </div>
                    <Badge
                      variant={
                        r.status === "REFUNDED" || r.status === "APPROVED"
                          ? "success"
                          : r.status === "REJECTED"
                          ? "danger"
                          : "warning"
                      }
                      size="sm"
                    >
                      {r.status}
                    </Badge>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-semibold">Reason:</span>
                      <span className="font-bold text-slate-800">{r.reasonCode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-semibold">Items:</span>
                      <span className="text-slate-700">{r.items?.length || 1} item</span>
                    </div>
                    {r.explanation && (
                      <p className="text-[11px] text-slate-600 pt-1 border-t border-slate-200/60 line-clamp-2 italic">
                        "{r.explanation}"
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end pt-1">
                    {r.status === "SUBMITTED" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setSelectedReturn(r);
                          setDecision("APPROVED");
                        }}
                        className="w-full sm:w-auto"
                      >
                        Inspect & Resolve
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium py-1">Resolved</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table (Viewports >= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-6">Return Request #</th>
                    <th className="py-3 px-4">Package #</th>
                    <th className="py-3 px-4">Reason Code</th>
                    <th className="py-3 px-4">Customer Explanation</th>
                    <th className="py-3 px-4">Items</th>
                    <th className="py-3 px-4">Return Status</th>
                    <th className="py-3 px-6 text-right">Inspection Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {returns.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-4 px-6 font-mono font-bold text-slate-900">
                        RET-#{r.id.slice(-6)}
                      </td>
                      <td className="py-4 px-4 font-mono text-slate-600">
                        {r.sellerOrder?.sellerOrderNumber}
                      </td>
                      <td className="py-4 px-4 font-bold text-slate-800">
                        {r.reasonCode}
                      </td>
                      <td className="py-4 px-4 text-slate-600 max-w-xs truncate">
                        {r.explanation}
                      </td>
                      <td className="py-4 px-4 font-semibold text-slate-800">
                        {r.items?.length || 1} item
                      </td>
                      <td className="py-4 px-4">
                        <Badge
                          variant={
                            r.status === "REFUNDED" || r.status === "APPROVED"
                              ? "success"
                              : r.status === "REJECTED"
                              ? "danger"
                              : "warning"
                          }
                          size="sm"
                        >
                          {r.status}
                        </Badge>
                      </td>
                      <td className="py-4 px-6 text-right">
                        {r.status === "SUBMITTED" ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setSelectedReturn(r);
                              setDecision("APPROVED");
                            }}
                          >
                            Inspect & Resolve
                          </Button>
                        ) : (
                          <span className="text-slate-400 font-medium">Resolved</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Resolution Modal */}
      {selectedReturn && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-slate-200 shadow-2xl space-y-5">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Inspect Return & Dispute
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Return ID: <strong className="font-mono">#{selectedReturn.id.slice(-8)}</strong> for Package {selectedReturn.sellerOrder?.sellerOrderNumber}
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
              <span className="text-slate-500 font-bold">Reason:</span> {selectedReturn.reasonCode}
              <p className="text-slate-700 italic">"{selectedReturn.explanation}"</p>
            </div>

            <form onSubmit={handleResolveSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Inspection Decision
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDecision("APPROVED")}
                    className={`p-3 rounded-xl border text-center font-bold flex items-center justify-center gap-1.5 ${
                      decision === "APPROVED"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <CheckCircle2 size={15} />
                    <span>Approve & Restock</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDecision("REJECTED")}
                    className={`p-3 rounded-xl border text-center font-bold flex items-center justify-center gap-1.5 ${
                      decision === "REJECTED"
                        ? "bg-rose-50 border-rose-500 text-rose-800"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <XCircle size={15} />
                    <span>Reject Return</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Inspection Report & Findings
                </label>
                <textarea
                  rows={3}
                  required
                  value={inspectionResult}
                  onChange={(e) => setInspectionResult(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedReturn(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={isResolving} disabled={isResolving}>
                  Confirm Decision
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
