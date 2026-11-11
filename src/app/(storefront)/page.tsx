import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { SITE_CONFIG } from "@/lib/config";
import { getCommerceSettings } from "@/lib/commerce-settings";
import { getCategories, publicProductWhere } from "@/modules/catalog/services";
import { isDealLive } from "@/modules/sellers/deal-pricing";
import { HomeCategoryRow } from "@/components/home-category-row";
import { HomeHero, type HeroCategoryCard } from "@/components/home-hero";
import { HomeDealsStrip } from "@/components/home-deals-strip";
import { HomeJustListed } from "@/components/home-just-listed";
import { HomePromiseCards } from "@/components/home-promise-cards";
import type { HomeTileProduct } from "@/components/home-product-tile";

export const metadata: Metadata = {
  title: { absolute: "WIZZ.PK — Shop online, pay cash on delivery across Pakistan" },
  description:
    "Shop new products from verified sellers on WIZZ.PK and pay in cash when your order arrives. Delivery across Pakistan.",
  alternates: { canonical: SITE_CONFIG.canonicalUrl },
};

/** Storefront-visible products that also have at least one photo. */
const listedWhere = { ...publicProductWhere, media: { some: {} } } satisfies Prisma.ProductWhereInput;

const tileSelect = {
  id: true,
  slug: true,
  title: true,
  featured: true,
  createdAt: true,
  category: { select: { slug: true } },
  sellerOrg: { select: { name: true, city: true } },
  media: { orderBy: { displayOrder: "asc" }, select: { url: true, altText: true, isThumbnail: true } },
  variants: {
    where: { isActive: true },
    select: {
      priceMinor: true,
      compareAtPriceMinor: true,
      dealPriceMinor: true,
      dealStartsAt: true,
      dealEndsAt: true,
      inventoryLevel: { select: { availableUnits: true, reservedUnits: true, lowStockThreshold: true } },
    },
  },
} satisfies Prisma.ProductSelect;

type TileRow = Prisma.ProductGetPayload<{ select: typeof tileSelect }>;

const LISTING_SIZE = 54;
const DEALS_SIZE = 12;

