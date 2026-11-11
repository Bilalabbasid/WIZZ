import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { AdminNav, type AdminNavItem } from "@/components/admin-nav";
import { ALL_ADMIN_ROLES, canAccessSection, formatRole, type AdminSection } from "@/modules/admin/access";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

const NAV: Array<AdminNavItem & { section: AdminSection }> = [
  { href: "/admin", label: "Dashboard", section: "dashboard" },
  { href: "/admin/orders", label: "Orders & Fulfillment", section: "orders" },
  { href: "/admin/returns", label: "Returns & Disputes", section: "returns" },
  { href: "/admin/refunds", label: "Refunds", section: "refunds" },
  { href: "/admin/customers", label: "Customers", section: "customers" },
  { href: "/admin/sellers", label: "Sellers", section: "sellers" },
  { href: "/admin/applications", label: "Seller Applications", section: "applications" },
  { href: "/admin/products", label: "Products", section: "products" },
  { href: "/admin/categories", label: "Categories", section: "categories" },
  { href: "/admin/inventory", label: "Inventory Levels", section: "inventory" },
  { href: "/admin/reviews", label: "Customer Reviews", section: "reviews" },
  { href: "/admin/coupons", label: "Coupons", section: "coupons" },
  { href: "/admin/settings", label: "Marketplace Settings", section: "settings" },
  { href: "/admin/audit-logs", label: "Audit Trails", section: "auditLogs" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // First line of defence only: layouts are not re-run on client navigation, so every
  // admin page also calls requireAdminPage() with its own role list.
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/admin");
  }
  if (!ALL_ADMIN_ROLES.includes(user.role)) {
    notFound();
  }

  const navItems = NAV.filter((item) => canAccessSection(user.role, item.section)).map(({ href, label, section }) => ({
    href,
    label,
    section,
  }));

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-slate-950 border-b md:border-b-0 md:border-r border-slate-800/80 p-3 md:p-5 flex flex-col md:justify-between flex-shrink-0 md:sticky md:top-0 md:h-screen md:overflow-y-auto">
        <div className="space-y-3 md:space-y-6">
          <div className="flex items-center justify-between gap-3 px-1 md:px-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-black text-sm" aria-hidden="true">
                W
              </div>
              <div>
                <span className="font-extrabold text-base tracking-tight text-white">
                  WIZZ<span className="text-brand-400">.PK</span>
                </span>
                <span className="block text-[10px] font-semibold text-emerald-400 tracking-wider uppercase">Admin Console</span>
              </div>
            </div>
            <div className="md:hidden text-right text-[10px] leading-tight">
              <p className="text-slate-300 font-semibold truncate max-w-[45vw]">{user.email}</p>
              <p className="text-brand-400 font-semibold">{formatRole(user.role)}</p>
            </div>
          </div>

          <div className="hidden md:block px-2 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <p className="text-slate-400">Signed in as:</p>
            <p className="font-bold text-white truncate">{user.email}</p>
            <p className="text-[10px] text-brand-400 font-semibold mt-0.5">Role: {formatRole(user.role)}</p>
          </div>

          <AdminNav items={navItems} />
        </div>

        <div className="hidden md:block pt-6 border-t border-slate-800/80">
          <Link href="/" className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors px-2 py-1.5">
            <ArrowLeft size={14} aria-hidden="true" />
            <span>Exit to Public Storefront</span>
          </Link>
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-10 max-w-7xl">{children}</main>
    </div>
  );
}
