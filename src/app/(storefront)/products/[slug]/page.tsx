import { notFound } from "next/navigation";
import { getProductBySlug } from "@/modules/catalog/services";
import { ProductDetailView } from "@/components/product-detail-view";
import { SITE_CONFIG } from "@/lib/config";
import Link from "next/link";
import { ChevronRight, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

export interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return {
      title: "Product Not Found | WIZZ.PK",
      robots: { index: false, follow: false },
    };
  }

  const primaryImage = product.media.find((m) => m.isThumbnail)?.url || product.media[0]?.url;
  const title = product.metaTitle || `${product.title} | WIZZ.PK`;
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

  // Calculate authoritative availability & pricing across variants
  const activeVariants = product.variants.filter((v) => v.isActive);
  const lowestPriceMinor = Math.min(...activeVariants.map((v) => v.priceMinor));
  const highestPriceMinor = Math.max(...activeVariants.map((v) => v.priceMinor));
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
    offers: {
      "@type": activeVariants.length > 1 ? "AggregateOffer" : "Offer",
      priceCurrency: SITE_CONFIG.defaultCurrency,
      price: (lowestPriceMinor / 100).toFixed(2),
      lowPrice: (lowestPriceMinor / 100).toFixed(2),
      highPrice: (highestPriceMinor / 100).toFixed(2),
      offerCount: activeVariants.length,
      availability: totalSellableStock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      seller: {
        "@type": "Organization",
        name: product.sellerOrg.name,
      },
      priceValidUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Schema.org Product & BreadcrumbList JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Semantic Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-500 overflow-x-auto whitespace-nowrap">
        <Link href="/" className="hover:text-slate-900 transition-colors">Home</Link>
        <ChevronRight size={14} />
        <Link href="/products" className="hover:text-slate-900 transition-colors">Products</Link>
        {product.category && (
          <>
            <ChevronRight size={14} />
            <Link href={`/categories/${product.category.slug}`} className="hover:text-slate-900 transition-colors">
              {product.category.name}
            </Link>
          </>
        )}
        <ChevronRight size={14} />
        <span className="font-semibold text-slate-900 truncate max-w-xs">{product.title}</span>
      </nav>

      {/* Product Detail Main View */}
      <ProductDetailView product={product} />
    </div>
  );
}
