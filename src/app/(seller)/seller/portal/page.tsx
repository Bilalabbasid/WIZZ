import React from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getSellerContextForUser, getSellerDashboardStats } from "@/modules/sellers/services";
import { formatPkr } from "@/lib/formatters";
import {
  TrendingUp,
  PackageOpen,
  Boxes,
  Layers,
  AlertTriangle,
  ArrowRight,
  PlusCircle,
  Truck,
  RotateCcw,
  CheckCircle2,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default async function SellerDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/seller/portal");

  const context = await getSellerContextForUser(user.id);
  if (!context?.sellerOrg) redirect("/seller/onboarding");

  const stats = await getSellerDashboardStats(context.sellerOrg.id);
  const org = context.sellerOrg;

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 mb-2">
            <span>Merchant Operations</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Welcome back, {org.name}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time fulfillment metrics, order throughput, and inventory performance for your WIZZ.PK store.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/seller/portal/products/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition shadow-sm"
          >
            <PlusCircle size={15} />
            <span>Add New Product</span>
          </Link>

          <Link
            href="/seller/portal/inventory"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 transition"
          >
            <Boxes size={15} />
            <span>Adjust Inventory</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total GMV */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Total Gross GMV</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {formatPkr(stats.totalGmvMinor)}
          </div>
          <p className="text-[11px] text-slate-400">
            Net Payable: <strong className="text-slate-700">{formatPkr(stats.totalNetPayableMinor)}</strong>
          </p>
        </div>

        {/* Total Orders */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Total Orders</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <PackageOpen size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {stats.ordersCount}
          </div>
          <p className="text-[11px] text-slate-400">
            Pending Dispatch: <strong className="text-indigo-600">{stats.pendingOrdersCount} packages</strong>
          </p>
        </div>

        {/* Active Products */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Catalog Items</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Layers size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {stats.productsCount}
          </div>
          <p className="text-[11px] text-slate-400">
            Published Live: <strong className="text-emerald-700">{stats.publishedProductsCount}</strong>
          </p>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Low Stock SKUs</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {stats.lowStockCount}
          </div>
          <p className="text-[11px] text-slate-400">
            {stats.lowStockCount > 0 ? "Replenishment required" : "All SKUs healthy"}
          </p>
        </div>
      </div>

      {/* Main Grid: Recent Orders & Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Orders (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Recent Customer Packages</h2>
              <p className="text-xs text-slate-500 mt-0.5">Orders assigned to your seller organization</p>
            </div>
            <Link
              href="/seller/portal/orders"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              <span>View All Orders</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {stats.recentOrders.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <PackageOpen size={32} className="mx-auto text-slate-300" />
              <p className="text-xs text-slate-500">No customer orders placed yet for this seller organization.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/70 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-6">Package #</th>
                    <th className="py-3 px-4">Master Order</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Gross Total</th>
                    <th className="py-3 px-4">Net Payable</th>
                    <th className="py-3 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {stats.recentOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-4 px-6 font-bold text-slate-900">
                        {o.sellerOrderNumber}
                      </td>
                      <td className="py-4 px-4 font-mono text-slate-500">
                        {o.orderNumber}
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
                      <td className="py-4 px-4 font-semibold text-slate-900">
                        {formatPkr(o.totalMinor)}
                      </td>
                      <td className="py-4 px-4 font-bold text-emerald-700">
                        {formatPkr(o.netSellerPayableMinor)}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <Link
                          href={`/seller/portal/orders/${o.id}`}
                          className="font-bold text-indigo-600 hover:text-indigo-800"
                        >
                          Manage &rarr;
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Low Stock Attention & Quick Tools (1 col) */}
        <div className="space-y-6">
          {/* Low Stock Alert Panel */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500" />
                <span>Low Stock Replenishment</span>
              </h2>
              <Link
                href="/seller/portal/inventory?lowStock=true"
                className="text-[11px] font-bold text-indigo-600 hover:underline"
              >
                View all
              </Link>
            </div>

            {stats.lowStockAlerts.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <CheckCircle2 size={24} className="text-emerald-500" />
                <span>All SKUs currently exceed reorder safety thresholds.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.lowStockAlerts.map((a) => (
                  <div
                    key={a.variantId}
                    className="p-3 rounded-2xl bg-amber-50/60 border border-amber-200/70 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900 line-clamp-1">{a.productTitle}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {a.sku} &bull; {a.variantTitle}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-rose-600">{a.availableUnits} left</span>
                      <div className="text-[10px] text-slate-400">Min: {a.lowStockThreshold}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Operations Links */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Fulfillment Workflows
            </h3>
            <div className="space-y-2 text-xs">
              <Link
                href="/seller/portal/shipments"
                className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition border border-slate-100 font-semibold text-slate-700"
              >
                <div className="flex items-center gap-2">
                  <Truck size={15} className="text-indigo-600" />
                  <span>Carrier Dispatch & Waybills</span>
                </div>
                <ArrowRight size={14} className="text-slate-400" />
              </Link>

              <Link
                href="/seller/portal/returns"
                className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition border border-slate-100 font-semibold text-slate-700"
              >
                <div className="flex items-center gap-2">
                  <RotateCcw size={15} className="text-amber-600" />
                  <span>Customer Returns & Restocks</span>
                </div>
                <ArrowRight size={14} className="text-slate-400" />
              </Link>

              <Link
                href="/seller/portal/settlements"
                className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition border border-slate-100 font-semibold text-slate-700"
              >
                <div className="flex items-center gap-2">
                  <TrendingUp size={15} className="text-emerald-600" />
                  <span>Commission & Bank Statements</span>
                </div>
                <ArrowRight size={14} className="text-slate-400" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
