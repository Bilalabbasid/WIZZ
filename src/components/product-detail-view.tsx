"use client";

import React, { useState } from "react";
import { formatCurrency, formatDate, formatEstimatedDelivery } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RatingStars } from "@/components/ui/rating";
import {
  ShieldCheck,
  Truck,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Store,
  ShoppingBag,
  Check,
  Banknote,
  Clock,
  MapPin,
} from "lucide-react";

export interface VariantType {
  id: string;
  sku: string;
  title: string;
  priceMinor: number;
  compareAtPriceMinor?: number | null;
  attributesJson: string;
  inventoryLevel?: {
    availableUnits: number;
    reservedUnits: number;
  } | null;
}

export interface ProductDetailProps {
  product: {
    id: string;
    title: string;
    slug: string;
    description: string;
    weightGrams: number;
    category?: { name: string; slug: string };
    brand?: { name: string } | null;
    sellerOrg?: {
      id: string;
      name: string;
      slug: string;
      operationalStatus: string;
    };
    media: Array<{ url: string; altText?: string | null; isThumbnail?: boolean }>;
    variants: VariantType[];
    reviews: Array<{
      id: string;
      rating: number;
      title?: string | null;
      comment: string;
      isVerifiedPurchase: boolean;
      createdAt: Date | string;
      customerUser: { firstName: string; lastName: string };
    }>;
  };
}

