import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";
import { AccountAddressBook } from "@/components/account-address-book";
import { AccountProfileForm } from "@/components/account-profile-form";
import { AccountPasswordForm } from "@/components/account-password-form";
import { AccountSignOutButton } from "@/components/account-sign-out-button";
import Link from "next/link";
import type { Metadata } from "next";
import { Package, ChevronRight, ChevronLeft, Heart } from "lucide-react";
import { connection } from "next/server";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

const ORDERS_PER_PAGE = 10;

function parsePage(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 10_000) : 1;
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  // Render per request (never query the database during `next build`)
  await connection();
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/account");
  }

  const requestedPage = parsePage((await searchParams).page);

  const [totalOrders, addresses, wishlistCount] = await Promise.all([
    prisma.customerOrder.count({ where: { customerUserId: user.id } }),
    prisma.address.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefaultShipping: "desc" }, { createdAt: "desc" }],
    }),
    prisma.wishlistItem.count({ where: { userId: user.id } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalOrders / ORDERS_PER_PAGE));
  const page = Math.min(requestedPage, totalPages);

  const orders = await prisma.customerOrder.findMany({
    where: { customerUserId: user.id },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * ORDERS_PER_PAGE,
    take: ORDERS_PER_PAGE,
    select: {
      id: true,
      orderNumber: true,
      createdAt: true,
      status: true,
      totalMinor: true,
      sellerOrders: { select: { id: true, _count: { select: { items: true } } } },
    },
  });

  const firstShown = totalOrders === 0 ? 0 : (page - 1) * ORDERS_PER_PAGE + 1;
  const lastShown = Math.min(page * ORDERS_PER_PAGE, totalOrders);
  const pageHref = (p: number) => (p <= 1 ? "/account#orders" : `/account?page=${p}#orders`);

  return (
    <div className="mx-auto w-full max-w-[1360px] px-5 sm:px-10 py-8 sm:py-10 space-y-10">
      {/* Account Header */}
      <div className="bg-white rounded-[28px] border border-line p-6 sm:p-7 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-xs">
        <div className="flex items-center gap-4 min-w-0">
          <div
            className="w-16 h-16 shrink-0 rounded-[20px] bg-brand-600 text-white font-semibold text-2xl flex items-center justify-center shadow-xs"
            aria-hidden="true"
          >
            {user.firstName[0]}
            {user.lastName[0]}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-ink tracking-tight break-words">
              {user.firstName} {user.lastName}
            </h1>
            <p className="text-xs text-mute mt-0.5 break-all">{user.email}</p>
            {user.isEmailVerified && (
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="success" size="sm">
                  Verified email
                </Badge>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/wishlist"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-medium text-ink-2 hover:bg-canvas focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            <Heart size={15} className="text-rose-500" aria-hidden="true" />
            <span>Wishlist</span>
            {wishlistCount > 0 && (
              <span className="rounded-full bg-canvas px-2 py-0.5 text-[11px] font-bold text-ink-2">
                {wishlistCount}
              </span>
            )}
          </Link>
          <AccountSignOutButton />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Order History (2 cols) */}
        <section id="orders" aria-labelledby="orders-heading" className="lg:col-span-2 space-y-6 scroll-mt-24">
          <div className="flex items-center justify-between gap-3">
            <h2 id="orders-heading" className="text-xl font-bold text-ink flex items-center gap-2">
              <Package size={20} className="text-brand-600" aria-hidden="true" />
              <span>Order History</span>
            </h2>
            <span className="text-xs text-mute font-medium">
              {totalOrders === 0
                ? "No orders yet"
                : `Showing ${firstShown}–${lastShown} of ${totalOrders} order${totalOrders === 1 ? "" : "s"}`}
            </span>
          </div>

          {orders.length === 0 ? (
            <div className="p-8 rounded-[20px] bg-white border border-line text-center space-y-3">
              <p className="text-sm text-mute">You haven&apos;t placed any orders yet.</p>
              <Link
                href="/products"
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-bold text-white hover:bg-brand-700"
              >
                Explore products
              </Link>
            </div>
          ) : (
            <ul className="space-y-4">
              {orders.map((o) => {
                const itemCount = o.sellerOrders.reduce((sum, so) => sum + so._count.items, 0);
                return (
                  <li key={o.id}>
                    <Link
                      href={`/orders/${o.id}`}
                      className="block p-5 rounded-[20px] bg-white border border-line hover:border-brand-300 hover:shadow-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                      <div className="flex items-start justify-between gap-4 pb-3 border-b border-line-soft">
                        <div>
                          <span className="font-semibold text-sm text-ink">{o.orderNumber}</span>
                          <p className="text-[11px] text-mute-2 mt-0.5">{formatDateTime(o.createdAt)}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              o.status === "DELIVERED" ? "success" : o.status === "CANCELLED" ? "danger" : "default"
                            }
                            size="sm"
                          >
                            {statusLabel(o.status)}
                          </Badge>
                          <ChevronRight size={16} className="text-mute-2" aria-hidden="true" />
                        </div>
                      </div>

                      <div className="pt-3 flex items-center justify-between text-xs">
                        <span className="text-mute">
                          {itemCount} item{itemCount === 1 ? "" : "s"} in {o.sellerOrders.length} package
                          {o.sellerOrders.length === 1 ? "" : "s"}
                        </span>
                        <span className="font-semibold text-sm text-brand-700">{formatCurrency(o.totalMinor)}</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {totalPages > 1 && (
            <nav aria-label="Order history pages" className="flex items-center justify-between gap-3">
              {page > 1 ? (
                <Link
                  href={pageHref(page - 1)}
                  className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-line bg-white px-4 text-sm font-medium text-ink-2 hover:bg-canvas"
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                  <span>Newer</span>
                </Link>
              ) : (
                <span />
              )}
              <span className="text-xs text-mute" aria-current="page">
                Page {page} of {totalPages}
              </span>
              {page < totalPages ? (
                <Link
                  href={pageHref(page + 1)}
                  className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-line bg-white px-4 text-sm font-medium text-ink-2 hover:bg-canvas"
                >
                  <span>Older</span>
                  <ChevronRight size={16} aria-hidden="true" />
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </section>

        {/* Right Column: profile, password, address book */}
        <div className="space-y-8">
          <AccountProfileForm
            initialFirstName={user.firstName}
            initialLastName={user.lastName}
            initialPhone={user.phone ?? ""}
            email={user.email}
          />
          <AccountAddressBook initialAddresses={addresses} />
          <AccountPasswordForm />
        </div>
      </div>
    </div>
  );
}
