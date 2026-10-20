import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";
import type { Metadata } from "next";
import {
  LayoutDashboard,
  Store,
  Layers,
  Boxes,
  ShoppingBag,
  History,
  ShieldCheck,
  Star,
  ArrowLeft,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Admin Portal | WIZZ.PK",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user || user.role === "CUSTOMER") {
    redirect("/login?next=/admin");
  }

  const navItems = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/applications", label: "Seller Applications", icon: Store },
    { href: "/admin/products", label: "1P Products", icon: Layers },
    { href: "/admin/inventory", label: "Inventory Levels", icon: Boxes },
    { href: "/admin/orders", label: "Orders & Fulfillment", icon: ShoppingBag },
    { href: "/admin/reviews", label: "Customer Reviews", icon: Star },
    { href: "/admin/audit-logs", label: "Audit Trails", icon: History },
  ];


  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-950 border-r border-slate-800/80 p-5 flex flex-col justify-between flex-shrink-0">
        <div className="space-y-6">
          <div className="flex items-center gap-2 px-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-sm">
              W
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-white">
                WIZZ<span className="text-indigo-400">.PK</span>
              </span>

              <span className="block text-[10px] font-semibold text-emerald-400 tracking-wider uppercase">
                Admin Console
              </span>
            </div>
          </div>

          <div className="px-2 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <p className="text-slate-400">Signed in as:</p>
            <p className="font-bold text-white truncate">{user.email}</p>
            <p className="text-[10px] text-indigo-400 font-semibold mt-0.5">
              Role: {user.role.replace("PLATFORM_", "")}
            </p>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors"
                >
                  <Icon size={16} className="text-indigo-400" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="pt-6 border-t border-slate-800/80">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors px-2 py-1.5"
          >
            <ArrowLeft size={14} />
            <span>Exit to Public Storefront</span>
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto max-w-7xl">
        {children}
      </main>
    </div>
  );
}
