import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SITE_CONFIG } from "@/lib/config";
import {
  ShoppingBag,
  User as UserIcon,
  ShieldCheck,
  Store,
  Truck,
  Heart,
  Package,
  Headphones,
  Zap,
} from "lucide-react";
import { cookies } from "next/headers";
import { MobileNav } from "./mobile-nav";
import { MarketplaceSearch } from "./marketplace-search";
import { DeliveryLocationSelector } from "./delivery-location-modal";
import { MegaMenu } from "./mega-menu";
import { WizzLogo } from "./wizz-logo";

export async function Navbar() {
  const user = await getCurrentUser();
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SITE_CONFIG.sessionCookieName)?.value;

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

  // Fetch active categories with product count for MegaMenu & navigation
  const allCategories = await prisma.category.findMany({
    where: { isActive: true },
    take: 15,
    orderBy: { displayOrder: "asc" },
    include: {
      _count: { select: { products: true } },
    },
  });

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

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-xs">
      {/* 1. Top Utility Strip (Marketplace Style: Shipping, Location, Seller Link, Care) */}
      <div className="bg-slate-950 text-white text-[11px] font-medium py-1.5 px-4 tracking-wide border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Left: Nationwide Guarantee & Location */}
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <Truck size={13} />
              <span>Free Nationwide Delivery over PKR 5,000</span>
            </span>
            <span className="hidden md:inline text-slate-700">•</span>
            <span className="hidden md:inline text-slate-300">Cash on Delivery (COD) Verified</span>
          </div>

          {/* Right: Merchant link, Help desk, Admin portal */}
          <div className="flex items-center gap-4 text-slate-300">
            {sellerWorkspaceLink ? (
              <Link
                href={sellerWorkspaceLink}
                className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
              >
                <Store size={12} />
                <span>Seller Center</span>
              </Link>
            ) : (
              <Link
                href="/sell"
                className="hover:text-emerald-400 transition-colors font-semibold flex items-center gap-1"
              >
                <Store size={12} />
                <span>Become a Seller</span>
              </Link>
            )}

            <span className="text-slate-700">•</span>
            <Link href="/contact" className="hover:text-white transition-colors flex items-center gap-1">
              <Headphones size={12} />
              <span>Customer Care</span>
            </Link>

            {isPlatformAdmin && (
              <>
                <span className="text-slate-700">•</span>
                <Link
                  href="/admin"
                  className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1"
                >
                  <ShieldCheck size={12} />
                  <span>Admin</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2. Main Marketplace Header Row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3">
        <div className="flex items-center justify-between gap-3 sm:gap-6">
          {/* Left: Mobile Nav & Brand Logo */}
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <div className="lg:hidden">
              <MobileNav
                categories={allCategories.slice(0, 6)}
                user={user ? { id: user.id, firstName: user.firstName, role: user.role } : null}
                sellerWorkspaceLink={sellerWorkspaceLink}
                isPlatformAdmin={Boolean(isPlatformAdmin)}
              />
            </div>

            <WizzLogo size="md" />

            {/* Delivery Location Selector (Desktop) */}
            <div className="hidden lg:block border-l border-slate-200 pl-3 ml-2">
              <DeliveryLocationSelector />
            </div>
          </div>

          {/* Center: Prominent Marketplace Search Bar (Desktop/Tablet) */}
          <div className="hidden sm:flex flex-1 max-w-2xl mx-auto">
            <MarketplaceSearch categories={searchCategories} />
          </div>

          {/* Right Action Icons & Badges */}
          <div className="flex items-center gap-1.5 sm:gap-4 flex-shrink-0">
            {/* User Account / Sign In */}
            {user ? (
              <Link
                href="/account"
                className="flex items-center gap-2 py-1 px-2.5 rounded-xl hover:bg-slate-100 transition-colors text-left min-h-[44px]"
              >
                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                  <UserIcon size={16} />
                </div>
                <div className="hidden md:block leading-tight">
                  <span className="block text-[10px] text-slate-500 font-medium">Hello, {user.firstName}</span>
                  <span className="block text-xs font-bold text-slate-900">Account & Lists</span>
                </div>
              </Link>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-2 py-1 px-2.5 rounded-xl hover:bg-slate-100 transition-colors text-left min-h-[44px]"
              >
                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                  <UserIcon size={16} />
                </div>
                <div className="hidden md:block leading-tight">
                  <span className="block text-[10px] text-slate-500 font-medium">Welcome</span>
                  <span className="block text-xs font-bold text-emerald-700">Sign In / Join</span>
                </div>
              </Link>
            )}

            {/* Returns & Orders (Amazon / Daraz style) */}
            <Link
              href={user ? "/account" : "/login"}
              className="hidden lg:flex flex-col justify-center py-1 px-2.5 rounded-xl hover:bg-slate-100 transition-colors text-left min-h-[44px]"
              title="Track and manage orders"
            >
              <span className="block text-[10px] text-slate-500 font-medium">Returns</span>
              <span className="block text-xs font-bold text-slate-900">& Orders</span>
            </Link>

            {/* Shopping Cart Button */}
            <Link
              href="/cart"
              aria-label="Shopping Cart"
              className="flex items-center gap-2 py-1 px-2.5 sm:px-3 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 transition-colors group min-h-[44px]"
            >
              <div className="relative">
                <ShoppingBag size={20} className="text-slate-800 group-hover:text-emerald-700 transition-colors" />
                <span
                  aria-live="polite"
                  aria-atomic="true"
                  className={`absolute -top-2 -right-2 bg-emerald-600 text-white font-extrabold text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center shadow-xs transition-transform ${
                    cartItemCount > 0 ? "scale-100" : "scale-0"
                  }`}
                >
                  {cartItemCount > 99 ? "99+" : cartItemCount}
                </span>
              </div>
              <div className="hidden sm:block text-left leading-none">
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Cart</span>
                <span className="block text-xs font-bold text-slate-900 group-hover:text-emerald-700 mt-0.5">
                  {cartItemCount > 0 ? `${cartItemCount} item${cartItemCount === 1 ? "" : "s"}` : "PKR 0"}
                </span>
              </div>
            </Link>
          </div>
        </div>

        {/* Mobile Search Row (Immediately Accessible on screens < 640px) */}
        <div className="sm:hidden mt-2 pt-2 border-t border-slate-100">
          <MarketplaceSearch categories={searchCategories} />
        </div>
      </div>

      {/* 3. Sub-Navigation Bar: Mega-Menu & Key Departments */}
      <div className="bg-slate-50 border-t border-slate-200/80 px-4 sm:px-6 lg:px-8 py-1.5 hidden md:block">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Left: Mega Menu + Department Links */}
          <div className="flex items-center gap-3 overflow-x-auto py-0.5 text-xs font-semibold text-slate-700">
            <MegaMenu categories={allCategories} />

            <Link
              href="/products?sort=featured"
              className="flex items-center gap-1.5 text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 py-1.5 px-3 rounded-lg font-bold transition-colors whitespace-nowrap"
            >
              <Zap size={13} className="text-emerald-600" />
              <span>Flash Deals</span>
            </Link>

            <Link
              href="/products"
              className="hover:text-emerald-600 hover:bg-slate-200/50 py-1.5 px-2.5 rounded-lg transition-colors whitespace-nowrap"
            >
              All Products
            </Link>

            {allCategories.slice(0, 6).map((c) => (
              <Link
                key={c.id}
                href={`/categories/${c.slug}`}
                className="hover:text-emerald-600 hover:bg-slate-200/50 py-1.5 px-2.5 rounded-lg transition-colors whitespace-nowrap"
              >
                {c.name}
              </Link>
            ))}
          </div>

          {/* Right: Quick Delivery Note */}
          <div className="hidden xl:flex items-center gap-2 text-[11px] text-slate-500 font-medium whitespace-nowrap">
            <ShieldCheck size={13} className="text-emerald-600" />
            <span>100% Verified Specifications</span>
          </div>
        </div>
      </div>
    </header>
  );
}
