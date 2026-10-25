import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SITE_CONFIG } from "@/lib/config";
import { formatCurrency } from "@/lib/formatters";
import { getCategories } from "@/modules/catalog/services";
import {
  ShoppingBag,
  User as UserIcon,
  ShieldCheck,
  Store,
  Truck,
  Package,
  Headphones,
  Zap,
  Banknote,
} from "lucide-react";
import { getCartToken } from "@/lib/cart-session";
import { MobileNav } from "./mobile-nav";
import { MarketplaceSearch } from "./marketplace-search";
import { DeliveryLocationSelector } from "./delivery-location-modal";
import { MegaMenu } from "./mega-menu";
import { WizzLogo } from "./wizz-logo";

export async function Navbar() {
  const user = await getCurrentUser();
  // Guest carts are keyed by the cart cookie, not the auth session cookie
  const sessionToken = await getCartToken();

  // Compute cart item count
  let cartItemCount = 0;
  if (user?.id) {
    const cart = await prisma.cart.findFirst({
      where: { userId: user.id, status: "ACTIVE" },
      include: { items: true },
    });
    cartItemCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) || 0;
  } else if (sessionToken) {
    const cart = await prisma.cart.findFirst({
      where: { sessionToken, status: "ACTIVE" },
      include: { items: true },
    });
    cartItemCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) || 0;
  }

  // Active categories; counts include only publicly listed products
  const allCategories = (await getCategories()).slice(0, 15);

  const searchCategories = allCategories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
  }));

  const isPlatformAdmin = user && user.role !== "CUSTOMER";

  let sellerWorkspaceLink: string | null = null;
  if (user?.id) {
    const membership = await prisma.sellerMembership.findFirst({
      where: { userId: user.id },
      include: { sellerOrg: { select: { id: true, operationalStatus: true } } },
    });
    if (membership?.sellerOrg) {
      sellerWorkspaceLink =
        membership.sellerOrg.operationalStatus === "ACTIVE"
          ? "/seller/portal"
          : "/seller/onboarding";
    }
  }

  const freeDeliveryLabel = formatCurrency(SITE_CONFIG.shipping.freeShippingThresholdMinor);
  const accountHref = user ? "/account" : "/login";

  return (
    <header className="sticky top-0 z-50 shadow-sm">
      {/* Tier 1: utility strip */}
      <div className="hidden sm:block bg-brand-ink-deep text-emerald-50/80 text-[11px] font-medium">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1.5">
              <Truck size={13} className="text-emerald-300" />
              <span>Free delivery on orders over {freeDeliveryLabel}</span>
            </span>
            <span className="hidden md:flex items-center gap-1.5">
              <Banknote size={13} className="text-emerald-300" />
              <span>Cash on delivery across Pakistan</span>
            </span>
          </div>

          <nav aria-label="Utility" className="flex items-center gap-5">
            {sellerWorkspaceLink ? (
              <Link
                href={sellerWorkspaceLink}
                className="flex items-center gap-1 text-emerald-300 hover:text-white font-semibold transition-colors"
              >
                <Store size={12} />
                <span>Seller Center</span>
              </Link>
            ) : (
              <Link href="/sell" className="flex items-center gap-1 hover:text-white transition-colors">
                <Store size={12} />
                <span>Sell on WIZZ.PK</span>
              </Link>
            )}
            <Link href="/contact" className="flex items-center gap-1 hover:text-white transition-colors">
              <Headphones size={12} />
              <span>Help &amp; support</span>
            </Link>
            {isPlatformAdmin && (
              <Link
                href="/admin"
                className="flex items-center gap-1 text-amber-300 hover:text-amber-200 font-semibold transition-colors"
              >
                <ShieldCheck size={12} />
                <span>Admin</span>
              </Link>
            )}
          </nav>
        </div>
      </div>

      {/* Tier 2: brand bar with search */}
      <div className="bg-brand-ink text-white">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-2.5">
          <div className="flex items-center gap-2 sm:gap-4 lg:gap-5">
            <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
              <div className="lg:hidden">
                <MobileNav
                  categories={allCategories.slice(0, 6)}
                  user={user ? { id: user.id, firstName: user.firstName, role: user.role } : null}
                  sellerWorkspaceLink={sellerWorkspaceLink}
                  isPlatformAdmin={Boolean(isPlatformAdmin)}
                  tone="dark"
                />
              </div>
              <WizzLogo size="md" theme="light" />
              <div className="hidden lg:block">
                <DeliveryLocationSelector tone="dark" />
              </div>
            </div>

            <div className="hidden sm:flex flex-1 min-w-0">
              <MarketplaceSearch categories={searchCategories} />
            </div>

            <div className="flex items-center gap-0.5 sm:gap-1 ml-auto sm:ml-0 flex-shrink-0">
              <Link
                href={accountHref}
                className="flex items-center gap-2 px-2 rounded-lg hover:bg-white/10 transition-colors min-h-[44px] min-w-[44px] justify-center"
                aria-label={user ? "Your account" : "Sign in or create an account"}
              >
                <UserIcon size={22} strokeWidth={1.75} className="md:hidden" />
                <span className="hidden md:block leading-tight text-left">
                  <span className="block text-[11px] text-emerald-100/75 font-medium">
                    {user ? `Hello, ${user.firstName}` : "Hello, sign in"}
                  </span>
                  <span className="block text-[13px] font-bold">{user ? "Your account" : "Account & join"}</span>
                </span>
              </Link>

              <Link
                href={accountHref}
                className="hidden lg:flex flex-col justify-center px-2 rounded-lg hover:bg-white/10 transition-colors min-h-[44px] leading-tight"
              >
                <span className="block text-[11px] text-emerald-100/75 font-medium">Returns</span>
                <span className="block text-[13px] font-bold">&amp; Orders</span>
              </Link>

              <Link
                href="/cart"
                aria-label={`Cart, ${cartItemCount} item${cartItemCount === 1 ? "" : "s"}`}
                className="flex items-center gap-1.5 px-2 rounded-lg hover:bg-white/10 transition-colors min-h-[44px] min-w-[44px] justify-center"
              >
                <span className="relative">
                  <ShoppingBag size={24} strokeWidth={1.75} />
                  <span
                    aria-live="polite"
                    aria-atomic="true"
                    className={`absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-orange-500 text-white text-[10px] font-extrabold flex items-center justify-center ring-2 ring-brand-ink tabular-nums ${
                      cartItemCount > 0 ? "" : "sr-only"
                    }`}
                  >
                    {cartItemCount > 99 ? "99+" : cartItemCount}
                  </span>
                </span>
                <span className="hidden sm:block text-[13px] font-bold">Cart</span>
              </Link>
            </div>
          </div>

          {/* Mobile search row */}
          <div className="sm:hidden mt-2">
            <MarketplaceSearch categories={searchCategories} />
          </div>
        </div>
      </div>

      {/* Tier 3: department bar */}
      <div className="hidden md:block bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 h-11">
          <MegaMenu categories={allCategories} />
          <nav
            aria-label="Departments"
            className="flex items-center gap-0.5 overflow-x-auto no-scrollbar text-[13px] font-semibold text-slate-700 min-w-0"
          >
            <Link
              href="/products?deals=true"
              className="flex items-center gap-1.5 text-rose-600 hover:bg-rose-50 h-9 px-3 rounded-md transition-colors whitespace-nowrap"
            >
              <Zap size={14} className="fill-rose-600" />
              <span>Deals</span>
            </Link>
            <Link
              href="/products?sort=newest"
              className="flex items-center hover:text-emerald-700 hover:bg-slate-100 h-9 px-3 rounded-md transition-colors whitespace-nowrap"
            >
              New arrivals
            </Link>
            {allCategories.slice(0, 6).map((c) => (
              <Link
                key={c.id}
                href={`/categories/${c.slug}`}
                className="flex items-center hover:text-emerald-700 hover:bg-slate-100 h-9 px-3 rounded-md transition-colors whitespace-nowrap"
              >
                {c.name}
              </Link>
            ))}
          </nav>
          <Link
            href={accountHref}
            className="hidden xl:flex items-center gap-1.5 ml-auto pl-4 text-xs font-semibold text-slate-600 hover:text-emerald-700 whitespace-nowrap"
          >
            <Package size={14} className="text-emerald-600" />
            <span>Track your order</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