export function ProductDetailView({ product }: ProductDetailProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    product.variants[0]?.id || ""
  );
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [isBuyingNow, setIsBuyingNow] = useState<boolean>(false);
  const [addedSuccess, setAddedSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deliveryCity, setDeliveryCity] = useState<string>("Karachi");
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem("wizz_delivery_city");
      if (stored) {
        setDeliveryCity(stored);
      }
    } catch {
      // LocalStorage not available
    }
  }, []);

  const selectedVariant =
    product.variants.find((v) => v.id === selectedVariantId) || product.variants[0];

  const netStock = selectedVariant?.inventoryLevel
    ? Math.max(
        0,
        selectedVariant.inventoryLevel.availableUnits -
          selectedVariant.inventoryLevel.reservedUnits
      )
    : 0;

  const isOutOfStock = netStock <= 0;
  const isLowStock = netStock > 0 && netStock <= 10;
  const isWizzDirect = product.sellerOrg?.slug === "wizz-pk-direct";

  // Calculate genuine average rating only from submitted reviews
  const reviewCount = product.reviews.length;
  const avgRating =
    reviewCount > 0
      ? Math.round(
          (product.reviews.reduce((acc, r) => acc + r.rating, 0) / reviewCount) * 10
        ) / 10
      : null;

  // Parse variant attributes
  let parsedAttrs: Record<string, string> = {};
  try {
    parsedAttrs = JSON.parse(selectedVariant?.attributesJson || "{}");
  } catch {
    parsedAttrs = {};
  }

  // Handle Add to Cart
  const handleAddToCart = async (redirectToCheckout = false) => {
    if (!selectedVariant) return;
    if (redirectToCheckout) {
      setIsBuyingNow(true);
    } else {
      setIsAdding(true);
    }
    setErrorMessage(null);

    try {
      const res = await fetch("/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId: selectedVariant.id,
          quantity,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add item to cart.");
      }

      setAddedSuccess(true);
      setTimeout(() => setAddedSuccess(false), 3000);

      if (redirectToCheckout) {
        window.location.href = "/checkout";
      } else {
        window.location.href = "/cart";
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Error adding to cart.");
    } finally {
      setIsAdding(false);
      setIsBuyingNow(false);
    }
  };

  const images = product.media.length > 0 ? product.media : [{ url: "", altText: product.title }];
  const currentImage = images[activeImageIndex] || images[0];

  const discountPercent =
    selectedVariant.compareAtPriceMinor && selectedVariant.compareAtPriceMinor > selectedVariant.priceMinor
      ? Math.round(
          ((selectedVariant.compareAtPriceMinor - selectedVariant.priceMinor) /
            selectedVariant.compareAtPriceMinor) *
            100
        )
      : null;

  return (
    <div className="space-y-12">
      {/* 3-Column Desktop Marketplace Layout (5 cols / 4 cols / 3 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* 1. Media Gallery (Left 5 cols on lg) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="aspect-square bg-white rounded-2xl border border-slate-200 overflow-hidden relative shadow-xs">
            {currentImage.url && !failedImages[activeImageIndex] ? (
              <img
                src={currentImage.url}
                alt={currentImage.altText || product.title}
                className="w-full h-full object-cover"
                onError={() =>
                  setFailedImages((prev) => ({ ...prev, [activeImageIndex]: true }))
                }
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-slate-50 text-slate-400 text-center select-none">
                <span className="text-sm font-bold text-slate-700 mb-1">{product.title}</span>
                <span className="text-xs text-emerald-700 font-semibold uppercase tracking-wider">
                  Verified Authentic Hardware
                </span>
              </div>
            )}

            {discountPercent && discountPercent > 0 && !isOutOfStock && (
              <span className="absolute top-3 left-3 bg-rose-600 text-white font-extrabold text-xs px-2.5 py-1 rounded-md shadow-sm">
                -{discountPercent}% OFF
              </span>
            )}

            {isOutOfStock && (
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center">
                <span className="bg-rose-600 text-white font-black text-sm px-4 py-2 rounded-xl shadow-lg">
                  CURRENTLY OUT OF STOCK
                </span>
              </div>
            )}
          </div>

          {/* Thumbnail Selector */}
          {images.length > 1 && (
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImageIndex(idx)}
                  className={`w-16 h-16 rounded-xl border-2 overflow-hidden flex-shrink-0 transition-all ${
                    activeImageIndex === idx
                      ? "border-emerald-600 shadow-xs ring-2 ring-emerald-100"
                      : "border-slate-200 hover:border-slate-300 opacity-70 hover:opacity-100"
                  }`}
                >
                  {!failedImages[idx] ? (
                    <img
                      src={img.url}
                      alt={img.altText || `View ${idx + 1}`}
                      className="w-full h-full object-cover"
                      onError={() =>
                        setFailedImages((prev) => ({ ...prev, [idx]: true }))
                      }
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-400 font-bold">
                      #{idx + 1}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Trust Guarantee Strip */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 flex items-start gap-2.5 text-xs">
              <ShieldCheck size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-800">100% Authentic</p>
                <p className="text-[11px] text-slate-500">Verified manufacturer hardware</p>
              </div>
            </div>
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 flex items-start gap-2.5 text-xs">
              <RotateCcw size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-800">30-Day Return</p>
                <p className="text-[11px] text-slate-500">Inspection & refund policy</p>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Center Column: Product Details & Specifications (4 cols on lg) */}
        <div className="lg:col-span-4 space-y-5">
          <div>
            {/* Brand & Category Breadcrumbs */}
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5 flex-wrap">
              {product.brand && (
                <span className="font-bold text-slate-700 uppercase tracking-wider">
                  Brand: {product.brand.name}
                </span>
              )}
              {product.brand && <span>•</span>}
              <span className="font-medium text-slate-600">{product.category?.name}</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
              {product.title}
            </h1>

            {/* Rating Summary (Genuine reviews only) */}
            <div className="flex items-center gap-2.5 mt-2">
              {avgRating !== null ? (
                <>
                  <RatingStars rating={avgRating} size={14} showNumeric />
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs text-slate-600 font-semibold">
                    {reviewCount} verified review{reviewCount === 1 ? "" : "s"}
                  </span>
                </>
              ) : (
                <span className="text-xs font-semibold text-slate-500">
                  Authentic Verified Listing
                </span>
              )}
            </div>
          </div>

          {/* Pricing Highlight */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-2xl sm:text-3xl font-black text-slate-900">
                {formatCurrency(selectedVariant.priceMinor)}
              </span>
              {selectedVariant.compareAtPriceMinor &&
                selectedVariant.compareAtPriceMinor > selectedVariant.priceMinor && (
                  <span className="text-sm font-semibold text-slate-400 line-through">
                    {formatCurrency(selectedVariant.compareAtPriceMinor)}
                  </span>
                )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              All prices in PKR. Tax and final shipping calculated at checkout.
            </p>
          </div>

          {/* Variant Selection */}
          {product.variants.length > 1 && (
            <div className="space-y-2 pt-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Available Variations:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {product.variants.map((v) => {
                  const isSelected = v.id === selectedVariantId;
                  const vStock = v.inventoryLevel
                    ? Math.max(0, v.inventoryLevel.availableUnits - v.inventoryLevel.reservedUnits)
                    : 0;

                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariantId(v.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        isSelected
                          ? "border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600 shadow-xs"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <span className="font-semibold text-xs text-slate-900 truncate">{v.title}</span>
                      <span className="text-xs font-bold text-slate-800 mt-1">
                        {formatCurrency(v.priceMinor)}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5">
                        {vStock > 0 ? `${vStock} in stock` : "Sold out"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Product Overview Description */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Product Overview
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
              {product.description}
            </p>
          </div>

          {/* Technical Specifications */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Technical Specifications
            </h4>
            <div className="rounded-xl border border-slate-200 overflow-hidden text-xs">
              <div className="grid grid-cols-2 p-2 bg-slate-50 border-b border-slate-200">
                <span className="text-slate-500 font-medium">SKU</span>
                <span className="font-mono font-semibold text-slate-800">{selectedVariant.sku}</span>
              </div>
              <div className="grid grid-cols-2 p-2 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Package Weight</span>
                <span className="font-semibold text-slate-800">{product.weightGrams}g</span>
              </div>
              {Object.entries(parsedAttrs).map(([key, value]) => (
                <div key={key} className="grid grid-cols-2 p-2 border-b border-slate-200 last:border-b-0">
                  <span className="text-slate-500 font-medium capitalize">{key}</span>
                  <span className="font-semibold text-slate-800">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3. Right Column: Dedicated Marketplace Buy Box / Purchase Panel (3 cols on lg) */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4 lg:sticky lg:top-28">
            {/* Price in Buy Box */}
            <div>
              <span className="text-2xl font-black text-slate-900 block">
                {formatCurrency(selectedVariant.priceMinor)}
              </span>
              <span className="text-xs text-emerald-700 font-semibold block mt-0.5">
                Free Delivery over PKR 5,000
              </span>
            </div>

            {/* Delivery Location & Window */}
            <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 text-slate-600">
                <MapPin size={14} className="text-emerald-600 shrink-0" />
                <span className="truncate">
                  Deliver to <strong className="text-slate-900">{deliveryCity}</strong>
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100 text-xs">
                <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                  <Truck size={14} className="text-emerald-600 shrink-0" />
                  <span>Get it by {formatEstimatedDelivery(isWizzDirect ? 2 : 3)}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 pl-5">
                  Order within 4 hrs with tracked courier dispatch (TCS / Leopards)
                </p>
              </div>
            </div>

            {/* Stock Status Indicator */}
            <div className="pt-1">
              {isOutOfStock ? (
                <Badge variant="danger" size="md">
                  <AlertTriangle size={13} />
                  <span>Currently Unavailable</span>
                </Badge>
              ) : isLowStock ? (
                <div className="text-xs font-bold text-amber-700 flex items-center gap-1.5">
                  <Clock size={13} />
                  <span>Only {netStock} left in stock – order soon</span>
                </div>
              ) : (
                <div className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 size={14} />
                  <span>In Stock ({netStock} available)</span>
                </div>
              )}
            </div>

            {/* Quantity Selector */}
            <div className="space-y-1">
              <label htmlFor="buybox-qty" className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Quantity:
              </label>
              <select
                id="buybox-qty"
                value={quantity}
                disabled={isOutOfStock}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full text-xs font-semibold rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100"
              >
                {Array.from({ length: Math.min(10, Math.max(1, netStock)) }).map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </div>

            {/* Primary Action Buttons: Add to Cart + Buy Now */}
            <div className="space-y-2 pt-1">
              <Button
                size="md"
                onClick={() => handleAddToCart(false)}
                disabled={isOutOfStock || isAdding || isBuyingNow}
                isLoading={isAdding}
                className="w-full shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 text-xs"
              >
                {addedSuccess ? (
                  <>
                    <Check size={16} />
                    <span>Added to Cart!</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag size={16} />
                    <span>{isOutOfStock ? "Out of Stock" : "Add to Cart"}</span>
                  </>
                )}
              </Button>

              <Button
                size="md"
                variant="secondary"
                onClick={() => handleAddToCart(true)}
                disabled={isOutOfStock || isAdding || isBuyingNow}
                isLoading={isBuyingNow}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-11 text-xs shadow-xs"
              >
                <span>Buy Now</span>
              </Button>
            </div>

            {errorMessage && (
              <p className="text-xs font-semibold text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                {errorMessage}
              </p>
            )}

            {/* Seller & Protection Info */}
            <div className="pt-3 border-t border-slate-100 space-y-2 text-[11px] text-slate-600">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Ships from</span>
                <span className="font-semibold text-slate-800">
                  {isWizzDirect ? "WIZZ.PK Direct" : product.sellerOrg?.name || "Verified Seller"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Sold by</span>
                <span className="font-semibold text-slate-800">
                  {isWizzDirect ? "WIZZ.PK Official" : product.sellerOrg?.name || "Partner Store"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Payment</span>
                <span className="font-semibold text-emerald-700 flex items-center gap-1">
                  <Banknote size={12} />
                  <span>Cash on Delivery</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Returns</span>
                <span className="font-semibold text-slate-800">30-Day Guarantee</span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-[10px] text-emerald-900 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
              <span>15-minute transactional inventory hold active at checkout</span>
            </div>
          </div>
        </div>
      </div>

      {/* Verified Reviews Section (Genuine reviews only) */}
      <section className="pt-8 border-t border-slate-200 space-y-5">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">
            Customer Reviews ({reviewCount})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Reviews are submitted exclusively by verified buyers after order delivery.
          </p>
        </div>

        {product.reviews.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {product.reviews.map((rev) => (
              <div key={rev.id} className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-slate-900">
                      {rev.customerUser.firstName} {rev.customerUser.lastName}
                    </span>
                    {rev.isVerifiedPurchase && (
                      <Badge variant="success" size="sm">Verified Buyer</Badge>
                    )}
                  </div>
                  <RatingStars rating={rev.rating} size={12} />
                </div>
                {rev.title && <h4 className="font-bold text-xs text-slate-800">{rev.title}</h4>}
                <p className="text-xs text-slate-600 leading-relaxed">{rev.comment}</p>
                <p className="text-[10px] text-slate-400">{formatDate(rev.createdAt)}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
            No customer reviews submitted yet. Be the first verified buyer to leave feedback after delivery.
          </div>
        )}
      </section>

      {/* Mobile Sticky Add-to-Cart Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 sm:hidden shadow-lg flex items-center justify-between gap-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-slate-500 font-medium truncate max-w-[150px]">
            {selectedVariant?.title || product.title}
          </p>
          <p className="text-base font-black text-slate-900 leading-tight">
            {formatCurrency(selectedVariant?.priceMinor || 0)}
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => handleAddToCart(false)}
          disabled={isOutOfStock || isAdding || isBuyingNow}
          isLoading={isAdding}
          className="flex-1 max-w-[170px] shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 text-xs"
        >
          {addedSuccess ? (
            <>
              <Check size={16} />
              <span>Added!</span>
            </>
          ) : (
            <>
              <ShoppingBag size={16} />
              <span>{isOutOfStock ? "Sold Out" : "Add to Cart"}</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
