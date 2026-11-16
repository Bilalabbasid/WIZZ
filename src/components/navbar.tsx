import { cache } from "react";
import Link from "next/link";
import { Heart, Plus, ShoppingBag, User as UserIcon } from "lucide-react";
import { cookies } from "next/headers";
import { CITY_COOKIE, normalizeCity } from "@/lib/location";
import { CityPicker } from "./city-picker";
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

const stripLinkClass = "hover:text-white transition-colors";
const roundButtonClass =
  "relative size-11 rounded-full text-ink flex items-center justify-center hover:bg-white transition-colors flex-shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

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

  const sellHref = sellerWorkspaceLink ?? "/sell";
  const shopperCity = normalizeCity((await cookies()).get(CITY_COOKIE)?.value);

  return (
    <header className="sticky top-0 z-50">
      {/* Utility strip */}
      <div className="hidden sm:block bg-ink text-white/70 text-[11px]">
        <div className="mx-auto max-w-[1360px] px-5 md:px-10 h-8 flex items-center justify-between gap-4">
          <CityPicker city={shopperCity} />
          <nav aria-label="Help" className="flex items-center gap-5 flex-shrink-0">
            <span className="hidden md:inline">Cash on delivery across Pakistan</span>
            <Link href="/account" className={stripLinkClass}>
              Track order
            </Link>
            <Link href="/contact" className={stripLinkClass}>
              Help
            </Link>
            {sellerWorkspaceLink && (
              <Link href={sellerWorkspaceLink} className={stripLinkClass}>
                Seller Center
              </Link>
            )}
          </nav>
        </div>
      </div>

      <div className="bg-canvas border-b border-line">
        <div className="mx-auto max-w-[1360px] px-5 md:px-10">
          <div className="flex items-center gap-3 md:gap-4 lg:gap-6 py-3">
            {/* Left: menu (small screens) + logo + categories */}
            <div className="flex items-center gap-2 lg:gap-5 flex-shrink-0">
              <MobileNav
                categories={drawerCategories}
                user={user ? { id: user.id, firstName: user.firstName, role: user.role } : null}
                sellerWorkspaceLink={sellerWorkspaceLink}
                isPlatformAdmin={isPlatformAdmin}
              />
              <WizzLogo size="md" />
              <nav aria-label="Main" className="hidden xl:flex items-center">
                <MegaMenu categories={allCategories} />
              </nav>
            </div>

            {/* Search pill (tablet and up; phones get their own row below) */}
            <div className="hidden md:block flex-1 min-w-0">
              <MarketplaceSearch categories={searchCategories} />
            </div>

            {/* Right: saved, cart, account, sell */}
            <div className="flex items-center gap-1 ml-auto md:ml-0 flex-shrink-0">
              <Link href="/wishlist" aria-label="Saved items" className={`${roundButtonClass} hidden md:flex`}>
                <Heart size={19} strokeWidth={1.6} aria-hidden="true" />
              </Link>

              <Link href="/cart" aria-label={cartLabel} className={roundButtonClass}>
                <ShoppingBag size={19} strokeWidth={1.6} aria-hidden="true" />
                <span
                  aria-hidden="true"
                  className={`absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#E5482E] text-white font-mono text-[10px] leading-none flex items-center justify-center tabular-nums ring-2 ring-canvas ${
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

              <div className="hidden md:block">
                {user ? (
                  <AccountMenu
                    firstName={user.firstName}
                    sellerWorkspaceLink={sellerWorkspaceLink}
                    isPlatformAdmin={isPlatformAdmin}
                  />
                ) : (
                  <Link href="/login" aria-label="Sign in or create an account" className={roundButtonClass}>
                    <UserIcon size={19} strokeWidth={1.6} aria-hidden="true" />
                  </Link>
                )}
              </div>

              <Link
                href={sellHref}
                className="hidden md:inline-flex items-center gap-1.5 h-10 ml-2 px-4 rounded-full bg-volt text-ink text-sm font-semibold border-[1.5px] border-ink hover:brightness-95 transition flex-shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                <Plus size={16} strokeWidth={2.2} aria-hidden="true" />
                {sellerWorkspaceLink ? "Seller Center" : "Sell"}
              </Link>
            </div>
          </div>

          {/* Phone search row (the homepage hero has its own large search) */}
          <HeaderSearchOutsideHome categories={searchCategories} showCategorySelect={false} className="md:hidden pb-3" />
        </div>
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
