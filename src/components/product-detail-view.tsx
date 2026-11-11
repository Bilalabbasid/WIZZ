"use client";

import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatCurrency, formatDate, formatEstimatedDelivery } from "@/lib/formatters";
import { SITE_CONFIG } from "@/lib/config";
import { ProductDescription } from "./product-description";
import { RatingStars } from "@/components/ui/rating";
import { WishlistButton } from "@/components/wishlist-button";
import { FOCUS_RING, MONO_LABEL, PILL_OUTLINE } from "./catalog-ui";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  Clock,
  Expand,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  ShoppingBag,
  Truck,
  X,
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
    /** Product-level specifications (JSON object of label → value). */
    attributesJson?: string;
    lengthMm?: number;
    widthMm?: number;
    heightMm?: number;
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

export interface ProductDetailSettings {
  /** Free-delivery threshold per seller package (admin commerce settings). */
  freeShippingThresholdMinor?: number;
  standardShippingMinor?: number;
  expressShippingMinor?: number;
  /** Largest order total allowed for cash on delivery. */
  codMaxOrderMinor?: number;
  returnWindowDays?: number;
  /** Seller's public city, when known. */
  sellerCity?: string | null;
  /** Listing filtered to this seller. */
  sellerListingHref?: string;
}

function subscribeToStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function readDeliveryCity(): string {
  try {
    return localStorage.getItem("wizz_delivery_city") || "";
  } catch {
    return "";
  }
}

/** Matches the cart's per-line limit (MAX_CART_LINE_QUANTITY). */
const MAX_LINE_QUANTITY = 20;
const LOW_STOCK_UNITS = 10;

function sellable(v?: VariantType) {
  return v?.inventoryLevel ? Math.max(0, v.inventoryLevel.availableUnits - v.inventoryLevel.reservedUnits) : 0;
}

/** Parses a JSON object of specs; only primitive values are shown. */
function parseSpecs(json?: string): Array<[string, string]> {
  if (!json) return [];
  try {
    const value: unknown = JSON.parse(json);
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    return Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => (typeof v === "string" && v.trim() !== "") || typeof v === "number" || typeof v === "boolean")
      .map(([k, v]) => [k, typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)]);
  } catch {
    return [];
  }
}

