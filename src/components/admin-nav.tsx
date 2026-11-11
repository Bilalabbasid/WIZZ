"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Store,
  Building2,
  Layers,
  FolderTree,
  Boxes,
  ShoppingBag,
  Undo2,
  Users,
  TicketPercent,
  Settings,
  History,
  Star,
  ReceiptText,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  applications: Store,
  sellers: Building2,
  products: Layers,
  categories: FolderTree,
  inventory: Boxes,
  reviews: Star,
  orders: ShoppingBag,
  returns: Undo2,
  refunds: ReceiptText,
  customers: Users,
  coupons: TicketPercent,
  settings: Settings,
  auditLogs: History,
};

export interface AdminNavItem {
  href: string;
  label: string;
  section: string;
}

/**
 * Admin navigation. Vertical list on desktop; a horizontally scrollable strip on small
 * screens so the content is not pushed below a full-height menu. Visibility here is a
 * convenience only — every page and API route re-checks the role on the server.
 */
export function AdminNav({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin sections" className="-mx-1 md:mx-0">
      <ul className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-1 md:pb-0 px-1 md:px-0 snap-x">
        {items.map((item) => {
          const Icon = ICONS[item.section] ?? LayoutDashboard;
          const active = item.href === "/admin" ? pathname === "/admin" : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="shrink-0 snap-start">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 md:gap-3 px-3 py-2.5 min-h-11 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                  active
                    ? "bg-brand-600/20 text-white border border-brand-500/40"
                    : "text-slate-300 hover:text-white hover:bg-slate-800/70 border border-transparent"
                }`}
              >
                <Icon size={16} className={active ? "text-brand-300" : "text-brand-400"} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
