"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SITE_CONFIG } from "@/lib/config";
import {
  Trash2,
  ShoppingBag,
  ArrowRight,
  Tag,
  Check,
  Truck,
  RotateCcw,
  Store,
  Package,
  AlertCircle,
  X,
} from "lucide-react";

/** Matches MAX_CART_LINE_QUANTITY in the cart service / API. */
const MAX_LINE_QUANTITY = 20;

export interface CartItemType {
  id: string;
  variantId: string;
  quantity: number;
  variant: {
    id: string;
    sku: string;
    title: string;
    priceMinor: number;
    isPurchasable?: boolean;
    product: {
      title: string;
      slug: string;
      sellerOrg?: { id?: string; name: string; slug: string } | null;
      media: Array<{ url: string; altText?: string | null }>;
    };
    inventoryLevel?: { availableUnits: number; reservedUnits: number } | null;
  };
}

interface ServerTotals {
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
  appliedCoupon?: { code: string; discountMinor: number };
  couponError?: string;
}

function sellableUnits(item: CartItemType): number {
  const lvl = item.variant.inventoryLevel;
  if (!lvl) return 0;
  return Math.max(0, lvl.availableUnits - lvl.reservedUnits);
}

export function CartView({
  cartId,
  initialItems,
  freeShippingThresholdMinor,
  standardShippingMinor,
}: {
  cartId: string | null;
  initialItems: CartItemType[];
  /** Admin commerce settings, passed by the server page (used only for the per-package hint). */
  freeShippingThresholdMinor: number;
  standardShippingMinor: number;
}) {
  const router = useRouter();
  const [items, setItems] = useState<CartItemType[]>(initialItems);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});
  const [totals, setTotals] = useState<ServerTotals | null>(null);
  const [totalsError, setTotalsError] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const requestSeq = useRef(0);

  /**
   * Totals always come from the server (same calculation checkout uses), so the
   * cart can never show a price, discount or shipping fee the order would not charge.
   */
  const recalculate = useCallback(
    async (couponCode: string | null) => {
      if (!cartId) return null;
      const seq = ++requestSeq.current;
      setIsCalculating(true);
      try {
        const res = await fetch("/api/checkout/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cartId, couponCode: couponCode || undefined, shippingTier: "STANDARD" }),
        });
        const data = await res.json().catch(() => ({}));
        if (seq !== requestSeq.current) return null;
        if (!res.ok) {
          setTotals(null);
          setTotalsError(typeof data.error === "string" ? data.error : "We could not calculate your totals.");
          return null;
        }
        const t = data.totals as ServerTotals;
        setTotals(t);
        setTotalsError(null);
        return t;
      } catch {
        if (seq === requestSeq.current) {
          setTotals(null);
          setTotalsError("Network error while calculating totals. Check your connection and try again.");
        }
        return null;
      } finally {
        if (seq === requestSeq.current) setIsCalculating(false);
      }
    },
    [cartId]
  );

  // Initial totals (once per cart; later changes go through refreshTotals so the voucher is kept)
  const hadInitialItems = useRef(initialItems.length > 0);
  useEffect(() => {
    if (hadInitialItems.current) void recalculate(null);
  }, [recalculate]);

  /** Recalculate after a cart change, keeping the applied coupon if it still qualifies. */
  const refreshTotals = useCallback(async () => {
    const t = await recalculate(appliedCoupon);
    if (t && appliedCoupon && !t.appliedCoupon) {
      setAppliedCoupon(null);
      setCouponError(t.couponError || `Coupon ${appliedCoupon} no longer applies to this cart.`);
    }
  }, [appliedCoupon, recalculate]);

  const sellerGroups = useMemo(() => {
    const map = new Map<string, { sellerName: string; isDirect: boolean; items: CartItemType[] }>();
    for (const item of items) {
      const sellerOrg = item.variant.product.sellerOrg;
      const key = sellerOrg?.id || sellerOrg?.slug || "wizz-direct";
      const name = sellerOrg?.name || SITE_CONFIG.flagshipSellerName;
      const isDirect = !sellerOrg || sellerOrg.slug === SITE_CONFIG.flagshipSellerSlug;
      if (!map.has(key)) map.set(key, { sellerName: name, isDirect, items: [] });
      map.get(key)!.items.push(item);
    }
    return Array.from(map.values());
  }, [items]);

  const setLineError = (variantId: string, message: string | null) =>
    setLineErrors((prev) => {
      const next = { ...prev };
      if (message) next[variantId] = message;
      else delete next[variantId];
      return next;
    });

  const handleUpdateQuantity = async (variantId: string, newQty: number) => {
    setIsUpdating(variantId);
    setLineError(variantId, null);
    try {
      const res = await fetch("/api/cart/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId, quantity: newQty }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // The select is controlled by the saved quantity, so it reverts automatically.
        setLineError(variantId, typeof data.error === "string" ? data.error : "Could not update the quantity.");
        return;
      }
      setItems((prev) => prev.map((item) => (item.variantId === variantId ? { ...item, quantity: newQty } : item)));
      await refreshTotals();
      router.refresh();
    } catch {
      setLineError(variantId, "Network error. The quantity was not changed.");
    } finally {
      setIsUpdating(null);
    }
  };

  const handleRemove = async (variantId: string) => {
    setIsUpdating(variantId);
    setLineError(variantId, null);
    try {
      const res = await fetch(`/api/cart/items?variantId=${encodeURIComponent(variantId)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setLineError(variantId, typeof data.error === "string" ? data.error : "Could not remove this item.");
        return;
      }
      const remaining = items.filter((item) => item.variantId !== variantId);
      setItems(remaining);
      if (remaining.length > 0) await refreshTotals();
      router.refresh();
    } catch {
      setLineError(variantId, "Network error. The item was not removed.");
    } finally {
      setIsUpdating(null);
    }
  };

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponInput.trim().toUpperCase();
    setCouponError(null);
    if (!code) {
      setCouponError("Enter a voucher code.");
      return;
    }
    setIsApplyingCoupon(true);
    try {
      const t = await recalculate(code);
      if (!t) return; // totalsError explains what went wrong
      if (t.appliedCoupon) {
        setAppliedCoupon(t.appliedCoupon.code);
        setCouponInput("");
      } else {
        setCouponError(t.couponError || "This voucher could not be applied.");
        // Keep the previously applied voucher, if any, in effect.
        if (appliedCoupon) await recalculate(appliedCoupon);
      }
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = async () => {
    setAppliedCoupon(null);
    setCouponError(null);
    await recalculate(null);
  };

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-[28px] border border-line p-8 sm:p-12 text-center max-w-xl mx-auto space-y-6 shadow-xs">
        <div className="w-16 h-16 rounded-[20px] bg-brand-50 text-brand-600 flex items-center justify-center mx-auto">
          <ShoppingBag size={28} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-ink">Your shopping cart is empty</h2>
          <p className="text-sm text-mute mt-1.5 leading-relaxed">
            Browse the catalogue and add items to your cart to see them here.
          </p>
        </div>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-bold px-6 min-h-[48px] focus:outline-none focus:ring-2 focus:ring-ink/15 focus:ring-offset-2"
        >
          <span>Explore Catalogue</span>
          <ArrowRight size={16} />
        </Link>
      </div>
    );
  }

  const hasUnavailable = items.some((i) => i.variant.isPurchasable === false || sellableUnits(i) < i.quantity);
  const canCheckout = Boolean(totals) && !totalsError && !isCalculating && isUpdating === null;
  const checkoutHref = `/checkout${appliedCoupon ? `?coupon=${encodeURIComponent(appliedCoupon)}` : ""}`;
  const threshold = freeShippingThresholdMinor;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <div className="lg:col-span-8 space-y-4">
        {hasUnavailable && (
          <div role="alert" className="p-4 rounded-[20px] bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>
              Some items are unavailable or have less stock than the quantity in your cart. Remove them or lower the
              quantity to continue to checkout.
            </span>
          </div>
        )}

        {sellerGroups.map((group, groupIdx) => {
          const groupSubtotal = group.items.reduce((s, i) => s + i.variant.priceMinor * i.quantity, 0);
          const toFree = Math.max(0, threshold - groupSubtotal);
          return (
            <section
              key={groupIdx}
              aria-label={`Package ${groupIdx + 1} from ${group.sellerName}`}
              className="bg-white rounded-[20px] border border-line overflow-hidden shadow-xs"
            >
              <div className="p-4 bg-canvas/80 border-b border-line-soft space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Package size={15} className="text-brand-600" />
                    <span className="font-bold text-ink">
                      Package {groupIdx + 1} of {sellerGroups.length}
                    </span>
                    <span className="text-mute flex items-center gap-1">
                      <Store size={13} className="text-mute-2" />
                      <span>
                        Sold by <strong>{group.sellerName}</strong>
                      </span>
                    </span>
                  </div>
                  {group.isDirect && (
                    <Badge variant="success" size="sm">
                      WIZZ.PK Direct
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-mute flex items-center gap-1.5">
                  <Truck size={13} className="text-brand-600 shrink-0" />
                  {toFree === 0 ? (
                    <span className="text-brand-700 font-semibold">Free standard delivery on this package</span>
                  ) : (
                    <span>
                      Add {formatCurrency(toFree)} more from this seller for free standard delivery (otherwise{" "}
                      {formatCurrency(standardShippingMinor)})
                    </span>
                  )}
                </p>
              </div>

              <ul className="divide-y divide-line-soft">
                {group.items.map((item) => {
                  const thumbnail = item.variant.product.media[0]?.url;
                  const lineSubtotal = item.variant.priceMinor * item.quantity;
                  const isUpdatingThis = isUpdating === item.variantId;
                  const sellable = sellableUnits(item);
                  const unavailable = item.variant.isPurchasable === false;
                  const maxQty = Math.max(item.quantity, Math.min(MAX_LINE_QUANTITY, sellable));
                  const qtyId = `qty-${item.variantId}`;
                  const errId = `err-${item.variantId}`;
                  const lineError = lineErrors[item.variantId];

                  return (
                    <li key={item.id} className="p-4 sm:p-5 space-y-2">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-18 h-18 rounded-xl bg-canvas overflow-hidden shrink-0 border border-line">
                            {thumbnail ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={thumbnail}
                                alt={item.variant.product.media[0]?.altText || item.variant.product.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-mute-2 text-xs">
                                No image
                              </div>
                            )}
                          </div>

                          <div className="space-y-1 min-w-0">
                            <Link
                              href={`/products/${item.variant.product.slug}`}
                              className="font-bold text-xs sm:text-sm text-ink hover:text-brand-700 transition-colors line-clamp-2"
                            >
                              {item.variant.product.title}
                            </Link>
                            <p className="text-xs text-mute">
                              Variant: <span className="font-semibold text-ink-2">{item.variant.title}</span> • SKU:{" "}
                              <span className="font-mono text-[11px]">{item.variant.sku}</span>
                            </p>
                            <p className="text-xs font-bold text-ink sm:hidden">
                              {formatCurrency(item.variant.priceMinor)} each
                            </p>
                            {unavailable ? (
                              <p className="text-[11px] font-semibold text-rose-600">No longer available — please remove it.</p>
                            ) : sellable === 0 ? (
                              <p className="text-[11px] font-semibold text-rose-600">Out of stock — please remove it.</p>
                            ) : sellable < item.quantity ? (
                              <p className="text-[11px] font-semibold text-amber-700">
                                Only {sellable} left — lower the quantity to continue.
                              </p>
                            ) : sellable <= 10 ? (
                              <p className="text-[11px] font-semibold text-amber-700">Only {sellable} left in stock</p>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-5 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-line-soft">
                          <div className="flex items-center gap-2">
                            <label htmlFor={qtyId} className="text-xs text-mute">
                              Qty
                            </label>
                            <select
                              id={qtyId}
                              value={item.quantity}
                              disabled={isUpdatingThis || unavailable || sellable === 0}
                              aria-describedby={lineError ? errId : undefined}
                              aria-invalid={lineError ? true : undefined}
                              onChange={(e) => handleUpdateQuantity(item.variantId, Number(e.target.value))}
                              className="text-sm font-semibold rounded-lg border border-line bg-white px-2.5 min-h-[44px] text-ink-2 focus:outline-none focus:ring-2 focus:ring-ink/15 disabled:opacity-60"
                            >
                              {Array.from({ length: maxQty }).map((_, i) => (
                                <option key={i + 1} value={i + 1} disabled={i + 1 > sellable && i + 1 !== item.quantity}>
                                  {i + 1}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              disabled={isUpdatingThis}
                              onClick={() => handleRemove(item.variantId)}
                              className="text-mute hover:text-rose-600 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-canvas transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-rose-400"
                              aria-label={`Remove ${item.variant.product.title} from cart`}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          <div className="text-right min-w-[90px]">
                            <p className="text-sm font-semibold text-ink">{formatCurrency(lineSubtotal)}</p>
                            <p className="text-[11px] text-mute-2 hidden sm:block">
                              {formatCurrency(item.variant.priceMinor)} each
                            </p>
                          </div>
                        </div>
                      </div>
                      {lineError && (
                        <p id={errId} role="alert" className="text-xs font-semibold text-rose-600 flex items-center gap-1.5">
                          <AlertCircle size={13} className="shrink-0" />
                          <span>{lineError}</span>
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <div className="lg:col-span-4 space-y-4">
        <div className="bg-white rounded-[20px] border border-line p-5 space-y-5 shadow-xs lg:sticky lg:top-28">
          <h2 className="font-semibold text-base text-ink pb-3 border-b border-line-soft">
            Order Summary ({items.length} item{items.length === 1 ? "" : "s"})
          </h2>

          <form onSubmit={handleApplyCoupon} className="space-y-2" noValidate>
            <label htmlFor="cart-coupon" className="block text-xs font-bold text-ink-2">
              Voucher code
            </label>
            <div className="flex gap-2">
              <input
                id="cart-coupon"
                type="text"
                autoComplete="off"
                placeholder="Enter code"
                value={couponInput}
                maxLength={40}
                onChange={(e) => setCouponInput(e.target.value)}
                aria-invalid={couponError ? true : undefined}
                aria-describedby={couponError ? "cart-coupon-error" : undefined}
                className="flex-1 min-w-0 text-sm uppercase font-mono font-semibold rounded-lg border border-line px-3 min-h-[44px] bg-canvas focus:bg-white focus:outline-none focus:ring-2 focus:ring-ink/15"
              />
              <Button type="submit" variant="secondary" size="md" isLoading={isApplyingCoupon} disabled={!cartId}>
                Apply
              </Button>
            </div>
            <div aria-live="polite">
              {couponError && (
                <p id="cart-coupon-error" className="text-[11px] font-semibold text-rose-600">
                  {couponError}
                </p>
              )}
              {appliedCoupon && (
                <p className="text-[11px] font-semibold text-brand-700 flex items-center gap-1">
                  <Check size={12} />
                  <span>Voucher {appliedCoupon} applied</span>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="ml-auto inline-flex items-center gap-0.5 text-mute hover:text-rose-600 underline min-h-[32px]"
                  >
                    <X size={12} /> Remove
                  </button>
                </p>
              )}
            </div>
          </form>

          <div className="space-y-2.5 text-xs" aria-live="polite" aria-busy={isCalculating}>
            {totalsError ? (
              <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 space-y-2">
                <p className="flex items-start gap-1.5">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{totalsError}</span>
                </p>
                <button
                  type="button"
                  onClick={() => void recalculate(appliedCoupon)}
                  className="font-semibold underline min-h-[32px]"
                >
                  Try again
                </button>
              </div>
            ) : !totals ? (
              <div className="space-y-2" aria-label="Calculating totals">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-4 rounded bg-canvas animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                <div className="flex justify-between text-mute">
                  <span>Items subtotal</span>
                  <span className="font-semibold text-ink">{formatCurrency(totals.subtotalMinor)}</span>
                </div>
                {totals.discountMinor > 0 && (
                  <div className="flex justify-between text-brand-700 font-semibold">
                    <span className="flex items-center gap-1">
                      <Tag size={12} />
                      <span>Voucher {totals.appliedCoupon?.code}</span>
                    </span>
                    <span>-{formatCurrency(totals.discountMinor)}</span>
                  </div>
                )}
                <div className="flex justify-between text-mute">
                  <span>Standard delivery</span>
                  <span className="font-semibold text-ink">
                    {totals.shippingMinor === 0 ? "FREE" : formatCurrency(totals.shippingMinor)}
                  </span>
                </div>
                {totals.taxMinor > 0 && (
                  <div className="flex justify-between text-mute">
                    <span>Tax</span>
                    <span className="font-semibold text-ink">{formatCurrency(totals.taxMinor)}</span>
                  </div>
                )}
                <div className="pt-3 border-t border-line-soft flex justify-between text-sm font-semibold text-ink">
                  <span>Total</span>
                  <span className={`text-base text-brand-700 ${isCalculating ? "opacity-50" : ""}`}>
                    {formatCurrency(totals.totalMinor)}
                  </span>
                </div>
              </>
            )}
          </div>

          {canCheckout ? (
            <Link
              href={checkoutHref}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-bold min-h-[48px] text-sm focus:outline-none focus:ring-2 focus:ring-ink/15 focus:ring-offset-2"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight size={16} />
            </Link>
          ) : (
            <div className="space-y-1.5">
              <button
                type="button"
                disabled
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 text-white font-bold min-h-[48px] text-sm opacity-50 cursor-not-allowed"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight size={16} />
              </button>
              <p className="text-[11px] text-center text-mute">
                {totalsError
                  ? "Resolve the issue above to continue."
                  : "Updating your totals…"}
              </p>
            </div>
          )}

          <p className="text-[11px] text-center text-mute">
            Delivery is charged per seller package. Express delivery can be chosen at checkout.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-canvas border border-line text-xs text-mute">
          <Link href="/policies/returns" className="flex items-center gap-2 hover:text-brand-700">
            <RotateCcw size={15} className="text-brand-600 shrink-0" />
            <span className="font-semibold text-ink-2">Returns accepted within 30 days of delivery — see policy</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
