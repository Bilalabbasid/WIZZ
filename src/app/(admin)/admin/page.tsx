import { prisma } from "@/lib/db";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  DollarSign,
  ShoppingBag,
  Store,
  Layers,
  ArrowRight,
  Clock,
  CheckCircle2,
} from "lucide-react";

export default async function AdminDashboardPage() {
  const [
    totalRevenueAgg,
    ordersCount,
    productsCount,
    pendingAppsCount,
    recentOrders,
    pendingApps,
  ] = await Promise.all([
    prisma.customerOrder.aggregate({
      _sum: { totalMinor: true },
      where: { paymentStatus: "PAID" },
    }),
    prisma.customerOrder.count(),
    prisma.product.count({ where: { status: "PUBLISHED" } }),
    prisma.sellerApplication.count({
      where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
    }),
    prisma.customerOrder.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        customerUser: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.sellerApplication.findMany({
      where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
      take: 3,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const totalRevenueMinor = totalRevenueAgg._sum.totalMinor || 0;

  return (
    <div className="space-y-10">
      {/* Title */}
      <div>
        <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
          Platform Operations
        </span>
        <h1 className="text-3xl font-black tracking-tight text-white mt-1">
          WIZZ.PK Executive Overview
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Real-time metrics across store orders, seller compliance pipeline, and catalog inventory.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 rounded-3xl bg-slate-800/80 border border-slate-700/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Paid Revenue</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <DollarSign size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-white">
            {formatCurrency(totalRevenueMinor)}
          </p>
          <p className="text-[11px] text-emerald-400 font-semibold">100% captured & reconciled</p>
        </div>

        <div className="p-6 rounded-3xl bg-slate-800/80 border border-slate-700/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Customer Orders</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <ShoppingBag size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-white">{ordersCount}</p>
          <p className="text-[11px] text-slate-400">Lifetime purchases placed</p>
        </div>

        <div className="p-6 rounded-3xl bg-slate-800/80 border border-slate-700/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Published 1P Listings</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <Layers size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-white">{productsCount}</p>
          <p className="text-[11px] text-slate-400">Active physical products</p>
        </div>

        <div className="p-6 rounded-3xl bg-slate-800/80 border border-slate-700/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Pending Seller KYC</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Store size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-400">{pendingAppsCount}</p>
          <p className="text-[11px] text-slate-400">Requires administrative decision</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Orders (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-base text-white">Recent Customer Orders</h2>
            <Link
              href="/admin/orders"
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
            >
              <span>View All Orders</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="bg-slate-800/80 rounded-3xl border border-slate-700/80 divide-y divide-slate-700/60 overflow-hidden">
            {recentOrders.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">No orders yet.</div>
            ) : (
              recentOrders.map((o) => (
                <div key={o.id} className="p-4 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-white">{o.orderNumber}</span>
                    <p className="text-slate-400 text-[11px]">
                      {o.customerEmail} • {formatDateTime(o.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={o.status === "DELIVERED" ? "success" : "default"} size="sm">
                      {o.status}
                    </Badge>
                    <span className="font-black text-white">{formatCurrency(o.totalMinor)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pending Applications Box (1 col) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-base text-white">Seller Pipeline</h2>
            <Link
              href="/admin/applications"
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
            >
              Manage
            </Link>
          </div>

          <div className="bg-slate-800/80 rounded-3xl border border-slate-700/80 p-5 space-y-4">
            {pendingApps.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">
                No pending seller applications awaiting review.
              </p>
            ) : (
              pendingApps.map((a) => (
                <div key={a.id} className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{a.tradingName}</span>
                    <Badge variant="warning" size="sm">
                      {a.status}
                    </Badge>
                  </div>
                  <p className="text-slate-400 text-[11px] truncate">{a.legalBusinessName}</p>
                  <Link
                    href={`/admin/applications`}
                    className="text-[11px] font-semibold text-indigo-400 hover:underline inline-block pt-1"
                  >
                    Review Application & KYC Docs →
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
