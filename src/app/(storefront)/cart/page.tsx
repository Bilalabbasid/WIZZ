import { getCurrentUser } from "@/lib/auth";
import { CatalogBreadcrumb } from "@/components/catalog-ui";
import { getActiveCart } from "@/modules/cart/services";
import { getCartToken } from "@/lib/cart-session";
import { CartView } from "@/components/cart-view";
import { getCommerceSettings } from "@/lib/commerce-settings";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cart",
  robots: { index: false, follow: false },
};

export default async function CartPage() {
  const user = await getCurrentUser();
  // Guests are identified by the cart cookie (the same one /api/cart/items sets)
  const sessionToken = user ? undefined : await getCartToken();
  const cart = await getActiveCart(sessionToken, user?.id);
  const settings = await getCommerceSettings();

  const initialItems = (cart?.items ?? []).map((i) => ({
    id: i.id,
    variantId: i.variantId,
    quantity: i.quantity,
    variant: {
      id: i.variant.id,
      sku: i.variant.sku,
      title: i.variant.title,
      priceMinor: i.variant.priceMinor,
      isPurchasable:
        i.variant.isActive &&
        i.variant.product.status === "PUBLISHED" &&
        i.variant.product.isApprovedByPlatform &&
        i.variant.product.sellerOrg.operationalStatus === "ACTIVE",
      product: {
        title: i.variant.product.title,
        slug: i.variant.product.slug,
        sellerOrg: {
          id: i.variant.product.sellerOrg.id,
          name: i.variant.product.sellerOrg.name,
          slug: i.variant.product.sellerOrg.slug,
        },
        media: i.variant.product.media.map((m) => ({ url: m.url, altText: m.altText })),
      },
      inventoryLevel: i.variant.inventoryLevel
        ? {
            availableUnits: i.variant.inventoryLevel.availableUnits,
            reservedUnits: i.variant.inventoryLevel.reservedUnits,
          }
        : null,
    },
  }));

  return (
    <div className="mx-auto w-full max-w-[1360px] px-5 sm:px-10 py-8 sm:py-10 space-y-8">
      <CatalogBreadcrumb items={[{ label: "Home", href: "/" }, { label: "Cart" }]} />

      <div className="space-y-3">
        <h1 className="text-[clamp(32px,4.5vw,56px)] font-semibold leading-none tracking-[-0.045em] text-ink">
          Cart
        </h1>
        <p className="text-sm text-mute">
          Review your items and apply a voucher. Totals are calculated by our server using current prices and stock.
        </p>
      </div>

      <CartView
        cartId={cart?.id ?? null}
        initialItems={initialItems}
        freeShippingThresholdMinor={settings.freeShippingThresholdMinor}
        standardShippingMinor={settings.standardShippingMinor}
      />
    </div>
  );
}
