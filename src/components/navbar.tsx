import { cache } from "react";
import Link from "next/link";
import { Heart, ShoppingBag, User as UserIcon } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCategories } from "@/modules/catalog/services";
import { getCartToken } from "@/lib/cart-session";
import { AccountMenu } from "./account-header-sign-out";
import { MobileNav } from "./mobile-nav";
import { HeaderSearchOutsideHome, MarketplaceSearch } from "./marketplace-search";
import { MegaMenu } from "./mega-menu";
import { WizzLogo } from "./wizz-logo";
import { MobileDock } from "./mobile-dock";
import { connection } from "next/server";

/** Request-scoped: the header, the mobile dock and pages share one lookup. */
const getHeaderUser = cache(getCurrentUser);

/** Units in the shopper's active cart (signed-in cart, or the guest cart cookie). */
export const getHeaderCartCount = cache(async (): Promise<number> => {
  const user = await getHeaderUser();
  // Guest carts are keyed by the cart cookie, not the auth session cookie
  const where = user?.id
    ? { userId: user.id, status: "ACTIVE" as const }
    : await getCartToken().then((token) => (token ? { sessionToken: token, status: "ACTIVE" as const } : null));
  if (!where) return 0;
  const cart = await prisma.cart.findFirst({ where, include: { items: { select: { quantity: true } } } });
  return cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
});

const navLinkClass =
  "inline-flex items-center min-h-[44px] px-1 text-sm font-medium text-mute hover:text-ink transition-colors whitespace-nowrap";
const roundButtonClass =
  "size-11 rounded-full border border-line bg-white text-ink flex items-center justify-center hover:border-ink transition-colors flex-shrink-0";

export async function Navbar() {
  // Render per request: never query the database while `next build` prerenders
  await connection();
  const [user, cartItemCount, categoryRows] = await Promise.all([
    getHeaderUser(),
    getHeaderCartCount(),
    getCategories(),
  ]);

  // Active categories; counts include only publicly listed products
  const allCategories = categoryRows.slice(0, 15);
  const searchCategories = allCategories.map((c) => ({ id: c.id, name: c.name, slug: c.slug }));
  const drawerCategories = (() => {
    const withProducts = allCategories.filter((c) => c._count.products > 0);
    return (withProducts.length > 0 ? withProducts : allCategories).slice(0, 10);
  })();

  const isPlatformAdmin = Boolean(user && user.role !== "CUSTOMER");

  let sellerWorkspaceLink: string | null = null;
  if (user?.id) {
    const membership = await prisma.sellerMembership.findFirst({
      where: { userId: user.id },
      include: { sellerOrg: { select: { id: true, operationalStatus: true } } },
    });
    if (membership?.sellerOrg) {
      sellerWorkspaceLink =
        membership.sellerOrg.operationalStatus === "ACTIVE" ? "/seller/portal" : "/seller/onboarding";
    }
  }

  const cartLabel = `Cart, ${cartItemCount} item${cartItemCount === 1 ? "" : "s"}`;
  const countText = cartItemCount > 99 ? "99+" : String(cartItemCount);

  return (
    <header className="sticky top-0 z-50 bg-canvas border-b border-line">
      <div className="mx-auto max-w-[1360px] px-5 md:px-10">
        <div className="flex items-center gap-3 md:gap-5 lg:gap-8 py-3 md:py-4">
          {/* Left: menu (small screens) + logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <MobileNav
              categories={drawerCategories}
              user={user ? { id: user.id, firstName: user.firstName, role: user.role } : null}
              sellerWorkspaceLink={sellerWorkspaceLink}
              isPlatformAdmin={isPlatformAdmin}
            />
            <WizzLogo size="md" />
          </div>

          {/* Primary navigation (desktop) */}
          <nav aria-label="Main" className="hidden lg:flex items-center gap-6 flex-shrink-0">
            <Link href="/products" className={`${navLinkClass} text-ink`}>
              Shop all
            </Link>
            <MegaMenu categories={allCategories} />
            <Link href="/products?deals=true" className={navLinkClass}>
              Deals
            </Link>
            {sellerWorkspaceLink ? (
              <Link href={sellerWorkspaceLink} className={navLinkClass}>
                Seller Center
              </Link>
            ) : (
              <Link href="/sell" className={navLinkClass}>
                Sell on WIZZ.PK
              </Link>
            )}
          </nav>

          {/* Search pill (tablet and up; phones get their own row below) */}
          <div className="hidden md:block flex-1 min-w-0 lg:max-w-[460px] lg:ml-auto">
            <MarketplaceSearch categories={searchCategories} />
          </div>

          {/* Right: saved, account, cart */}
          <div className="flex items-center gap-2 ml-auto md:ml-0 flex-shrink-0">
            <Link
              href="/wishlist"
              aria-label="Saved items"
              className={`${roundButtonClass} hidden md:flex`}
            >
              <Heart size={18} strokeWidth={1.6} aria-hidden="true" />
            </Link>

            <div className="hidden md:block">
              {user ? (
                <AccountMenu
                  firstName={user.firstName}
                  sellerWorkspaceLink={sellerWorkspaceLink}
                  isPlatformAdmin={isPlatformAdmin}
                />
              ) : (
                <Link href="/login" aria-label="Sign in or create an account" className={roundButtonClass}>
                  <UserIcon size={18} strokeWidth={1.6} aria-hidden="true" />
                </Link>
              )}
            </div>

            {/* Cart: ink pill on tablet/desktop, round icon on phones */}
            <Link
              href="/cart"
              aria-label={cartLabel}
              className="relative flex items-center justify-center gap-2 h-11 min-w-11 rounded-full bg-ink text-white px-3 md:px-5 text-sm font-medium hover:bg-ink-2 transition-colors flex-shrink-0"
            >
              <ShoppingBag size={17} strokeWidth={1.8} aria-hidden="true" />
              <span className="hidden md:inline" aria-hidden="true">
                Cart
              </span>
              <span
                aria-hidden="true"
                className={`min-w-[22px] h-[22px] px-1.5 rounded-full bg-volt text-ink font-mono text-[11px] leading-none flex items-center justify-center tabular-nums ${
                  cartItemCount > 0 ? "" : "hidden"
                }`}
              >
                {countText}
              </span>
            </Link>
            {/* Announce cart changes (after add to cart the header re-renders) */}
            <span className="sr-only" aria-live="polite" aria-atomic="true">
              {cartLabel}
            </span>
          </div>
        </div>

        {/* Phone search row (the homepage hero has its own large search) */}
        <HeaderSearchOutsideHome categories={searchCategories} showCategorySelect={false} className="md:hidden pb-3" />
      </div>
    </header>
  );
}

/** Mobile dock for the storefront layout; place it after the footer (it renders its own spacer). */
export async function StorefrontDock() {
  // Render per request: never query the database while `next build` prerenders
  await connection();
  const [user, cartCount] = await Promise.all([getHeaderUser(), getHeaderCartCount()]);
  return <MobileDock cartCount={cartCount} signedIn={Boolean(user)} />;
}
