"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatAmount, formatCurrency, formatEstimatedDelivery } from "@/lib/formatters";
import { RatingStars } from "./ui/rating";
import { Store, ShieldCheck, Package, ShoppingCart, Check, Truck, Loader2 } from "lucide-react";
import { SITE_CONFIG } from "@/lib/config";

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
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
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
  const lowestPriceMinor = Math.min(...product.variants.map((v) => v.priceMinor));
  const compareAtMinor = product.variants.find((v) => v.compareAtPriceMinor)?.compareAtPriceMinor;
  const hasDiscount = Boolean(compareAtMinor && compareAtMinor > lowestPriceMinor);
  const discountPercent = hasDiscount
    ? Math.round(((compareAtMinor! - lowestPriceMinor) / compareAtMinor!) * 100)
    : 0;

  // Live net sellable stock across variants
  const totalStock = product.variants.reduce((sum, v) => {
    const level = v.inventoryLevel;
    if (!level) return sum;
    return sum + Math.max(0, level.availableUnits - level.reservedUnits);
  }, 0);
  const isOutOfStock = totalStock === 0;

  const isWizzDirect = product.sellerOrg?.slug === "wizz-pk-direct";
  const hasMultipleVariants = product.variants.length > 1;

  // Genuine average rating, shown only when reviews exist
  const reviewCount = product.reviews?.length || 0;
  const avgRating =
    reviewCount > 0
      ? Math.round((product.reviews!.reduce((acc, r) => acc + r.rating, 0) / reviewCount) * 10) / 10
      : null;

  const isFreeDelivery = lowestPriceMinor >= SITE_CONFIG.shipping.freeShippingThresholdMinor;
  const productHref = `/products/${product.slug}`;

  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Products with options need a variant choice on the product page
    if (hasMultipleVariants) {
      router.push(productHref);
      return;
    }

    const singleVariant = product.variants[0];
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
    <article className="group relative flex flex-col h-full bg-white rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-[0_6px_18px_-8px_rgba(15,23,42,0.18)] transition-[box-shadow,border-color] duration-200 overflow-hidden">
      {/* Media */}
      <div className="relative">
        <Link
          href={productHref}
          className="relative block aspect-square w-full bg-slate-100 overflow-hidden"
          tabIndex={-1}
          aria-hidden="true"
        >
          {thumbnail?.url && !imgError ? (
            <img
              ref={imgRef}
              src={thumbnail.url}
              alt=""
              width={360}
              height={360}
              className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04] ${
                isOutOfStock ? "opacity-60 grayscale-[35%]" : ""
              }`}
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300">
              <Package size={40} strokeWidth={1.25} />
            </div>
          )}

          {hasDiscount && (
            <span className="absolute top-2 left-2 bg-rose-600 text-white font-extrabold text-[11px] leading-none px-1.5 py-1 rounded tabular-nums">
              -{discountPercent}%
            </span>
          )}

          {isOutOfStock ? (
            <span className="absolute inset-x-0 bottom-0 bg-slate-900/80 text-white text-[11px] font-bold text-center py-1.5">
              Out of stock
            </span>
          ) : (
            totalStock <= 10 && (
              <span className="absolute bottom-2 left-2 bg-amber-100 text-amber-900 font-bold text-[10px] px-1.5 py-0.5 rounded">
                Only {totalStock} left
              </span>
            )
          )}
        </Link>
        {/* Quick add (desktop hover / keyboard focus) */}
        {!isOutOfStock && (
          <div className="hidden sm:block absolute left-2 right-2 bottom-2 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 focus-within:opacity-100 focus-within:translate-y-0 transition-[opacity,transform] duration-150">
            <button
              type="button"
              onClick={handleQuickAdd}
              disabled={isAdding}
              className={`w-full h-9 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:cursor-wait ${
                justAdded
                  ? "bg-emerald-700 text-white"
                  : addError
                  ? "bg-rose-600 text-white"
                  : "bg-orange-600 hover:bg-orange-700 text-white"
              }`}
            >
              {isAdding ? (
                <Loader2 size={14} className="animate-spin" />
              ) : justAdded ? (
                <Check size={14} />
              ) : (
                <ShoppingCart size={14} />
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
            </button>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex flex-col flex-1 p-2.5 sm:p-3 gap-1">
        <Link href={productHref} className="block">
          <h3 className="text-[13px] sm:text-sm font-medium text-slate-800 leading-snug line-clamp-2 min-h-[2.5em] group-hover:text-emerald-800 transition-colors">
            {product.title}
          </h3>
        </Link>

        {avgRating !== null && (
          <div className="flex items-center gap-1">
            <RatingStars rating={avgRating} size={12} />
            <span className="text-[11px] text-slate-500 tabular-nums">({reviewCount})</span>
          </div>
        )}

        {/* Price */}
        <div className="mt-0.5">
          <p className="flex items-baseline gap-0.5 text-slate-950 tabular-nums">
            {hasMultipleVariants && <span className="text-[11px] text-slate-500 font-medium mr-0.5">From</span>}
            <span className="text-[11px] font-bold">Rs.</span>
            <span className="text-lg sm:text-xl font-extrabold tracking-tight leading-none">
              {formatAmount(lowestPriceMinor)}
            </span>
          </p>
          {hasDiscount && (
            <p className="text-xs text-slate-500 tabular-nums mt-0.5">
              <span className="line-through">{formatCurrency(compareAtMinor!)}</span>
            </p>
          )}
        </div>

        {/* Delivery & seller */}
        <div className="mt-auto pt-1.5 space-y-1 text-[11px] sm:text-xs">
          {!isOutOfStock && (
            <p className="flex items-center gap-1 text-slate-600 truncate">
              <Truck size={12} className="text-emerald-600 flex-shrink-0" />
              {isFreeDelivery ? (
                <span className="truncate">
                  <strong className="font-bold text-emerald-700">Free delivery</strong>{" "}
                  {formatEstimatedDelivery(isWizzDirect ? 2 : 3)}
                </span>
              ) : (
                <span className="truncate">
                  Delivery by <strong className="font-semibold text-slate-800">{formatEstimatedDelivery(isWizzDirect ? 2 : 3)}</strong>
                </span>
              )}
            </p>
          )}
          <p className="flex items-center gap-1 text-slate-500 truncate">
            {isWizzDirect ? (
              <>
                <ShieldCheck size={12} className="text-emerald-600 flex-shrink-0" />
                <span className="truncate font-semibold text-emerald-800">WIZZ Direct</span>
              </>
            ) : (
              <>
                <Store size={12} className="text-slate-400 flex-shrink-0" />
                <span className="truncate">{product.sellerOrg?.name}</span>
              </>
            )}
          </p>
        </div>
      </div>

    </article>
  );
}
