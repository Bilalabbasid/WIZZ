"use client";

import React, { useState } from "react";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Truck, ExternalLink, Package, AlertCircle, Check, Banknote, ShieldCheck } from "lucide-react";

export interface AdminOrderItem {
  id: string;
  orderNumber: string;
  customerEmail: string;
  customerPhone?: string | null;
  status: string;
  paymentStatus: string;
  totalMinor: number;
  notes?: string | null;
  createdAt: Date | string;
  sellerOrders: Array<{
    id: string;
    sellerOrderNumber: string;
    sellerOrg: { name: string };
    status: string;
    items: Array<{
      id: string;
      productTitleSnapshot: string;
      variantNameSnapshot: string;
      quantity: number;
      unitPriceMinor: number;
    }>;
    shipments: Array<{
      id: string;
      carrierName: string;
      trackingNumber: string;
      trackingUrl?: string | null;
      status: string;
    }>;
  }>;
}

const PAKISTAN_CARRIERS = [
  "TCS Express",
  "Leopards Courier",
  "M&P Logistics",
  "Trax Logistics",
  "PostEx",
  "Call Courier",
  "Pakistan Post (EMS)",
];

export function AdminOrdersView({ orders: initialOrders }: { orders: AdminOrderItem[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [selectedSellerOrderId, setSelectedSellerOrderId] = useState<string | null>(null);
  const [carrierName, setCarrierName] = useState("TCS Express");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // COD Reconcile state
  const [reconcilingOrderId, setReconcilingOrderId] = useState<string | null>(null);
  const [remittanceRef, setRemittanceRef] = useState("");
  const [isReconciling, setIsReconciling] = useState(false);

  const handleCreateShipment = async (orderId: string) => {
    if (!selectedSellerOrderId || !trackingNumber) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/admin/orders/${orderId}/shipment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerOrderId: selectedSellerOrderId,
          carrierName,
          trackingNumber,
          trackingUrl: trackingUrl || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create shipment.");

      window.location.reload();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Error creating shipment");
      setIsSubmitting(false);
    }
  };

  const handleReconcileCod = async (orderId: string) => {
    if (!remittanceRef.trim()) {
      setErrorMessage("Please enter courier remittance slip reference.");
      return;
    }
    setIsReconciling(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/admin/orders/${orderId}/cod-reconcile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remittanceRef: remittanceRef.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reconcile COD payment.");

      window.location.reload();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Error reconciling COD");
      setIsReconciling(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm text-slate-300">
          Customer Orders Pipeline ({orders.length})
        </h3>
        <span className="text-xs text-slate-400">
          All financial calculations frozen in PKR minor units
        </span>
      </div>

      <div className="space-y-4">
        {orders.map((o) => {
          let parsedNotes: Record<string, unknown> = {};
          try {
            parsedNotes = o.notes ? JSON.parse(o.notes) : {};
          } catch {
            parsedNotes = {};
          }

          const isCod = parsedNotes.paymentMethod === "CASH_ON_DELIVERY" || o.orderNumber.startsWith("WZ-COD");

          return (
            <div key={o.id} className="bg-slate-800/80 rounded-2xl border border-slate-700/80 p-6 space-y-5">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-700">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-white text-base">{o.orderNumber}</span>
                    {isCod && (
                      <Badge variant="warning" size="sm">
                        <Banknote size={11} className="mr-1" />
                        <span>Cash on Delivery</span>
                      </Badge>
                    )}
                  </div>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Customer: <strong className="text-slate-200">{o.customerEmail}</strong> •{" "}
                    {formatDateTime(o.createdAt)}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <Badge variant={o.paymentStatus === "PAID" ? "success" : "warning"} size="sm">
                    Payment: {o.paymentStatus}
                  </Badge>
                  <Badge variant={o.status === "DELIVERED" ? "success" : "default"} size="sm">
                    {o.status}
                  </Badge>
                  <span className="font-black text-white text-sm">{formatCurrency(o.totalMinor)}</span>
                </div>
              </div>

              {/* COD Reconciliation Notice & Action */}
              {isCod && o.paymentStatus !== "PAID" && (
                <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="text-amber-200">
                    <p className="font-bold flex items-center gap-1.5">
                      <Banknote size={14} className="text-amber-400" />
                      <span>COD Courier Cash Collection Pending Remittance</span>
                    </p>
                    <p className="text-[11px] text-amber-300/80 mt-0.5">
                      Delivery does not mark this order paid automatically. Reconcile once courier remits cash.
                    </p>
                  </div>

                  {reconcilingOrderId === o.id ? (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <input
                        type="text"
                        placeholder="Courier Remittance Ref #"
                        value={remittanceRef}
                        onChange={(e) => setRemittanceRef(e.target.value)}
                        className="bg-slate-900 text-white border border-slate-700 px-3 py-1.5 rounded-lg text-xs focus:ring-1 focus:ring-amber-400 focus:outline-none"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleReconcileCod(o.id)}
                        disabled={isReconciling}
                        isLoading={isReconciling}
                        className="bg-amber-600 hover:bg-amber-700 text-white"
                      >
                        Confirm Remittance
                      </Button>
                      <button
                        type="button"
                        onClick={() => setReconcilingOrderId(null)}
                        className="text-slate-400 hover:text-white text-xs px-2"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => {
                        setReconcilingOrderId(o.id);
                        setRemittanceRef("");
                      }}
                      className="bg-amber-600/90 hover:bg-amber-600 text-white font-semibold"
                    >
                      Reconcile COD Remittance
                    </Button>
                  )}
                </div>
              )}

              {/* Seller Packages */}
              <div className="space-y-3">
                {o.sellerOrders.map((so) => (
                  <div key={so.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <Package size={14} className="text-emerald-400" />
                        <span>{so.sellerOrg.name}</span> •{" "}
                        <span className="font-mono text-slate-400 font-normal">
                          {so.sellerOrderNumber}
                        </span>
                      </span>
                      <Badge variant="neutral" size="sm">
                        {so.status}
                      </Badge>
                    </div>

                    <div className="space-y-1 text-slate-300 pl-5">
                      {so.items.map((item) => (
                        <p key={item.id}>
                          {item.quantity}× {item.productTitleSnapshot} ({item.variantNameSnapshot}) —{" "}
                          <strong className="text-white">
                            {formatCurrency(item.unitPriceMinor * item.quantity)}
                          </strong>
                        </p>
                      ))}
                    </div>

                    {/* Shipments or Action */}
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                      {so.shipments.length > 0 ? (
                        <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                          <Truck size={14} />
                          <span>
                            Dispatched via {so.shipments[0].carrierName} (Waybill:{" "}
                            <span className="font-mono">{so.shipments[0].trackingNumber}</span>)
                          </span>
                        </div>
                      ) : (
                        <div className="w-full flex items-center justify-between">
                          <span className="text-slate-400 italic">No carrier waybill generated yet</span>
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedSellerOrderId(so.id);
                              setTrackingNumber(`TCS-${Math.floor(100000 + Math.random() * 900000)}`);
                            }}
                            className="bg-slate-700 hover:bg-slate-600 text-white"
                          >
                            Dispatch Package
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Waybill Modal/Form */}
              {selectedSellerOrderId && o.sellerOrders.some((so) => so.id === selectedSellerOrderId) && (
                <div className="p-4 rounded-xl bg-slate-900/90 border border-emerald-500/50 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                      <Truck size={14} />
                      <span>Generate Carrier Waybill & Dispatch Notice</span>
                    </span>
                    <button
                      onClick={() => setSelectedSellerOrderId(null)}
                      className="text-slate-400 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Pakistani Carrier</label>
                      <select
                        value={carrierName}
                        onChange={(e) => setCarrierName(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-xs focus:ring-1 focus:ring-emerald-500"
                      >
                        {PAKISTAN_CARRIERS.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Tracking / Consignment #</label>
                      <input
                        type="text"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        placeholder="e.g. 774829104"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-xs focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Live Tracking URL (Optional)</label>
                      <input
                        type="url"
                        value={trackingUrl}
                        onChange={(e) => setTrackingUrl(e.target.value)}
                        placeholder="https://tcsexpress.com/track/..."
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-xs focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  {errorMessage && <p className="text-rose-400 font-semibold">{errorMessage}</p>}

                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedSellerOrderId(null)}
                      className="border-slate-700 text-slate-300"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleCreateShipment(o.id)}
                      disabled={isSubmitting}
                      isLoading={isSubmitting}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      Save Waybill & Dispatch
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
