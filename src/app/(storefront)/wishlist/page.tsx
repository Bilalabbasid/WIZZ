import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { formatCurrency } from "@/lib/formatters";
import { getWishlistForUser } from "@/app/api/wishlist/wishlist-data";
import { AccountWishlistList, type WishlistListItem } from "@/components/account-wishlist-list";
import { CATALOG_CONTAINER, CatalogPageHeader } from "@/components/catalog-ui";

export const metadata: Metadata = {
  title: "Saved items",
  robots: { index: false, follow: false },
};

export default async function WishlistPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/wishlist");
  }

  const entries = await getWishlistForUser(user.id);
  const items: WishlistListItem[] = entries.map((e) => ({
    productId: e.productId,
    slug: e.slug,
    title: e.title,
    sellerName: e.sellerName,
    imageUrl: e.imageUrl,
    imageAlt: e.imageAlt,
    priceLabel: e.priceMinor !== null ? formatCurrency(e.priceMinor) : null,
    compareAtLabel:
      e.compareAtPriceMinor !== null && e.priceMinor !== null && e.compareAtPriceMinor > e.priceMinor
        ? formatCurrency(e.compareAtPriceMinor)
        : null,
    available: e.available,
    inStock: e.inStock,
    firstAvailableVariantId: e.firstAvailableVariantId,
  }));

  return (
    <div className={`${CATALOG_CONTAINER} space-y-10 pb-20`}>
      <CatalogPageHeader
        breadcrumb={[
          { label: "Home", href: "/" },
          { label: "Account", href: "/account" },
          { label: "Wishlist" },
        ]}
        title="Wishlist"
        subtitle={
          items.length > 0
            ? `${items.length} saved item${items.length === 1 ? "" : "s"} · prices and stock as they are right now`
            : "Products you save appear here."
        }
      />

      <AccountWishlistList initialItems={items} />
    </div>
  );
}
