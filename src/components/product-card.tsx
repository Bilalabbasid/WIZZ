"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/formatters";
import { Package, ShoppingCart, Check, Loader2, Star } from "lucide-react";
import { SITE_CONFIG } from "@/lib/config";
import { WishlistButton } from "./wishlist-button";
import { FOCUS_RING, MONO_LABEL } from "./catalog-ui";

export interface ProductCardProps {
  product: {
    id: string;
    title: string;
    slug: string;
    category?: { name: string; slug: string };
    brand?: { name: string } | null;
    sellerOrg?: { name: string; slug: string };
    media: Array<{ url: string; altText?: string | null; isThumbnail?: boolean }>;
    variants: Array<{
      id: string;
      title?: string;
      priceMinor: number;
      compareAtPriceMinor?: number | null;
      inventoryLevel?: { availableUnits: number; reservedUnits: number } | null;
    }>;
    reviews?: Array<{ rating: number }>;
  };
  /** Use eager loading for cards rendered above the fold. */
  priority?: boolean;
  /** Free-delivery threshold from admin commerce settings (passed by the server page). */
  freeShippingThresholdMinor?: number;
}

const LOW_STOCK_UNITS = 10;

function sellable(level?: { availableUnits: number; reservedUnits: number } | null) {
  return level ? Math.max(0, level.availableUnits - level.reservedUnits) : 0;
}

function discountPercent(priceMinor: number, compareAtMinor?: number | null) {
  if (!compareAtMinor || compareAtMinor <= priceMinor) return 0;
  return Math.round(((compareAtMinor - priceMinor) / compareAtMinor) * 100);
}