function humanize(key: string) {
  const s = key.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function initials(name: string) {
  const parts = name.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "W";
}

function formatCm(mm: number) {
  const cm = mm / 10;
  return Number.isInteger(cm) ? String(cm) : cm.toFixed(1);
}

/* ------------------------------------------------------------------------ */
/* Gallery: thumbnail column (strip on mobile), 4:5 photo, fullscreen viewer */
/* ------------------------------------------------------------------------ */

function ProductGallery({
  images,
  title,
}: {
  images: Array<{ url: string; altText?: string | null }>;
  title: string;
}) {
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const dialogRef = useRef<HTMLDialogElement>(null);
  const zoomButtonRef = useRef<HTMLButtonElement>(null);
  const count = images.length;
  const current = images[active] ?? images[0];
  const showable = (i: number) => Boolean(images[i]?.url) && !failed[i];
  const markFailed = (i: number) => setFailed((prev) => ({ ...prev, [i]: true }));
  const step = (dir: 1 | -1) => setActive((i) => (i + dir + count) % count);

  const openViewer = () => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    document.documentElement.style.overflow = "hidden";
  };
  const closeViewer = () => dialogRef.current?.close();

  // Never leave the page scroll-locked if the gallery unmounts while open
  useEffect(() => {
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, []);

  return (
    <div className="flex min-w-0 flex-col-reverse gap-3 lg:flex-row">
      {count > 1 && (
        <div
          role="group"
          aria-label="Product photos"
          className="-mx-1 flex gap-2.5 overflow-x-auto p-1 no-scrollbar lg:mx-0 lg:max-h-[768px] lg:w-[92px] lg:shrink-0 lg:flex-col lg:overflow-y-auto"
        >
          {images.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActive(idx)}
              aria-label={`Show photo ${idx + 1} of ${count}`}
              aria-pressed={active === idx}
              className={`relative h-20 w-16 shrink-0 overflow-hidden rounded-[14px] border-2 bg-sand transition-colors lg:h-[100px] lg:w-[84px] ${FOCUS_RING} ${
                active === idx ? "border-ink" : "border-transparent hover:border-line"
              }`}
            >
              {showable(idx) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img.url} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => markFailed(idx)} />
              ) : (
                <span className="font-mono text-[11px] text-mute">{idx + 1}</span>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="relative aspect-[4/5] w-full min-w-0 overflow-hidden rounded-[20px] bg-sand sm:rounded-[28px] lg:max-h-[760px] lg:flex-1">
        {showable(active) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={active}
            src={current.url}
            alt={current.altText || title}
            className="h-full w-full object-cover"
            onError={() => markFailed(active)}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-6 text-center">
            <span className="text-sm font-semibold text-ink">{title}</span>
            <span className="font-mono text-xs text-mute">Image coming soon</span>
          </div>
        )}

        {count > 1 && (
          <span aria-hidden="true" className="absolute bottom-4 left-4 rounded-full bg-white/92 px-2.5 py-1 font-mono text-xs text-ink">
            {active + 1} / {count}
          </span>
        )}

        {showable(active) && (
          <button
            ref={zoomButtonRef}
            type="button"
            onClick={openViewer}
            aria-haspopup="dialog"
            aria-label="View photo fullscreen"
            className={`absolute bottom-4 right-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/92 text-ink transition-colors hover:bg-white ${FOCUS_RING}`}
          >
            <Expand size={18} strokeWidth={1.7} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Fullscreen viewer (native modal dialog: focus moves in, Escape closes, focus returns) */}
      <dialog
        ref={dialogRef}
        aria-label={`${title}: photo viewer`}
        onClose={() => {
          document.documentElement.style.overflow = "";
          zoomButtonRef.current?.focus();
        }}
        onKeyDown={(e) => {
          if (count < 2) return;
          if (e.key === "ArrowRight") step(1);
          if (e.key === "ArrowLeft") step(-1);
        }}
        className="m-0 h-full max-h-none w-full max-w-none border-0 bg-ink p-0 text-white backdrop:bg-ink/80"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-5 py-4 sm:px-8">
            <span className="font-mono text-xs text-white/70" aria-live="polite">
              Photo {active + 1} of {count}
            </span>
            <button
              type="button"
              onClick={closeViewer}
              aria-label="Close photo viewer"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <div
            className="relative flex min-h-0 flex-1 items-center justify-center px-5 pb-8 sm:px-20"
            onClick={(e) => {
              // Clicking the empty area around the photo closes the viewer
              if (e.target === e.currentTarget) closeViewer();
            }}
          >
            {showable(active) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={current.url}
                alt={current.altText || title}
                className="max-h-full max-w-full rounded-[20px] object-contain"
                onError={() => markFailed(active)}
              />
            ) : (
              <p className="font-mono text-sm text-white/70">This photo could not be loaded.</p>
            )}
            {count > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label="Previous photo"
                  className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-ink hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-ink sm:left-6"
                >
                  <ArrowLeft size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label="Next photo"
                  className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-ink hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-ink sm:right-6"
                >
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        </div>
      </dialog>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function Pill({ children, tone = "outline" }: { children: React.ReactNode; tone?: "outline" | "volt" | "ink" }) {
  const toneClass =
    tone === "volt"
      ? "bg-volt text-ink py-[5px]"
      : tone === "ink"
      ? "bg-ink text-white py-[5px]"
      : "border border-[#CFCFC8] text-ink py-1";
  return <span className={`inline-flex items-center rounded-full px-[9px] ${MONO_LABEL} ${toneClass}`}>{children}</span>;
}

function TrustLine({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-px shrink-0 text-ink" aria-hidden="true">
        {icon}
      </span>
      <p className="text-sm leading-normal text-ink-2">
        <strong className="font-semibold text-ink">{title}</strong> {children}
      </p>
    </div>
  );
}

export function ProductDetailView({
  product,
  freeShippingThresholdMinor = SITE_CONFIG.shipping.freeShippingThresholdMinor,
  standardShippingMinor = SITE_CONFIG.shipping.standardRateMinor,
  expressShippingMinor = SITE_CONFIG.shipping.expressRateMinor,
  codMaxOrderMinor = SITE_CONFIG.cod.maxOrderLimitMinor,
  returnWindowDays = 30,
  sellerCity = null,
  sellerListingHref,
}: ProductDetailProps & ProductDetailSettings) {
  const [selectedVariantId, setSelectedVariantId] = useState<string>(product.variants[0]?.id || "");
  const [quantity, setQuantity] = useState<number>(1);
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [isBuyingNow, setIsBuyingNow] = useState<boolean>(false);
  const [addedSuccess, setAddedSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();
  // City chosen in the header's delivery selector (localStorage); empty on the server.
  const deliveryCity = useSyncExternalStore(subscribeToStorage, readDeliveryCity, () => "");
  // The compact mobile buy bar only appears once the panel's own buttons have scrolled up out of view.
  const actionsRef = useRef<HTMLDivElement>(null);
  const [actionsVisible, setActionsVisible] = useState(true);

  useEffect(() => {
    const el = actionsRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setActionsVisible(entry.isIntersecting || entry.boundingClientRect.top > 0),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const selectedVariant = product.variants.find((v) => v.id === selectedVariantId) || product.variants[0];

  const netStock = sellable(selectedVariant);
  const isOutOfStock = netStock <= 0;
  // Matches the cart's per-line limit; never offer more than can actually be sold.
  const maxQty = Math.min(MAX_LINE_QUANTITY, netStock);
  const effectiveQty = Math.min(Math.max(1, quantity), Math.max(1, maxQty));
  const isLowStock = netStock > 0 && netStock <= LOW_STOCK_UNITS;
  const isWizzDirect = product.sellerOrg?.slug === SITE_CONFIG.flagshipSellerSlug;
  const sellerName = product.sellerOrg?.name || SITE_CONFIG.flagshipSellerName;
  const listingHref =
    sellerListingHref ?? (product.sellerOrg ? `/products?seller=${encodeURIComponent(product.sellerOrg.slug)}` : "/products");

  // Genuine average rating from approved reviews only
  const reviewCount = product.reviews.length;
  const avgRating =
    reviewCount > 0
      ? Math.round((product.reviews.reduce((acc, r) => acc + r.rating, 0) / reviewCount) * 10) / 10
      : null;

  // Add the selected variant to the cart; Buy now then goes straight to checkout.
  const handleAddToCart = async (redirectToCheckout = false) => {
    if (!selectedVariant) return;
    if (redirectToCheckout) setIsBuyingNow(true);
    else setIsAdding(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId: selectedVariant.id,
          quantity: effectiveQty,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to add item to cart.");
      }

      setAddedSuccess(true);
      setTimeout(() => setAddedSuccess(false), 3000);

      router.push(redirectToCheckout ? "/checkout" : "/cart");
      router.refresh();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Error adding to cart.");
    } finally {
      setIsAdding(false);
      setIsBuyingNow(false);
    }
  };

  const images = product.media.length > 0 ? product.media : [{ url: "", altText: product.title }];

  // A published product can momentarily have no active variants (seller disabled them all).
  if (!selectedVariant) {
    return (
      <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-12">
        <div className="min-w-0 lg:flex-[1.3]">
          <ProductGallery images={images} title={product.title} />
        </div>
        <div className="flex min-w-0 flex-col gap-6 lg:max-w-[480px] lg:flex-1">
          <div className="flex flex-wrap gap-2">
            {product.category && <Pill>{product.category.name}</Pill>}
            <Pill tone="ink">Unavailable</Pill>
          </div>
          <h1 className="text-[clamp(32px,4vw,44px)] font-semibold leading-none tracking-[-0.045em] text-ink">{product.title}</h1>
          <div role="status" className="flex items-start gap-3 rounded-[20px] border border-line-soft bg-white p-4 text-sm text-ink-2">
            <AlertTriangle size={18} className="mt-px shrink-0 text-ink" aria-hidden="true" />
            <span>This product is currently unavailable. Save it to your wishlist to find it again later.</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <WishlistButton productId={product.id} productTitle={product.title} variant="full" className="min-w-[200px] flex-1" />
            <Link href={product.category ? `/categories/${product.category.slug}` : "/products"} className={`${PILL_OUTLINE} flex-1`}>
              Browse similar products
            </Link>
          </div>
          <div className="border-t border-line pt-6">
            <ProductDescription text={product.description} />
          </div>
        </div>
      </div>
    );
  }

  const discountPercent =
    selectedVariant.compareAtPriceMinor && selectedVariant.compareAtPriceMinor > selectedVariant.priceMinor
      ? Math.round(
          ((selectedVariant.compareAtPriceMinor - selectedVariant.priceMinor) / selectedVariant.compareAtPriceMinor) * 100
        )
      : null;

  const qualifiesForFreeDelivery = selectedVariant.priceMinor * effectiveQty >= freeShippingThresholdMinor;
  const variantPricesDiffer = product.variants.some((v) => v.priceMinor !== product.variants[0].priceMinor);

  // Details: product specs, then the selected option's attributes, then catalog facts
  const details: Array<{ label: string; value: string; mono?: boolean }> = [];
  const seen = new Set<string>();
  for (const [k, v] of [...parseSpecs(selectedVariant.attributesJson), ...parseSpecs(product.attributesJson)]) {
    const label = humanize(k);
    if (seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    details.push({ label, value: v });
  }
  if (product.brand) details.push({ label: "Brand", value: product.brand.name });
  if (product.category) details.push({ label: "Category", value: product.category.name });
  details.push({ label: "SKU", value: selectedVariant.sku, mono: true });
  if (product.weightGrams > 0) details.push({ label: "Package weight", value: `${product.weightGrams} g` });
  if (product.lengthMm && product.widthMm && product.heightMm) {
    details.push({
      label: "Dimensions",
      value: `${formatCm(product.lengthMm)} × ${formatCm(product.widthMm)} × ${formatCm(product.heightMm)} cm`,
    });
  }

  const busy = isAdding || isBuyingNow;

  return (
    <div>
      <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-12">
        {/* Gallery */}
        <div className="min-w-0 lg:flex-[1.3]">
          <ProductGallery images={images} title={product.title} />
        </div>

        {/* Buy panel */}
        <div className="flex min-w-0 flex-col gap-6 lg:max-w-[480px] lg:flex-1">
          <div className="flex flex-col gap-3.5">
            <div className="flex flex-wrap gap-2">
              {product.category && <Pill>{product.category.name}</Pill>}
              {discountPercent ? <Pill tone="volt">−{discountPercent}%</Pill> : null}
              {isOutOfStock ? (
                <Pill tone="ink">Out of stock</Pill>
              ) : isLowStock ? (
                <Pill>Only {netStock} left</Pill>
              ) : (
                <Pill>In stock</Pill>
              )}
            </div>

            <h1 className="break-words text-[clamp(32px,4vw,44px)] font-semibold leading-none tracking-[-0.045em] text-ink">
              {product.title}
            </h1>

            <div className="flex min-h-6 items-center gap-2 text-[13px] text-mute">
              {avgRating !== null ? (
                <>
                  <RatingStars rating={avgRating} size={14} />
                  <a
                    href="#reviews"
                    className={`rounded-sm text-ink underline-offset-4 hover:underline ${FOCUS_RING}`}
                  >
                    <span className="font-mono">{avgRating.toFixed(1)}</span> · {reviewCount} review{reviewCount === 1 ? "" : "s"}
                  </a>
                </>
              ) : (
                <span>No reviews yet</span>
              )}
            </div>

            <div className="space-y-1">
              <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-[30px] font-medium leading-none tracking-[-0.02em] text-ink">
                  {formatCurrency(selectedVariant.priceMinor)}
                </span>
                {discountPercent ? (
                  <span className="font-mono text-base text-mute-2 line-through">
                    <span className="sr-only">Was </span>
                    {formatCurrency(selectedVariant.compareAtPriceMinor!)}
                  </span>
                ) : null}
                <span className="text-[13px] text-mute">
                  {qualifiesForFreeDelivery ? "Free delivery" : `+ delivery, free over ${formatCurrency(freeShippingThresholdMinor)}`}
                </span>
              </p>
              <p className="text-xs text-mute">Prices in PKR. Tax and delivery are confirmed at checkout.</p>
            </div>
          </div>

          {/* Options */}
          {product.variants.length > 1 && (
            <div className="space-y-2.5">
              <p id="variant-label" className="text-[13px] text-mute">
                Option: <span className="font-medium text-ink">{selectedVariant.title}</span>
              </p>
              <div role="group" aria-labelledby="variant-label" className="flex flex-wrap gap-2">
                {product.variants.map((v) => {
                  const isSelected = v.id === selectedVariant.id;
                  const soldOut = sellable(v) === 0;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        setSelectedVariantId(v.id);
                        // Quantity limits differ per variant: start again at 1.
                        setQuantity(1);
                        setErrorMessage(null);
                      }}
                      aria-pressed={isSelected}
                      className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm transition-colors ${FOCUS_RING} ${
                        isSelected
                          ? "border-ink bg-ink text-white"
                          : `border-line bg-white hover:border-ink ${soldOut ? "text-mute-2" : "text-ink"}`
                      }`}
                    >
                      <span className={soldOut && !isSelected ? "line-through" : ""}>{v.title}</span>
                      {variantPricesDiffer && (
                        <span className={`font-mono text-xs ${isSelected ? "text-white/80" : "text-mute"}`}>
                          {formatCurrency(v.priceMinor)}
                        </span>
                      )}
                      {soldOut && <span className="sr-only">(sold out)</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="flex flex-wrap items-center gap-4">
            <span id="qty-label" className="text-[13px] text-mute">
              Quantity
            </span>
            <div
              role="group"
              aria-labelledby="qty-label"
              className="inline-flex h-12 items-center rounded-full border border-line bg-white p-0.5"
            >
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, effectiveQty - 1))}
                disabled={isOutOfStock || effectiveQty <= 1}
                aria-label="Decrease quantity"
                className={`flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:text-mute-2 disabled:hover:bg-transparent ${FOCUS_RING}`}
              >
                <Minus size={16} aria-hidden="true" />
              </button>
              <output aria-live="polite" aria-label={`Quantity ${effectiveQty}`} className="w-9 text-center font-mono text-[15px] text-ink">
                {effectiveQty}
              </output>
              <button
                type="button"
                onClick={() => setQuantity(Math.min(Math.max(1, maxQty), effectiveQty + 1))}
                disabled={isOutOfStock || effectiveQty >= maxQty}
                aria-label="Increase quantity"
                className={`flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:text-mute-2 disabled:hover:bg-transparent ${FOCUS_RING}`}
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            </div>
            {!isOutOfStock && effectiveQty >= maxQty && (
              <span className="text-xs text-mute">
                {maxQty === MAX_LINE_QUANTITY ? `Up to ${MAX_LINE_QUANTITY} per order` : `${maxQty} available`}
              </span>
            )}
          </div>

          {/* Actions */}
          <div ref={actionsRef} className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => handleAddToCart(true)}
              disabled={isOutOfStock || busy}
              className={`flex h-14 w-full items-center justify-center gap-2 rounded-full bg-ink text-base font-medium text-white transition-colors hover:bg-ink-2 disabled:cursor-not-allowed disabled:bg-mute-2 ${FOCUS_RING}`}
            >
              {isBuyingNow && <Loader2 size={18} className="motion-safe:animate-spin" aria-hidden="true" />}
              <span>{isOutOfStock ? "Out of stock" : isBuyingNow ? "Going to checkout" : "Buy now"}</span>
            </button>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => handleAddToCart(false)}
                disabled={isOutOfStock || busy}
                className={`flex h-[52px] flex-1 items-center justify-center gap-2 rounded-full border border-ink bg-white text-[15px] font-medium text-ink transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:border-line disabled:text-mute-2 disabled:hover:bg-white ${FOCUS_RING}`}
              >
                {isAdding ? (
                  <Loader2 size={18} className="motion-safe:animate-spin" aria-hidden="true" />
                ) : addedSuccess ? (
                  <Check size={18} aria-hidden="true" />
                ) : (
                  <ShoppingBag size={18} strokeWidth={1.7} aria-hidden="true" />
                )}
                <span>{isAdding ? "Adding" : addedSuccess ? "Added to cart" : "Add to cart"}</span>
              </button>
              <WishlistButton productId={product.id} productTitle={product.title} variant="round" />
            </div>
            {errorMessage && (
              <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {errorMessage}
              </p>
            )}
            {isOutOfStock && (
              <p className="text-[13px] text-mute">
                {product.variants.length > 1 ? "This option is sold out. Try another option, or save it to your wishlist." : "Sold out right now. Save it to your wishlist to find it again."}
              </p>
            )}
          </div>

          {/* Seller */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-line-soft bg-white p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div
                aria-hidden="true"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-white"
              >
                {initials(sellerName)}
              </div>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[15px] font-semibold text-ink">{sellerName}</span>
                <span className="text-[13px] text-mute">
                  {isWizzDirect
                    ? `Sold and shipped by WIZZ.PK${sellerCity ? ` · ${sellerCity}` : ""}`
                    : sellerCity
                    ? `Sold by · ${sellerCity}`
                    : "Marketplace seller"}
                </span>
              </div>
            </div>
            <Link href={listingHref} className={`${PILL_OUTLINE} whitespace-nowrap px-4`}>
              More from this seller
            </Link>
          </div>

          {/* Details */}
          <dl className="grid grid-cols-2 border-t border-line">
            {details.map((d, i) => (
              <div
                key={`${d.label}-${i}`}
                className={`flex min-w-0 flex-col gap-1 border-b border-line py-3.5 ${i % 2 === 0 ? "pr-4" : "pl-4"}`}
              >
                <dt className={`${MONO_LABEL} text-mute`}>{d.label}</dt>
                <dd className={`break-words text-[15px] text-ink ${d.mono ? "font-mono text-sm" : ""}`}>{d.value}</dd>
              </div>
            ))}
          </dl>

          {/* Trust lines: real policies from commerce settings */}
          <div className="flex flex-col gap-3">
            <TrustLine icon={<Banknote size={20} strokeWidth={1.6} />} title="Cash on delivery.">
              Pay when it arrives, on orders up to {formatCurrency(codMaxOrderMinor)}.
            </TrustLine>
            <TrustLine icon={<Truck size={20} strokeWidth={1.6} />} title="Delivery.">
              {formatCurrency(standardShippingMinor)} standard per seller, free when this seller&apos;s items reach{" "}
              {formatCurrency(freeShippingThresholdMinor)}. Express {formatCurrency(expressShippingMinor)}. Estimated{" "}
              <span suppressHydrationWarning>{formatEstimatedDelivery(isWizzDirect ? 2 : 3)}</span>
              {deliveryCity ? ` to ${deliveryCity}` : ""} (an estimate, not a guarantee).
            </TrustLine>
            <TrustLine icon={<RotateCcw size={20} strokeWidth={1.6} />} title={returnWindowDays > 0 ? `Returns within ${returnWindowDays} days.` : "Returns."}>
              <Link href="/policies/returns" className={`rounded-sm underline underline-offset-[3px] hover:text-ink ${FOCUS_RING}`}>
                {returnWindowDays > 0 ? "From delivery, see the returns policy" : "See the returns policy"}
              </Link>
              .
            </TrustLine>
            <TrustLine icon={<Clock size={20} strokeWidth={1.6} />} title="Stock held at checkout.">
              Items are reserved for {SITE_CONFIG.reservationExpiryMinutes} minutes while you complete your order.
            </TrustLine>
          </div>
        </div>
      </div>

      {/* About */}
      <section aria-labelledby="about-product" className="mt-16 flex flex-wrap gap-x-10 gap-y-6 border-t border-line pt-10">
        <h2 id="about-product" className="flex-[1_1_240px] text-[28px] font-semibold leading-tight tracking-[-0.035em] text-ink">
          About this product
        </h2>
        <div className="min-w-0 max-w-[760px] flex-[999_1_520px]">
          <ProductDescription text={product.description} size="lg" />
        </div>
      </section>

      {/* Reviews (approved reviews only) */}
      <section id="reviews" aria-labelledby="reviews-heading" className="mt-16 scroll-mt-28 space-y-6 border-t border-line pt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <h2 id="reviews-heading" className="text-[28px] font-semibold leading-tight tracking-[-0.035em] text-ink">
              Reviews <span className="font-mono text-xl text-mute">({reviewCount})</span>
            </h2>
            <p className="text-[13px] text-mute">&ldquo;Verified buyer&rdquo; marks reviews linked to a delivered order.</p>
          </div>
          {avgRating !== null && (
            <div className="flex items-center gap-2">
              <RatingStars rating={avgRating} size={16} />
              <span className="font-mono text-sm text-ink">{avgRating.toFixed(1)} / 5</span>
            </div>
          )}
        </div>

        {product.reviews.length > 0 ? (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {product.reviews.map((rev) => (
              <li key={rev.id} className="space-y-2.5 rounded-[20px] border border-line-soft bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-ink">
                      {rev.customerUser.firstName} {rev.customerUser.lastName}
                    </span>
                    {rev.isVerifiedPurchase && (
                      <span className={`inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-ink ${MONO_LABEL}`}>
                        <Check size={11} aria-hidden="true" />
                        Verified buyer
                      </span>
                    )}
                  </div>
                  <span className="flex items-center gap-1.5">
                    <RatingStars rating={rev.rating} size={13} />
                    <span className="sr-only">{rev.rating} out of 5</span>
                  </span>
                </div>
                {rev.title && <h3 className="text-[15px] font-semibold text-ink">{rev.title}</h3>}
                <p className="text-sm leading-relaxed text-ink-2">{rev.comment}</p>
                <p className="font-mono text-[11px] text-mute">{formatDate(rev.createdAt)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-[20px] border border-dashed border-line px-6 py-8 text-center text-sm text-mute">
            No customer reviews yet.
          </p>
        )}
      </section>

      {/* Mobile add-to-cart bar: floats just above the mobile dock (h-16 at bottom 1.75rem, md:hidden),
          shown only while the buy panel's buttons are scrolled out of view */}
      <div
        aria-hidden={actionsVisible}
        inert={actionsVisible}
        className={`fixed inset-x-5 bottom-[calc(6.25rem+env(safe-area-inset-bottom))] z-40 flex items-center justify-between gap-3 rounded-full border border-line bg-white py-1.5 pl-5 pr-1.5 shadow-[0_8px_24px_-12px_rgba(14,14,13,0.3)] motion-safe:transition-[opacity,transform] motion-safe:duration-200 md:hidden ${
          actionsVisible ? "pointer-events-none translate-y-2 opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-mute">{product.variants.length > 1 ? selectedVariant.title : product.title}</p>
          <p className="font-mono text-[15px] font-medium leading-tight text-ink">{formatCurrency(selectedVariant.priceMinor)}</p>
        </div>
        <button
          type="button"
          onClick={() => handleAddToCart(false)}
          disabled={isOutOfStock || busy}
          className={`flex h-11 max-w-[180px] flex-1 items-center justify-center gap-2 rounded-full bg-ink px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-mute-2 ${FOCUS_RING}`}
        >
          {isAdding ? (
            <Loader2 size={16} className="motion-safe:animate-spin" aria-hidden="true" />
          ) : addedSuccess ? (
            <Check size={16} aria-hidden="true" />
          ) : (
            <ShoppingBag size={16} strokeWidth={1.7} aria-hidden="true" />
          )}
          <span>{isOutOfStock ? "Sold out" : addedSuccess ? "Added" : "Add to cart"}</span>
        </button>
      </div>
    </div>
  );
}