/** Short age label: 5m, 3h, 2d, 3w, 4mo, 1y. */
function ageLabel(createdAt: Date, now: number) {
  const minutes = Math.max(1, Math.floor((now - createdAt.getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

/** Same price rules as ProductCard: lowest active price, first compare-at, real markdown only. */
function toTile(p: TileRow, now: number): HomeTileProduct {
  const lowest = p.variants.length > 0 ? Math.min(...p.variants.map((v) => v.priceMinor)) : null;
  const compareAt = p.variants.find((v) => v.compareAtPriceMinor)?.compareAtPriceMinor ?? null;
  const isMarkdown = lowest !== null && compareAt !== null && compareAt > lowest;
  const discountPercent = isMarkdown ? Math.round(((compareAt! - lowest!) / compareAt!) * 100) : 0;
  const sellable = p.variants.reduce(
    (sum, v) => sum + (v.inventoryLevel ? Math.max(0, v.inventoryLevel.availableUnits - v.inventoryLevel.reservedUnits) : 0),
    0
  );
  const thresholds = p.variants.flatMap((v) => (v.inventoryLevel ? [v.inventoryLevel.lowStockThreshold] : []));
  const image = p.media.find((m) => m.isThumbnail) ?? p.media[0];

  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    imageUrl: image?.url ?? null,
    imageAlt: image?.altText || p.title,
    priceMinor: lowest,
    compareAtMinor: isMarkdown ? compareAt : null,
    discountPercent,
    fromPrice: new Set(p.variants.map((v) => v.priceMinor)).size > 1,
    badge: isMarkdown && discountPercent > 0 ? "deal" : p.featured ? "featured" : null,
    sellerName: p.sellerOrg.name,
    sellerCity: p.sellerOrg.city,
    listedLabel: ageLabel(p.createdAt, now),
    categorySlug: p.category?.slug ?? null,
    sellable,
    lowStockThreshold: thresholds.length > 0 ? Math.max(...thresholds) : 5,
  };
}

/** End of the scheduled deal that is live now on a marked-down variant, if any. */
function liveDealEnd(p: TileRow, now: Date): Date | null {
  const ends = p.variants
    .filter((v) => v.compareAtPriceMinor !== null && v.compareAtPriceMinor > v.priceMinor && isDealLive(v, now))
    .map((v) => v.dealEndsAt!.getTime());
  return ends.length > 0 ? new Date(Math.min(...ends)) : null;
}

export default async function HomePage() {
  const [{ returnWindowDays }, categories, listingRows, dealRows, categoryCovers] = await Promise.all([
    getCommerceSettings(),
    getCategories(),
    prisma.product.findMany({
      where: listedWhere,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: LISTING_SIZE,
      select: tileSelect,
    }),
    prisma.product.findMany({
      where: {
        ...listedWhere,
        variants: { some: { isActive: true, compareAtPriceMinor: { not: null } } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: 48,
      select: tileSelect,
    }),
    // One recent photo per category for the hero category cards
    prisma.product.findMany({
      where: listedWhere,
      distinct: ["categoryId"],
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      select: {
        categoryId: true,
        media: { orderBy: { displayOrder: "asc" }, take: 1, select: { url: true } },
      },
    }),
  ]);

  const nowDate = new Date();
  const now = nowDate.getTime();

  // Deals: real markdowns that are in stock; live scheduled deals first (soonest ending), then biggest cut
  const seenTitles = new Set<string>();
  const deals = dealRows
    .map((row) => ({ row, tile: toTile(row, now), endsAt: liveDealEnd(row, nowDate) }))
    .filter(({ tile }) => tile.discountPercent > 0 && tile.sellable > 0)
    .sort((a, b) => {
      if (a.endsAt && b.endsAt) return a.endsAt.getTime() - b.endsAt.getTime();
      if (a.endsAt || b.endsAt) return a.endsAt ? -1 : 1;
      return b.tile.discountPercent - a.tile.discountPercent;
    })
    .filter(({ tile }) => (seenTitles.has(tile.title) ? false : (seenTitles.add(tile.title), true)))
    .slice(0, DEALS_SIZE);
  const soonestEnd = deals.find((d) => d.endsAt)?.endsAt ?? null;
  const dealTiles = deals.map((d) => d.tile);

  const listing = listingRows.map((row) => toTile(row, now));

  // Hero photo: the top deal, else a featured in-stock product, else the newest in-stock product
  const heroProduct =
    dealTiles.find((t) => t.imageUrl) ??
    listing.find((t) => t.badge === "featured" && t.sellable > 0 && t.imageUrl) ??
    listing.find((t) => t.sellable > 0 && t.imageUrl) ??
    null;

  const withProducts = categories.filter((c) => c._count.products > 0);
  const rowCategories = (withProducts.length > 0 ? withProducts : categories).slice(0, 14);
  const byCount = [...withProducts].sort((a, b) => b._count.products - a._count.products);
  const coverByCategory = new Map(categoryCovers.map((c) => [c.categoryId, c.media[0]?.url ?? null]));
  const topCategories: HeroCategoryCard[] = byCount.slice(0, 2).map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    productCount: c._count.products,
    imageUrl: c.imageUrl || coverByCategory.get(c.id) || null,
  }));

  // Pills only for categories that appear in the listing, in catalogue order
  const listedSlugs = new Set(listing.map((p) => p.categorySlug).filter(Boolean));
  const pillCategories = categories.filter((c) => listedSlugs.has(c.slug)).map((c) => ({ slug: c.slug, name: c.name }));

  return (
    <div className="mx-auto flex max-w-[1360px] flex-col gap-10 px-5 pt-5 pb-4 md:gap-14 md:px-10 md:pt-8">
      <HomeCategoryRow categories={rowCategories} />

      <HomeHero
        product={heroProduct}
        topCategories={topCategories}
        popularCategories={byCount.slice(0, 4)}
        hasDeals={dealTiles.length > 0}
      />

      <HomeDealsStrip products={dealTiles} soonestEndsAt={soonestEnd ? soonestEnd.toISOString() : null} />

      <HomeJustListed products={listing} categories={pillCategories} />

      <HomePromiseCards returnWindowDays={returnWindowDays} />
    </div>
  );
}
