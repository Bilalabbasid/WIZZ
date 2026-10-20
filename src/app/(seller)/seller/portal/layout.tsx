import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSellerContextForUser } from "@/modules/sellers/services";
import {
  LayoutDashboard,
  Store,
  Boxes,
  PackageOpen,
  Truck,
  RotateCcw,
  DollarSign,
  Users,
  Settings,
  Bell,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default async function SellerPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/seller/portal");
  }

  const context = await getSellerContextForUser(user.id);
  if (!context?.sellerOrg) {
    redirect("/seller/onboarding");
  }

  const org = context.sellerOrg;
  const status = context.status;
  const canSell = context.canSell;

  const navItems = [
    { label: "Dashboard", href: "/seller/portal", icon: LayoutDashboard },
    { label: "Store Profile", href: "/seller/portal/profile", icon: Store },
    { label: "Products", href: "/seller/portal/products", icon: Layers },
    { label: "Inventory", href: "/seller/portal/inventory", icon: Boxes },
    { label: "Orders", href: "/seller/portal/orders", icon: PackageOpen },
    { label: "Shipments", href: "/seller/portal/shipments", icon: Truck },
    { label: "Returns", href: "/seller/portal/returns", icon: RotateCcw },
    { label: "Settlements", href: "/seller/portal/settlements", icon: DollarSign },
    { label: "Notifications", href: "/seller/portal/notifications", icon: Bell },
    { label: "Team", href: "/seller/portal/team", icon: Users },
    { label: "Settings & Audit", href: "/seller/portal/settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Workspace Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/seller" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-sm tracking-wider">
                W
              </div>
              <span className="font-black text-slate-900 tracking-tight text-lg">
                WIZZ<span className="text-emerald-600">.PK</span>
              </span>
            </Link>
            <span className="text-slate-300">/</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-slate-800">{org.name}</span>
              <Badge
                variant={
                  canSell
                    ? "success"
                    : status === "SUSPENDED"
                    ? "danger"
                    : status === "CHANGES_REQUESTED"
                    ? "warning"
                    : "neutral"
                }
                size="sm"
              >
                {canSell
                  ? "ACTIVE SELLER"
                  : status === "SUSPENDED"
                  ? "SUSPENDED"
                  : status.replace("_", " ")}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1.5"
            >
              <ArrowLeft size={14} />
              <span className="hidden sm:inline">Storefront</span>
            </Link>

            <Link
              href="/seller/onboarding"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100"
            >
              KYC Onboarding
            </Link>

            <div className="text-xs text-slate-500 border-l border-slate-200 pl-4 hidden md:block">
              {user.email}
            </div>
          </div>
        </div>

        {/* Horizontal Navigation Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-100 overflow-x-auto scrollbar-none">
          <nav className="flex space-x-1 py-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 whitespace-nowrap transition"
                >
                  <Icon size={14} className="shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Status Warning Banners for Inactive / Suspended Sellers */}
      {!canSell && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 py-3 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-900">
              <AlertTriangle size={16} className="text-amber-600 shrink-0" />
              <span>
                {status === "SUSPENDED" ? (
                  <>
                    <strong>Account Suspended:</strong> {context.suspensionReason || "This organization has been suspended by administration. Actions are locked."}
                  </>
                ) : (
                  <>
                    <strong>Pre-Approval Workspace:</strong> You may draft catalog listings and configure store settings, but products cannot be published to the storefront until KYC approval is completed.
                  </>
                )}
              </span>
            </div>
            <div>
              <Link
                href="/seller/onboarding"
                className="font-bold text-indigo-700 hover:underline inline-flex items-center gap-1"
              >
                <span>View Verification Status</span>
                &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
