"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Truck, ExternalLink, RefreshCw, CheckCircle2, Clock, AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function SellerShipmentsPage() {
  const [shipments, setShipments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadShipments();
  }, []);

  const loadShipments = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/seller/orders");
      const data = await res.json();
      if (res.ok && data.orders) {
        const flatShipments: any[] = [];
        data.orders.forEach((o: any) => {
          if (o.shipments) {
            o.shipments.forEach((s: any) => {
              flatShipments.push({
                ...s,
                sellerOrderNumber: o.sellerOrderNumber,
                orderId: o.id,
                customerEmail: o.customerOrder?.customerEmail,
              });
            });
          }
        });
        setShipments(flatShipments);
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Shipment Waybill Tracking
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time courier handoffs, tracking air waybills, and delivery milestones.
          </p>
        </div>

        <Button size="sm" variant="ghost" onClick={loadShipments}>
          <RefreshCw size={14} />
          <span>Refresh</span>
        </Button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading shipments...</div>
        ) : shipments.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Truck size={32} className="mx-auto text-slate-300" />
            <p className="text-xs text-slate-500">No shipments dispatched yet.</p>
          </div>
        ) : (
          <div>
            {/* Mobile Cards (Viewports < md) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {shipments.map((s) => (
                <div key={s.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Tracking AWB</span>
                      <span className="font-mono font-bold text-xs text-slate-900">{s.trackingNumber}</span>
                    </div>
                    <Badge
                      variant={
                        s.status === "DELIVERED"
                          ? "success"
                          : s.status === "IN_TRANSIT"
                          ? "default"
                          : "neutral"
                      }
                      size="sm"
                    >
                      {s.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Courier</span>
                      <span className="font-bold text-emerald-800">{s.carrierName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Package #</span>
                      <span className="font-mono font-semibold text-slate-700">{s.sellerOrderNumber}</span>
                    </div>
                    <div className="col-span-2 text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                      Dispatched: {s.shippedAt ? new Date(s.shippedAt).toLocaleDateString() : "Pending"}
                    </div>
                  </div>

                  <Link
                    href={`/seller/portal/orders/${s.orderId}`}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-emerald-600 transition min-h-[44px]"
                  >
                    <span>View Suborder Details</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              ))}
            </div>

            {/* Desktop Table (Viewports >= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-6">Tracking Airway Bill</th>
                    <th className="py-3 px-4">Courier Partner</th>
                    <th className="py-3 px-4">Package #</th>
                    <th className="py-3 px-4">Dispatched At</th>
                    <th className="py-3 px-4">Delivery State</th>
                    <th className="py-3 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {shipments.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-4 px-6 font-mono font-bold text-slate-900">
                        {s.trackingNumber}
                      </td>
                      <td className="py-4 px-4 font-bold text-emerald-700">
                        {s.carrierName}
                      </td>
                      <td className="py-4 px-4 font-mono text-slate-600">
                        {s.sellerOrderNumber}
                      </td>
                      <td className="py-4 px-4 text-slate-500">
                        {s.shippedAt ? new Date(s.shippedAt).toLocaleDateString() : "Pending"}
                      </td>
                      <td className="py-4 px-4">
                        <Badge
                          variant={
                            s.status === "DELIVERED"
                              ? "success"
                              : s.status === "IN_TRANSIT"
                              ? "default"
                              : "neutral"
                          }
                          size="sm"
                        >
                          {s.status}
                        </Badge>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <Link
                          href={`/seller/portal/orders/${s.orderId}`}
                          className="font-bold text-emerald-700 hover:text-emerald-800 p-1 rounded inline-flex items-center min-h-[44px]"
                        >
                          View Order &rarr;
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