export function ProductCard({
  product,
  priority = false,
  freeShippingThresholdMinor = SITE_CONFIG.shipping.freeShippingThresholdMinor,
}: ProductCardProps) {
  const router = useRouter();
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [justAdded, setJustAdded] = useState<boolean>(false);
  const [addError, setAddError] = useState<boolean>(false);
  const [imgError, setImgError] = useState<boolean>(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // An image can fail before hydration attaches onError; catch that case on mount.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setImgError(true);
  }, []);

  const thumbnail = product.media.find((m) => m.isThumbnail) || product.media[0];
  const variants = product.variants;
  const hasVariants = variants.length > 0;

  // The variant shown on the card is the cheapest one; its own compare-at price is the only one struck through.
  const shownVariant = hasVariants
    ? variants.reduce((min, v) => (v.priceMinor < min.priceMinor ? v : min), variants[0])
    : undefined;
  const lowestPriceMinor = shownVariant?.priceMinor ?? 0;
  const pricesDiffer = hasVariants && variants.some((v) => v.priceMinor !== lowestPriceMinor);
  const shownDiscount = shownVariant ? discountPercent(shownVariant.priceMinor, shownVariant.compareAtPriceMinor) : 0;
  const bestDiscount = variants.reduce((best, v) => Math.max(best, discountPercent(v.priceMinor, v.compareAtPriceMinor)), 0);

  // Live net sellable stock across variants
  const totalStock = variants.reduce((sum, v) => sum + sellable(v.inventoryLevel), 0);
  const isOutOfStock = totalStock === 0;
  const isLowStock = !isOutOfStock && totalStock <= LOW_STOCK_UNITS;
  const hasMultipleVariants = variants.length > 1;

  // Genuine average rating, shown only when reviews exist
  const reviewCount = product.reviews?.length || 0;
  const avgRating =
    reviewCount > 0
      ? Math.round((product.reviews!.reduce((acc, r) => acc + r.rating, 0) / reviewCount) * 10) / 10
      : null;

  const isFreeDelivery = hasVariants && !isOutOfStock && lowestPriceMinor >= freeShippingThresholdMinor;
  const productHref = `/products/${product.slug}`;
  const sellerName = product.sellerOrg?.name ?? SITE_CONFIG.flagshipSellerName;

  // One honest status tag: availability first, then a real price reduction, then stock level.
  let tag: { text: string; label: string; highlight?: boolean };
  if (!hasVariants) {
    tag = { text: "Unavailable", label: "Currently unavailable" };
  } else if (isOutOfStock) {
    tag = { text: "Out of stock", label: "Out of stock" };
  } else if (bestDiscount > 0) {
    const upTo = shownDiscount !== bestDiscount;
    tag = {
      text: `${upTo ? "Up to " : ""}−${bestDiscount}%`,
      label: `${upTo ? "Up to " : ""}${bestDiscount}% off`,
      highlight: true,
    };
  } else if (isLowStock) {
    tag = { text: "Low stock", label: `Low stock, ${totalStock} left` };
  } else {
    tag = { text: "In stock", label: "In stock" };
  }

  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Products with options need a variant choice on the product page
    if (hasMultipleVariants) {
      router.push(productHref);
      return;
    }

    const singleVariant = variants[0];
    if (!singleVariant || isOutOfStock) return;

    setIsAdding(true);
    setAddError(false);
    try {
      const res = await fetch("/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId: singleVariant.id, quantity: 1 }),
      });
      if (!res.ok) throw new Error("Add to cart failed");
      setJustAdded(true);
      // Re-render server components so the header cart count updates
      router.refresh();
      setTimeout(() => setJustAdded(false), 2000);
    } catch {
      setAddError(true);
      setTimeout(() => setAddError(false), 3000);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <article className="group relative flex flex-col gap-3.5">
      {/* Photo */}
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[20px] bg-sand">
        {thumbnail?.url && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imgRef}
            src={thumbnail.url}
            alt=""
            width={400}
            height={500}
            className={`h-full w-full object-cover motion-safe:transition-[opacity,transform] motion-safe:duration-300 group-hover:opacity-90 motion-safe:group-hover:scale-[1.015] ${
              isOutOfStock ? "opacity-55 grayscale-[30%]" : ""
            }`}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-mute-2" aria-hidden="true">
            <Package size={40} strokeWidth={1.25} />
          </div>
        )}

        {(isOutOfStock || !hasVariants) && (
          <span className={`absolute bottom-3 left-3 rounded-full bg-ink px-2.5 py-1 text-white ${MONO_LABEL}`} aria-hidden="true">
            {hasVariants ? "Out of stock" : "Unavailable"}
          </span>
        )}

        {/* Quick add (pointer devices: hover or keyboard focus reveals it) */}
        {!isOutOfStock && hasVariants && (
          <div className="absolute inset-x-3 bottom-3 z-10 hidden opacity-0 group-hover:opacity-100 focus-within:opacity-100 motion-safe:transition-opacity motion-safe:duration-150 sm:block">
            <button
              type="button"
              onClick={handleQuickAdd}
              disabled={isAdding}
              className={`flex h-11 w-full items-center justify-center gap-2 rounded-full text-[13px] font-medium transition-colors disabled:cursor-wait ${FOCUS_RING} ${
                addError ? "bg-rose-600 text-white" : justAdded ? "bg-ink text-white" : "bg-white/92 text-ink hover:bg-white"
              }`}
            >
              {isAdding ? (
                <Loader2 size={15} className="motion-safe:animate-spin" aria-hidden="true" />
              ) : justAdded ? (
                <Check size={15} aria-hidden="true" />
              ) : (
                <ShoppingCart size={15} aria-hidden="true" />
              )}
              <span aria-live="polite">
                {isAdding
                  ? "Adding"
                  : justAdded
                  ? "Added to cart"
                  : addError
                  ? "Couldn't add, try again"
                  : hasMultipleVariants
                  ? "Choose options"
                  : "Add to cart"}
              </span>
              <span className="sr-only">: {product.title}</span>
            </button>
          </div>
        )}
      </div>

      <WishlistButton
        productId={product.id}
        productTitle={product.title}
        className="absolute right-3 top-3 z-10"
      />

      {/* Details */}
      <div className="flex flex-col gap-1.5 px-1">
        {/* Title + price share a row once cards are wide enough; on 2-up phone grids the price drops below */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <h3 className="min-w-0 text-[15px] font-semibold leading-snug tracking-[-0.015em] text-ink">
            {/* Stretched link: the whole card is clickable, the accessible name stays the title */}
            <Link
              href={productHref}
              className="line-clamp-2 rounded-sm after:absolute after:inset-0 after:rounded-[20px] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ink focus-visible:after:ring-offset-4 focus-visible:after:ring-offset-canvas"
            >
              {product.title}
            </Link>
          </h3>
          {hasVariants ? (
            <p className="shrink-0 font-mono text-[15px] font-medium leading-snug text-ink sm:text-right">
              {pricesDiffer && <span className="mr-1 font-sans text-[11px] font-normal text-mute">From</span>}
              <span className="whitespace-nowrap">{formatCurrency(lowestPriceMinor)}</span>
              {shownDiscount > 0 && (
                <span className="ml-2 inline-block whitespace-nowrap text-xs font-normal text-mute-2 line-through sm:ml-0 sm:block">
                  <span className="sr-only">Was </span>
                  {formatCurrency(shownVariant!.compareAtPriceMinor!)}
                </span>
              )}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 text-[13px] text-mute">
          <span className="min-w-0 truncate">{sellerName}</span>
          <span
            className={`shrink-0 ${MONO_LABEL} ${
              tag.highlight ? "rounded-full bg-volt px-2 py-0.5 text-ink" : isOutOfStock || !hasVariants ? "text-ink" : "text-mute"
            }`}
            aria-label={tag.label}
          >
            {tag.text}
          </span>
        </div>

        {(avgRating !== null || isFreeDelivery) && (
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-mute">
            {avgRating !== null && (
              <span className="inline-flex items-center gap-1">
                <Star size={12} className="fill-ink text-ink" aria-hidden="true" />
                <span className="font-mono text-ink">{avgRating.toFixed(1)}</span>
                <span>
                  ({reviewCount}
                  <span className="sr-only"> review{reviewCount === 1 ? "" : "s"}</span>)
                </span>
              </span>
            )}
            {avgRating !== null && isFreeDelivery && <span aria-hidden="true">·</span>}
            {isFreeDelivery && <span>Free delivery</span>}
          </p>
        )}
      </div>
    </article>
  );
}
