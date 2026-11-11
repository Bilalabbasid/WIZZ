import { prisma } from "@/lib/db";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  ShoppingBag,
  Store,
  Layers,
  ArrowRight,
  Clock,
  Undo2,
  Boxes,
  Users,
  ShieldAlert,
  CalendarDays,
  ReceiptText,
} from "lucide-react";
import { requireAdminPage, canAccessSection, type AdminSection } from "@/modules/admin/access";
import { getAdminDashboardStats } from "@/modules/admin/stats";

const SECTION_LABELS: Partial<Record<AdminSection, string>> = {
  applications: "Seller Applications",
  sellers: "Sellers",
  products: "Products",
  categories: "Categories",
  reviews: "Reviews",
  inventory: "Inventory",
  orders: "Orders",
  returns: "Returns",
  refunds: "Refunds",
  customers: "Customers",
  coupons: "Coupons",
  settings: "Marketplace Settings",
  auditLogs: "Audit Trails",
};

interface StatTile {
  label: string;
  value: string;
  hint: string;
  href: string;
  section: AdminSection;
  icon: LucideIcon;
  tone: "emerald" | "indigo" | "amber" | "rose" | "sky" | "slate";
}

const TONES: Record<StatTile["tone"], string> = {
  emerald: "bg-emerald-500/15 text-emerald-400",
  indigo: "bg-brand-500/15 text-brand-400",
  amber: "bg-amber-500/15 text-amber-400",
  rose: "bg-rose-500/15 text-rose-400",
  sky: "bg-sky-500/15 text-sky-400",
  slate: "bg-slate-500/15 text-slate-300",
};

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const user = await requireAdminPage("dashboard", "/admin");
  const { denied } = await searchParams;
  const deniedLabel = denied && denied in SECTION_LABELS ? SECTION_LABELS[denied as AdminSection] : null;

  const [stats, recentOrders, pendingApps] = await Promise.all([
    getAdminDashboardStats(),
    canAccessSection(user.role, "orders")
      ? prisma.customerOrder.findMany({
          take: 6,
          orderBy: { createdAt: "desc" },
          select: { id: true, orderNumber: true, customerEmail: true, createdAt: true, status: true, totalMinor: true },
        })
      : Promise.resolve([]),
    canAccessSection(user.role, "applications")
      ? prisma.sellerApplication.findMany({
          where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
          take: 4,
          orderBy: { createdAt: "desc" },
          select: { id: true, tradingName: true, legalBusinessName: true, status: true },
        })
      : Promise.resolve([]),
  ]);

  const tiles: StatTile[] = [
    {
      label: "Orders today",
      value: stats.ordersToday.toLocaleString("en-PK"),
      hint: `${stats.orders7d.toLocaleString("en-PK")} in the last 7 days`,
      href: "/admin/orders",
      section: "orders",
      icon: CalendarDays,
      tone: "indigo",
    },
    {
      label: "Gross merchandise value",
      value: formatCurrency(stats.gmvMinor),
      hint: `${formatCurrency(stats.gmv7dMinor)} in 7 days · excludes cancelled & unpaid`,
      href: "/admin/orders",
      section: "orders",
      icon: Banknote,
      tone: "emerald",
    },
    {
      label: "Pending seller applications",
      value: stats.pendingApplications.toLocaleString("en-PK"),
      hint: "Submitted or under review",
      href: "/admin/applications",
      section: "applications",
      icon: Store,
      tone: stats.pendingApplications > 0 ? "amber" : "slate",
    },
    {
      label: "Products pending moderation",
      value: stats.pendingModeration.toLocaleString("en-PK"),
      hint: "Seller listings awaiting review",
      href: "/admin/products",
      section: "products",
      icon: ShieldAlert,
      tone: stats.pendingModeration > 0 ? "amber" : "slate",
    },
    {
      label: "Open return requests",
      value: stats.openReturns.toLocaleString("en-PK"),
      hint: "Submitted, approved or received",
      href: "/admin/returns",
      section: "returns",
      icon: Undo2,
      tone: stats.openReturns > 0 ? "rose" : "slate",
    },
    {
      label: "Low-stock variants",
      value: stats.lowStock.toLocaleString("en-PK"),
      hint: "Sellable units at or below threshold",
      href: "/admin/inventory",
      section: "inventory",
      icon: Boxes,
      tone: stats.lowStock > 0 ? "rose" : "slate",
    },
    {
      label: "Active sellers",
      value: stats.activeSellers.toLocaleString("en-PK"),
      hint: "Including WIZZ.PK Direct",
      href: "/admin/sellers",
      section: "sellers",
      icon: Store,
      tone: "sky",
    },
    {
      label: "Customers",
      value: stats.customers.toLocaleString("en-PK"),
      hint: "Registered customer accounts",
      href: "/admin/customers",
      section: "customers",
      icon: Users,
      tone: "sky",
    },
    {
      label: "Published listings",
      value: stats.publishedAll.toLocaleString("en-PK"),
      hint: `${stats.publishedFirstParty.toLocaleString("en-PK")} from WIZZ.PK Direct (1P)`,
      href: "/admin/products",
      section: "products",
      icon: Layers,
      tone: "indigo",
    },
    {
      label: "Refunds awaiting payout",
      value: stats.pendingRefunds.toLocaleString("en-PK"),
      hint:
        stats.pendingRefunds > 0
          ? `${formatCurrency(stats.pendingRefundsMinor)} to refund manually`
          : "No pending manual refunds",
      href: "/admin/refunds",
      section: "refunds",
      icon: ReceiptText,
      tone: stats.pendingRefunds > 0 ? "amber" : "slate",
    },
  ];

  return (
    <div className="space-y-10">
      <div>
        <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">Platform Operations</span>
        <h1 className="text-3xl font-black tracking-tight text-white mt-1">WIZZ.PK Overview</h1>
        <p className="text-xs text-slate-400 mt-1">Live counts from the database. Select a tile to open its queue.</p>
      </div>

      {deniedLabel && (
        <div role="status" className="p-4 rounded-xl border border-amber-500/40 bg-amber-950/60 text-amber-200 text-sm">
          Your role does not have access to <strong>{deniedLabel}</strong>. Ask a super admin if you need it.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {tiles.map((t) => {
          const Icon = t.icon;
          const allowed = canAccessSection(user.role, t.section);
          const body = (
            <>
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-slate-400">{t.label}</span>
                <span className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center ${TONES[t.tone]}`}>
                  <Icon size={16} aria-hidden="true" />
                </span>
              </div>
              <p className="text-2xl font-black text-white tabular-nums">{t.value}</p>
              <p className="text-[11px] text-slate-400">{t.hint}</p>
            </>
          );
          return allowed ? (
            <Link
              key={t.label}
              href={t.href}
              className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-2 hover:border-brand-500/60 hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              {body}
            </Link>
          ) : (
            <div key={t.label} className="p-5 rounded-2xl bg-slate-800/50 border border-slate-800 space-y-2">
              {body}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {canAccessSection(user.role, "orders") && (
          <section className="lg:col-span-2 space-y-4" aria-labelledby="recent-orders">
            <div className="flex items-center justify-between">
              <h2 id="recent-orders" className="font-bold text-base text-white">Recent Customer Orders</h2>
              <Link href="/admin/orders" className="text-xs text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1">
                <span>View all orders</span>
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
            <div className="bg-slate-800/80 rounded-2xl border border-slate-700/80 divide-y divide-slate-700/60 overflow-hidden">
              {recentOrders.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">No orders yet.</div>
              ) : (
                recentOrders.map((o) => (
                  <div key={o.id} className="p-4 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <span className="font-bold text-white">{o.orderNumber}</span>
                      <p className="text-slate-400 text-[11px] truncate">
                        {o.customerEmail} · {formatDateTime(o.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant={o.status === "DELIVERED" ? "success" : o.status === "CANCELLED" ? "danger" : "default"} size="sm">
                        {o.status.replace(/_/g, " ")}
                      </Badge>
                      <span className="font-black text-white tabular-nums">{formatCurrency(o.totalMinor)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {canAccessSection(user.role, "applications") && (
          <section className="space-y-4" aria-labelledby="seller-pipeline">
            <div className="flex items-center justify-between">
              <h2 id="seller-pipeline" className="font-bold text-base text-white">Seller Pipeline</h2>
              <Link href="/admin/applications" className="text-xs text-brand-400 hover:text-brand-300 font-semibold">
                Manage
              </Link>
            </div>
            <div className="bg-slate-800/80 rounded-2xl border border-slate-700/80 p-5 space-y-3">
              {pendingApps.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No seller applications awaiting review.</p>
              ) : (
                pendingApps.map((a) => (
                  <div key={a.id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white truncate">{a.tradingName}</span>
                      <Badge variant="warning" size="sm">
                        <Clock size={10} aria-hidden="true" />
                        {a.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <p className="text-slate-400 text-[11px] truncate">{a.legalBusinessName}</p>
                  </div>
                ))
              )}
              <Link
                href="/admin/applications"
                className="text-[11px] font-semibold text-brand-400 hover:underline inline-flex items-center gap-1 pt-1"
              >
                <ShoppingBag size={12} aria-hidden="true" /> Review applications & KYC documents
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
