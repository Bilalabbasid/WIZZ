import { prisma } from "@/lib/db";

/** Same public-visibility rule the catalog listing uses. */
const PUBLIC_PRODUCT_WHERE = {
  status: "PUBLISHED" as const,
  isApprovedByPlatform: true,
  sellerOrg: { operationalStatus: "ACTIVE" as const },
};

export async function isProductPubliclyVisible(productId: string): Promise<boolean> {
  const product = await prisma.product.findFirst({
    where: { id: productId, ...PUBLIC_PRODUCT_WHERE },
    select: { id: true },
  });
  return Boolean(product);
}

export interface WishlistEntry {
  productId: string;
  slug: string;
  title: string;
  sellerName: string;
  imageUrl: string | null;
  imageAlt: string;
  /** Lowest active variant price, or null when no variant is purchasable. */
  priceMinor: number | null;
  compareAtPriceMinor: number | null;
  /** False when the product was unpublished, rejected, or its seller is not active. Kept so the user can remove it. */
  available: boolean;
  inStock: boolean;
  /** First active variant with sellable stock (cheapest first), used by "Add to cart". */
  firstAvailableVariantId: string | null;
  savedAt: string;
}

/**
 * The user's wishlist, newest first. Products that are no longer publicly visible
 * are returned with `available: false` (no price/stock) instead of being hidden,
 * so the shopper understands why an item disappeared and can remove it.
 */
export async function getWishlistForUser(userId: string): Promise<WishlistEntry[]> {
  const rows = await prisma.wishlistItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      product: {
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          isApprovedByPlatform: true,
          sellerOrg: { select: { name: true, operationalStatus: true } },
          media: { orderBy: { displayOrder: "asc" }, take: 1, select: { url: true, altText: true } },
          variants: {
            where: { isActive: true },
            orderBy: { priceMinor: "asc" },
            select: {
              id: true,
              priceMinor: true,
              compareAtPriceMinor: true,
              inventoryLevel: { select: { availableUnits: true, reservedUnits: true } },
            },
          },
        },
      },
    },
  });

  return rows.map((row) => {
    const p = row.product;
    const available =
      p.status === "PUBLISHED" && p.isApprovedByPlatform && p.sellerOrg.operationalStatus === "ACTIVE";
    const cheapest = p.variants[0];
    const inStockVariant = p.variants.find((v) => {
      const lvl = v.inventoryLevel;
      return lvl ? lvl.availableUnits - lvl.reservedUnits > 0 : false;
    });
    const priced = inStockVariant ?? cheapest;
    const compareAt = priced?.compareAtPriceMinor ?? null;

    return {
      productId: p.id,
      slug: p.slug,
      title: p.title,
      sellerName: p.sellerOrg.name,
      imageUrl: p.media[0]?.url ?? null,
      imageAlt: p.media[0]?.altText || p.title,
      priceMinor: available && priced ? priced.priceMinor : null,
      compareAtPriceMinor: available && priced && compareAt && compareAt > priced.priceMinor ? compareAt : null,
      available,
      inStock: available && Boolean(inStockVariant),
      firstAvailableVariantId: available && inStockVariant ? inStockVariant.id : null,
      savedAt: row.createdAt.toISOString(),
    };
  });
}
