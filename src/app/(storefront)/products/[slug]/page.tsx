import { notFound } from "next/navigation";
import { serializeJsonLd } from "@/lib/formatters";
import { getProductBySlug, publicProductWhere } from "@/modules/catalog/services";
import { ProductDetailView } from "@/components/product-detail-view";
import { CatalogBreadcrumb, CATALOG_CONTAINER, FOCUS_RING } from "@/components/catalog-ui";
import { CatalogProductTile } from "@/components/catalog-product-tile";
import { SITE_CONFIG } from "@/lib/config";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { getCommerceSettings } from "@/lib/commerce-settings";
import type { Metadata } from "next";

export interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return {
      title: "Product not found",
      robots: { index: false, follow: false },
    };
  }

  const primaryImage = product.media.find((m) => m.isThumbnail)?.url || product.media[0]?.url;
  const title = product.metaTitle || product.title;
  const description = product.metaDescription || product.description.slice(0, 160);
  const canonicalUrl = `${SITE_CONFIG.canonicalUrl}/products/${product.slug}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "WIZZ.PK",
      images: primaryImage ? [{ url: primaryImage, alt: product.title }] : [],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: primaryImage ? [primaryImage] : [],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
      },
    },
  };
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const [settings, sellerLocation, moreFromSeller] = await Promise.all([
    getCommerceSettings(),
    // Only the seller's city is shown publicly (never the street address)
    prisma.sellerOrg.findUnique({ where: { id: product.sellerOrg.id }, select: { city: true } }),
    // Same public-visibility rule as the catalog, scoped to this seller
    prisma.product.findMany({
      where: {
        ...publicProductWhere,
        sellerOrgId: product.sellerOrg.id,
        id: { not: product.id },
        media: { some: {} },
      },
      take: 4,
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }, { id: "asc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        media: { orderBy: [{ isThumbnail: "desc" }, { displayOrder: "asc" }], take: 1, select: { url: true } },
        variants: {
          where: { isActive: true },
          select: {
            priceMinor: true,
            inventoryLevel: { select: { availableUnits: true, reservedUnits: true } },
          },
        },
      },
    }),
  ]);

  // Calculate authoritative availability & pricing across variants
  const activeVariants = product.variants.filter((v) => v.isActive);
  const hasVariants = activeVariants.length > 0;
  // Guard: Math.min() of an empty list is Infinity, which must never reach JSON-LD
  const lowestPriceMinor = hasVariants ? Math.min(...activeVariants.map((v) => v.priceMinor)) : 0;
  const highestPriceMinor = hasVariants ? Math.max(...activeVariants.map((v) => v.priceMinor)) : 0;
  const totalSellableStock = activeVariants.reduce((sum, v) => {
    return sum + (v.inventoryLevel ? Math.max(0, v.inventoryLevel.availableUnits - v.inventoryLevel.reservedUnits) : 0);
  }, 0);

  const primaryImage = product.media.find((m) => m.isThumbnail)?.url || product.media[0]?.url;
  const allImageUrls = product.media.map((m) => m.url);
  const primarySku = activeVariants[0]?.sku || product.slug;

  // Real review verification for schema: only emit aggregateRating if verified reviews exist
  const approvedReviews = product.reviews;
  let aggregateRating: Record<string, unknown> | undefined = undefined;
  if (approvedReviews.length > 0) {
    const avg = approvedReviews.reduce((sum, r) => sum + r.rating, 0) / approvedReviews.length;
    aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: avg.toFixed(1),
      reviewCount: approvedReviews.length,
      bestRating: "5",
      worstRating: "1",
    };
  }

  const reviewSchema = approvedReviews.slice(0, 5).map((r) => ({
    "@type": "Review",
    reviewRating: {
      "@type": "Rating",
      ratingValue: String(r.rating),
      bestRating: "5",
      worstRating: "1",
    },
    author: {
      "@type": "Person",
      name: `${r.customerUser.firstName} ${r.customerUser.lastName ? r.customerUser.lastName[0] + "." : ""}`,
    },
    datePublished: r.createdAt.toISOString().split("T")[0],
    reviewBody: r.comment,
  }));

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: allImageUrls.length > 0 ? allImageUrls : primaryImage ? [primaryImage] : undefined,
    sku: primarySku,
    brand: product.brand ? { "@type": "Brand", name: product.brand.name } : undefined,
    // Offers only when there is something purchasable to describe
    offers: !hasVariants
      ? undefined
      : activeVariants.length > 1
      ? {
          "@type": "AggregateOffer",
          priceCurrency: SITE_CONFIG.defaultCurrency,
          lowPrice: (lowestPriceMinor / 100).toFixed(2),
          highPrice: (highestPriceMinor / 100).toFixed(2),
          offerCount: activeVariants.length,
          availability: totalSellableStock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          seller: { "@type": "Organization", name: product.sellerOrg.name },
          url: `${SITE_CONFIG.canonicalUrl}/products/${product.slug}`,
        }
      : {
          "@type": "Offer",
          priceCurrency: SITE_CONFIG.defaultCurrency,
          price: (lowestPriceMinor / 100).toFixed(2),
          availability: totalSellableStock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          seller: { "@type": "Organization", name: product.sellerOrg.name },
          url: `${SITE_CONFIG.canonicalUrl}/products/${product.slug}`,
        },
    aggregateRating,
    review: reviewSchema.length > 0 ? reviewSchema : undefined,
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: SITE_CONFIG.canonicalUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Products",
        item: `${SITE_CONFIG.canonicalUrl}/products`,
      },
      ...(product.category
        ? [
            {
              "@type": "ListItem",
              position: 3,
              name: product.category.name,
              item: `${SITE_CONFIG.canonicalUrl}/categories/${product.category.slug}`,
            },
            {
              "@type": "ListItem",
              position: 4,
              name: product.title,
              item: `${SITE_CONFIG.canonicalUrl}/products/${product.slug}`,
            },
          ]
        : [
            {
              "@type": "ListItem",
              position: 3,
              name: product.title,
              item: `${SITE_CONFIG.canonicalUrl}/products/${product.slug}`,
            },
          ]),
    ],
  };

  // The listing supports ?seller=<slug> (getProducts' sellerOrgSlug filter)
  const sellerListingHref = `/products?seller=${encodeURIComponent(product.sellerOrg.slug)}`;

  return (
    <div className={`${CATALOG_CONTAINER} pb-44 md:pb-24`}>
      {/* Schema.org Product & BreadcrumbList JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />

      <div className="pt-4">
        <CatalogBreadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Products", href: "/products" },
            ...(product.category ? [{ label: product.category.name, href: `/categories/${product.category.slug}` }] : []),
            { label: product.title },
          ]}
        />
      </div>

      <div className="pt-7">
        <ProductDetailView
          product={product}
          freeShippingThresholdMinor={settings.freeShippingThresholdMinor}
          standardShippingMinor={settings.standardShippingMinor}
          expressShippingMinor={settings.expressShippingMinor}
          codMaxOrderMinor={settings.codMaxOrderMinor}
          returnWindowDays={settings.returnWindowDays}
          sellerCity={sellerLocation?.city ?? null}
          sellerListingHref={sellerListingHref}
        />
      </div>

      {moreFromSeller.length > 0 && (
        <section aria-labelledby="more-from-seller" className="mt-16 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="more-from-seller" className="text-[28px] font-semibold leading-tight tracking-[-0.035em] text-ink">
              More from {product.sellerOrg.name}
            </h2>
            <Link
              href={sellerListingHref}
              className={`inline-flex min-h-11 items-center rounded-full text-sm font-medium text-ink underline underline-offset-[3px] hover:text-ink-2 ${FOCUS_RING}`}
            >
              View all from this seller
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-5 md:grid-cols-4">
            {moreFromSeller.map((p) => {
              const prices = p.variants.map((v) => v.priceMinor);
              const stock = p.variants.reduce(
                (sum, v) => sum + (v.inventoryLevel ? Math.max(0, v.inventoryLevel.availableUnits - v.inventoryLevel.reservedUnits) : 0),
                0
              );
              return (
                <li key={p.id}>
                  <CatalogProductTile
                    href={`/products/${p.slug}`}
                    title={p.title}
                    imageUrl={p.media[0]?.url ?? null}
                    priceMinor={prices.length > 0 ? Math.min(...prices) : null}
                    fromPrice={new Set(prices).size > 1}
                    outOfStock={prices.length > 0 && stock === 0}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
