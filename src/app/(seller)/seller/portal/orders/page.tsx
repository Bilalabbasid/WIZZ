"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { PackageOpen, Search, RefreshCw, Eye, ArrowRight, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPkr } from "@/lib/formatters";

export default function SellerOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, [statusFilter]);

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const url = new URL("/api/seller/orders", window.location.origin);
      if (statusFilter) url.searchParams.set("status", statusFilter);

      const res = await fetch(url.toString());
      const data = await res.json();
      if (res.ok) {
        setOrders(data.orders || []);
        setTotal(data.total || 0);
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
            Orders & Package Fulfillment
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Fulfill items partitioned to your seller organization, generate carrier waybills, and update package states.
          </p>
        </div>

        <Button size="sm" variant="ghost" onClick={loadOrders}>
          <RefreshCw size={14} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500">Filter By Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs rounded-xl border border-slate-200 p-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Packages ({total})</option>
            <option value="CONFIRMED">Confirmed / Processing</option>
            <option value="PACKING">Packing</option>
            <option value="DISPATCHED">Dispatched / In Transit</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <PackageOpen size={32} className="mx-auto text-slate-300" />
            <p className="text-xs text-slate-500">No orders found for this organization.</p>
          </div>
        ) : (
          <div>
            {/* Mobile Cards (Viewports < md) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {orders.map((o) => {
                const itemCount = o.items?.reduce((acc: number, i: any) => acc + i.quantity, 0) || 0;
                return (
                  <div key={o.id} className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-slate-900">{o.sellerOrderNumber}</span>
                      <Badge
                        variant={
                          o.status === "DELIVERED"
                            ? "success"
                            : o.status === "DISPATCHED"
                            ? "default"
                            : o.status === "PACKING"
                            ? "warning"
                            : "neutral"
                        }
                        size="sm"
                      >
                        {o.status}
                      </Badge>
                    </div>

                    <div className="text-xs text-slate-500 space-y-1">
                      <p>Master: <span className="font-mono text-slate-700">{o.customerOrder?.orderNumber}</span></p>
                      <p className="truncate">Customer: {o.customerOrder?.customerEmail}</p>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Net Payout</span>
                        <span className="font-bold text-emerald-700">{formatPkr(o.netSellerPayableMinor)}</span>
                      </div>
                      <Link
                        href={`/seller/portal/orders/${o.id}`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition min-h-[44px]"
                      >
                        <span>Fulfill</span>
                        <ArrowRight size={14} />
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
                    <th className="py-3 px-6">Seller Package #</th>
                    <th className="py-3 px-4">Master Order</th>
                    <th className="py-3 px-4">Customer Email</th>
                    <th className="py-3 px-4">Items Qty</th>
                    <th className="py-3 px-4">Gross Total</th>
                    <th className="py-3 px-4">Net Payable</th>
                    <th className="py-3 px-4">Package Status</th>
                    <th className="py-3 px-6 text-right">Fulfillment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {orders.map((o) => {
                    const itemCount = o.items?.reduce((acc: number, i: any) => acc + i.quantity, 0) || 0;
                    return (
                      <tr key={o.id} className="hover:bg-slate-50/50 transition">
                        <td className="py-4 px-6 font-bold text-slate-900 font-mono">
                          {o.sellerOrderNumber}
                        </td>
                        <td className="py-4 px-4 font-mono text-slate-500">
                          {o.customerOrder?.orderNumber}
                        </td>
                        <td className="py-4 px-4 text-slate-600">
                          {o.customerOrder?.customerEmail}
                        </td>
                        <td className="py-4 px-4 font-bold text-slate-800">
                          {itemCount} units
                        </td>
                        <td className="py-4 px-4 font-bold text-slate-900">
                          {formatPkr(o.totalMinor)}
                        </td>
                        <td className="py-4 px-4 font-bold text-emerald-700">
                          {formatPkr(o.netSellerPayableMinor)}
                        </td>
                        <td className="py-4 px-4">
                          <Badge
                            variant={
                              o.status === "DELIVERED"
                                ? "success"
                                : o.status === "DISPATCHED"
                                ? "default"
                                : o.status === "PACKING"
                                ? "warning"
                                : "neutral"
                            }
                            size="sm"
                          >
                            {o.status}
                          </Badge>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <Link
                            href={`/seller/portal/orders/${o.id}`}
                            className="inline-flex items-center gap-1 font-bold text-indigo-600 hover:text-indigo-800"
                          >
                            <span>Fulfill Package</span>
                            <ArrowRight size={13} />
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
    </div>
  );
}
