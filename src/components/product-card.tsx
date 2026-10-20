"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatCurrency, formatEstimatedDelivery } from "@/lib/formatters";
import { Badge } from "./ui/badge";
import { RatingStars } from "./ui/rating";
import {
  Store,
  ShieldCheck,
  Banknote,
  Package,
  Heart,
  ShoppingCart,
  Check,
  Truck,
} from "lucide-react";
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
}

export function ProductCard({ product }: ProductCardProps) {
  const [isWishlisted, setIsWishlisted] = useState<boolean>(false);
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [justAdded, setJustAdded] = useState<boolean>(false);
  const [imgError, setImgError] = useState<boolean>(false);

  const thumbnail = product.media.find((m) => m.isThumbnail) || product.media[0];
  const lowestPriceMinor = Math.min(...product.variants.map((v) => v.priceMinor));
  const compareAtMinor = product.variants.find((v) => v.compareAtPriceMinor)?.compareAtPriceMinor;

  // Calculate percentage discount
  let discountPercent = 0;
  if (compareAtMinor && compareAtMinor > lowestPriceMinor) {
    discountPercent = Math.round(((compareAtMinor - lowestPriceMinor) / compareAtMinor) * 100);
  }

  // Calculate live net sellable stock across variants
  const totalStock = product.variants.reduce((sum, v) => {
    const level = v.inventoryLevel;
    if (!level) return sum;
    return sum + Math.max(0, level.availableUnits - level.reservedUnits);
  }, 0);

  const isWizzDirect = product.sellerOrg?.slug === "wizz-pk-direct";
  const hasMultipleVariants = product.variants.length > 1;

  // Calculate genuine average rating only if reviews exist
  const reviewCount = product.reviews?.length || 0;
  const avgRating =
    reviewCount > 0
      ? Math.round(
          (product.reviews!.reduce((acc, r) => acc + r.rating, 0) / reviewCount) * 10
        ) / 10
      : null;

  const isFreeDelivery = lowestPriceMinor >= SITE_CONFIG.shipping.freeShippingThresholdMinor;

  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // If multiple variants exist, redirect to product detail page to pick variant
    if (hasMultipleVariants) {
      window.location.href = `/products/${product.slug}`;
      return;
    }

    const singleVariant = product.variants[0];
    if (!singleVariant || totalStock <= 0) return;

    setIsAdding(true);
    try {
      const res = await fetch("/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId: singleVariant.id, quantity: 1 }),
      });
      if (res.ok) {
        setJustAdded(true);
        setTimeout(() => setJustAdded(false), 2000);
      }
    } catch {
      // Fallback
    } finally {
      setIsAdding(false);
    }
  };

  const toggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsWishlisted(!isWishlisted);
  };

  return (
    <div className="group bg-white rounded-xl border border-slate-200/90 hover:border-slate-300 hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col h-full relative">
      {/* 1. Media Container (Strict 1:1 Aspect Ratio) */}
      <Link
        href={`/products/${product.slug}`}
        className="relative aspect-square w-full bg-slate-50 overflow-hidden block border-b border-slate-100"
      >
        {thumbnail?.url && !imgError ? (
          <img
            src={thumbnail.url}
            alt={thumbnail.altText || product.title}
            width={360}
            height={360}
            className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-slate-50 text-slate-400 text-center select-none">
            <div className="w-10 h-10 rounded-xl bg-slate-200/70 flex items-center justify-center text-slate-500 mb-2">
              <Package size={20} />
            </div>
            <span className="text-[10px] sm:text-xs font-semibold text-slate-600 line-clamp-1 max-w-[90%]">
              {product.title}
            </span>
            <span className="text-[9px] text-emerald-700 font-bold mt-0.5 uppercase tracking-wider">
              Verified Hardware
            </span>
          </div>
        )}

        {/* Top Badges Left: Discount & Stock */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
          {discountPercent > 0 && (
            <span className="bg-rose-600 text-white font-black text-[10px] sm:text-xs px-1.5 py-0.5 rounded shadow-xs">
              -{discountPercent}%
            </span>
          )}

          {totalStock > 0 && totalStock <= 10 && (
            <span className="bg-amber-500 text-white font-bold text-[9px] px-1.5 py-0.5 rounded shadow-xs">
              Only {totalStock} left
            </span>
          )}

          {totalStock === 0 && (
            <span className="bg-slate-800 text-white font-bold text-[9px] px-1.5 py-0.5 rounded shadow-xs">
              Out of stock
            </span>
          )}
        </div>

        {/* Top Right: Wishlist Button (Min 44x44px touch target) */}
        <button
          type="button"
          onClick={toggleWishlist}
          className="absolute top-1 right-1 z-10 w-11 h-11 flex items-center justify-center rounded-full text-slate-400 hover:text-rose-600 transition-colors focus-visible:ring-2 focus-visible:ring-rose-500"
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          <span className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center shadow-xs hover:bg-white transition-colors">
            <Heart
              size={15}
              className={isWishlisted ? "fill-rose-600 text-rose-600" : ""}
            />
          </span>
        </button>

        {/* Quick Add Button on Desktop Hover */}
        {totalStock > 0 && (
          <div className="absolute bottom-2 left-2 right-2 z-10 hidden sm:block opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              type="button"
              onClick={handleQuickAdd}
              disabled={isAdding}
              className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold shadow-md flex items-center justify-center gap-1.5 transition-colors ${
                justAdded
                  ? "bg-emerald-700 text-white"
                  : "bg-slate-900 hover:bg-emerald-600 text-white"
              }`}
            >
              {justAdded ? (
                <>
                  <Check size={14} />
                  <span>Added to Cart!</span>
                </>
              ) : hasMultipleVariants ? (
                <>
                  <ShoppingCart size={13} />
                  <span>Select Options</span>
                </>
              ) : (
                <>
                  <ShoppingCart size={13} />
                  <span>Add to Cart</span>
                </>
              )}
            </button>
          </div>
        )}
      </Link>

      {/* 2. Content Block (Marketplace Typography) */}
      <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
        <div>
          {/* Category & Seller Identity */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
            <span className="font-medium text-slate-500 truncate max-w-[50%]">
              {product.category?.name || "Hardware"}
            </span>

            <span className="flex items-center gap-1 font-semibold text-slate-700 text-[10px] sm:text-[11px] truncate max-w-[50%]">
              {isWizzDirect ? (
                <>
                  <ShieldCheck size={12} className="text-emerald-600 flex-shrink-0" />
                  <span className="text-emerald-700 truncate">WIZZ Direct</span>
                </>
              ) : (
                <>
                  <Store size={11} className="text-slate-400 flex-shrink-0" />
                  <span className="truncate">{product.sellerOrg?.name}</span>
                </>
              )}
            </span>
          </div>

          {/* Title */}
          <Link href={`/products/${product.slug}`} className="block">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 hover:text-emerald-700 transition-colors line-clamp-2 leading-tight">
              {product.title}
            </h3>
          </Link>

          {/* Variant pill if multiple variants exist */}
          {hasMultipleVariants && (
            <span className="inline-block text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded mt-1 font-medium">
              {product.variants.length} options available
            </span>
          )}
        </div>

        {/* Pricing, Delivery, and Ratings */}
        <div className="pt-2 border-t border-slate-100 space-y-1">
          {/* Price Block */}
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-sm sm:text-base font-black text-slate-900 tracking-tight tabular-nums">
              {formatCurrency(lowestPriceMinor)}
            </span>

            {compareAtMinor && compareAtMinor > lowestPriceMinor && (
              <span className="text-xs text-slate-400 line-through tabular-nums">
                {formatCurrency(compareAtMinor)}
              </span>
            )}
          </div>

          {/* Genuine Rating / Review Count */}
          <div className="flex items-center justify-between text-[11px] pt-0.5">
            {avgRating !== null ? (
              <div className="flex items-center gap-1">
                <RatingStars rating={avgRating} size={11} />
                <span className="text-[10px] text-slate-500 font-bold">({reviewCount})</span>
              </div>
            ) : (
              <span className="text-[10px] text-slate-400 font-medium">
                Verified Item
              </span>
            )}

            {/* Delivery / COD indicator */}
            <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
              {isFreeDelivery ? (
                <span className="flex items-center gap-0.5 text-emerald-700">
                  <Truck size={10} />
                  <span>Free Delivery</span>
                </span>
              ) : (
                <span className="flex items-center gap-0.5 text-slate-600">
                  <Banknote size={10} />
                  <span>COD</span>
                </span>
              )}
            </div>
          </div>

          {/* Delivery Date Promise */}
          <div className="flex items-center gap-1.5 text-[10.5px] text-slate-600 pt-1 border-t border-slate-100/80">
            <Truck size={11} className="text-emerald-600 flex-shrink-0" />
            <span className="truncate">
              Get it by <strong className="font-bold text-slate-800">{formatEstimatedDelivery(isWizzDirect ? 2 : 3)}</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
