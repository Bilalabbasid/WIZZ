import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getUserOrders } from "@/modules/orders/services";
import { prisma } from "@/lib/db";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AccountAddressBook } from "@/components/account-address-book";
import Link from "next/link";
import type { Metadata } from "next";
import {
  User as UserIcon,
  Package,
  MapPin,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Plus,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Account Dashboard | WIZZ.PK",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/account");
  }

  const [orders, addresses] = await Promise.all([
    getUserOrders(user.id),
    prisma.address.findMany({
      where: { userId: user.id },
      orderBy: { isDefaultShipping: "desc" },
    }),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Account Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-7 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600 text-white font-extrabold text-2xl flex items-center justify-center shadow-xs">
            {user.firstName[0]}
            {user.lastName[0]}
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {user.firstName} {user.lastName}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="neutral" size="sm">
                Role: {user.role.replace("PLATFORM_", "")}
              </Badge>
              {user.isEmailVerified && (
                <Badge variant="success" size="sm">
                  Verified Account
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <form action="/api/auth/logout" method="POST">
            <Button variant="outline" size="sm" type="submit" className="text-slate-600 hover:text-rose-600">
              <LogOut size={15} />
              <span>Sign Out</span>
            </Button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Order History (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Package size={20} className="text-emerald-600" />
              <span>Order History</span>
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              {orders.length} total purchase{orders.length === 1 ? "" : "s"}
            </span>
          </div>

          {orders.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center space-y-3">
              <p className="text-sm text-slate-500">You haven't placed any orders yet.</p>
              <Link href="/products" className="inline-block">
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                  Explore Products
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((o) => (
                <Link
                  key={o.id}
                  href={`/orders/${o.id}`}
                  className="block p-5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-xs transition-all"
                >
                  <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100">
                    <div>
                      <span className="font-extrabold text-sm text-slate-900">
                        {o.orderNumber}
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {formatDateTime(o.createdAt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          o.status === "DELIVERED"
                            ? "success"
                            : o.status === "CANCELLED"
                            ? "danger"
                            : "default"
                        }
                        size="sm"
                      >
                        {o.status.replace("_", " ")}
                      </Badge>
                      <ChevronRight size={16} className="text-slate-400" />
                    </div>
                  </div>

                  <div className="pt-3 flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      {o.sellerOrders.reduce((sum, so) => sum + so.items.length, 0)} item(s) across{" "}
                      {o.sellerOrders.length} package(s)
                    </span>
                    <span className="font-black text-sm text-emerald-700">
                      {formatCurrency(o.totalMinor)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Address Book (1 col) */}
        <div>
          <AccountAddressBook initialAddresses={addresses} />
        </div>
      </div>
    </div>
  );
}
