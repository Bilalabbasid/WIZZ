import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { getOrCreateCart } from "@/modules/cart/services";
import { CartView } from "@/components/cart-view";
import { SITE_CONFIG } from "@/lib/config";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shopping Cart | WIZZ.PK",
  robots: { index: false, follow: false },
};

export default async function CartPage() {
  const user = await getCurrentUser();
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SITE_CONFIG.sessionCookieName)?.value;

  const cart = await getOrCreateCart(sessionToken, user?.id);

  // Map to CartItemType
  const initialItems = cart.items.map((i) => ({
    id: i.id,
    variantId: i.variantId,
    quantity: i.quantity,
    variant: {
      id: i.variant.id,
      sku: i.variant.sku,
      title: i.variant.title,
      priceMinor: i.variant.priceMinor,
      product: {
        title: i.variant.product.title,
        slug: i.variant.product.slug,
        sellerOrg: {
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/" className="hover:text-slate-900">Home</Link>
        <ChevronRight size={14} />
        <Link href="/products" className="hover:text-slate-900">Store</Link>
        <ChevronRight size={14} />
        <span className="font-semibold text-slate-900">Shopping Cart</span>
      </nav>

      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Shopping Cart
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Review your items, apply promotional codes, and verify shipping thresholds.
        </p>
      </div>

      <CartView initialItems={initialItems} />
    </div>
  );
}
