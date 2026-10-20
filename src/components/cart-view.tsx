"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SITE_CONFIG } from "@/lib/config";
import {
  Trash2,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  Tag,
  Check,
  Truck,
  RotateCcw,
  Store,
  Package,
} from "lucide-react";

export interface CartItemType {
  id: string;
  variantId: string;
  quantity: number;
  variant: {
    id: string;
    sku: string;
    title: string;
    priceMinor: number;
    product: {
      title: string;
      slug: string;
      sellerOrg?: { id?: string; name: string; slug: string } | null;
      media: Array<{ url: string; altText?: string | null }>;
    };
    inventoryLevel?: { availableUnits: number; reservedUnits: number } | null;
  };
}

export function CartView({ initialItems }: { initialItems: CartItemType[] }) {
  const [items, setItems] = useState<CartItemType[]>(initialItems);
  const [couponCode, setCouponCode] = useState<string>("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponDiscountMinor, setCouponDiscountMinor] = useState<number>(0);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  // Group items by seller organization
  const sellerGroups = React.useMemo(() => {
    const map = new Map<string, { sellerName: string; isDirect: boolean; items: CartItemType[] }>();
    for (const item of items) {
      const sellerOrg = item.variant.product.sellerOrg;
      const key = sellerOrg?.id || "wizz-direct";
      const name = sellerOrg?.name || "WIZZ.PK Direct";
      const isDirect = sellerOrg?.slug === "wizz-pk-direct" || !sellerOrg;

      if (!map.has(key)) {
        map.set(key, { sellerName: name, isDirect, items: [] });
      }
      map.get(key)!.items.push(item);
    }
    return Array.from(map.values());
  }, [items]);

  // Calculate totals
  const subtotalMinor = items.reduce(
    (sum, item) => sum + item.variant.priceMinor * item.quantity,
    0
  );

  const freeShippingThreshold = SITE_CONFIG.shipping.freeShippingThresholdMinor;
  const isFreeShipping = subtotalMinor >= freeShippingThreshold;
  const amountToFreeShipping = Math.max(0, freeShippingThreshold - subtotalMinor);

  const shippingMinor = isFreeShipping ? 0 : SITE_CONFIG.shipping.standardRateMinor;
  const discountedSubtotal = Math.max(0, subtotalMinor - couponDiscountMinor);
  const taxMinor = Math.round((discountedSubtotal * SITE_CONFIG.tax.defaultRatePercent) / 100);
  const grandTotalMinor = discountedSubtotal + shippingMinor + taxMinor;

  const handleUpdateQuantity = async (variantId: string, newQty: number) => {
    setIsUpdating(variantId);
    try {
      const res = await fetch("/api/cart/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId, quantity: newQty }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((item) =>
            item.variantId === variantId ? { ...item, quantity: newQty } : item
          )
        );
      }
    } finally {
      setIsUpdating(null);
    }
  };

  const handleRemove = async (variantId: string) => {
    setIsUpdating(variantId);
    try {
      const res = await fetch(`/api/cart/items?variantId=${encodeURIComponent(variantId)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setItems((prev) => prev.filter((item) => item.variantId !== variantId));
      }
    } finally {
      setIsUpdating(null);
    }
  };

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError(null);
    const code = couponCode.trim().toUpperCase();

    if (code === "WIZZ10") {
      if (subtotalMinor < 3000) {
        setCouponError(`Code WIZZ10 requires a minimum order of ${formatCurrency(3000)}.`);
        return;
      }
      const disc = Math.round((subtotalMinor * 10) / 100);
      setCouponDiscountMinor(disc);
      setAppliedCoupon("WIZZ10");
    } else if (code === "WELCOME20") {
      if (subtotalMinor < 10000) {
        setCouponError(`Code WELCOME20 requires a minimum order of ${formatCurrency(10000)}.`);
        return;
      }
      setCouponDiscountMinor(2000);
      setAppliedCoupon("WELCOME20");
    } else {
      setCouponError("Invalid or expired coupon code.");
    }
  };

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-xl mx-auto space-y-6 shadow-xs">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
          <ShoppingBag size={28} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Your shopping cart is empty</h2>
          <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
            You haven't added any physical products yet. Explore our verified marketplace catalog to find high-performance gear.
          </p>
        </div>
        <Link href="/products" className="inline-block">
          <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
            <span>Explore Catalog</span>
            <ArrowRight size={16} />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Items List (Left 8 cols) */}
      <div className="lg:col-span-8 space-y-5">
        {/* Free Shipping Progress Alert */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-slate-700">
              <Truck size={15} className="text-emerald-600" />
              {isFreeShipping ? (
                <span className="text-emerald-700">You've unlocked Free Nationwide Tracked Shipping!</span>
              ) : (
                <span>Add {formatCurrency(amountToFreeShipping)} more to qualify for Free Shipping</span>
              )}
            </span>
            <span className="text-slate-500 font-mono text-[11px]">
              {Math.min(100, Math.round((subtotalMinor / freeShippingThreshold) * 100))}%
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{
                width: `${Math.min(100, Math.round((subtotalMinor / freeShippingThreshold) * 100))}%`,
              }}
            />
          </div>
        </div>

        {/* Grouped by Seller Packages (Amazon/Daraz marketplace pattern) */}
        <div className="space-y-4">
          {sellerGroups.map((group, groupIdx) => (
            <div
              key={groupIdx}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs"
            >
              {/* Package Header */}
              <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Package size={15} className="text-emerald-600" />
                  <span className="font-bold text-xs text-slate-900">
                    Package {groupIdx + 1} of {sellerGroups.length}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="text-xs text-slate-600 flex items-center gap-1">
                    <Store size={13} className="text-slate-400" />
                    <span>Fulfilled by <strong>{group.sellerName}</strong></span>
                  </span>
                </div>
                {group.isDirect ? (
                  <Badge variant="success" size="sm">WIZZ Direct Flagship</Badge>
                ) : (
                  <Badge variant="neutral" size="sm">Verified Partner</Badge>
                )}
              </div>

              {/* Items in this Package */}
              <div className="divide-y divide-slate-100">
                {group.items.map((item) => {
                  const thumbnail = item.variant.product.media[0]?.url;
                  const lineSubtotal = item.variant.priceMinor * item.quantity;
                  const isUpdatingThis = isUpdating === item.variantId;

                  return (
                    <div
                      key={item.id}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-18 h-18 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                          {thumbnail ? (
                            <img
                              src={thumbnail}
                              alt={item.variant.product.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                              No image
                            </div>
                          )}
                        </div>

                        <div className="space-y-1 min-w-0">
                          <Link
                            href={`/products/${item.variant.product.slug}`}
                            className="font-bold text-xs sm:text-sm text-slate-900 hover:text-emerald-700 transition-colors line-clamp-1"
                          >
                            {item.variant.product.title}
                          </Link>
                          <p className="text-xs text-slate-500">
                            Variant: <span className="font-semibold text-slate-700">{item.variant.title}</span> • SKU:{" "}
                            <span className="font-mono text-[11px]">{item.variant.sku}</span>
                          </p>
                          <p className="text-xs font-bold text-slate-900 sm:hidden">
                            {formatCurrency(item.variant.priceMinor)} each
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-5 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        {/* Quantity Selector */}
                        <div className="flex items-center gap-2">
                          <select
                            value={item.quantity}
                            disabled={isUpdatingThis}
                            onChange={(e) =>
                              handleUpdateQuantity(item.variantId, Number(e.target.value))
                            }
                            className="text-xs font-semibold rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            {Array.from({ length: 10 }).map((_, i) => (
                              <option key={i + 1} value={i + 1}>
                                {i + 1}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            disabled={isUpdatingThis}
                            onClick={() => handleRemove(item.variantId)}
                            className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                            aria-label="Remove item"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        {/* Line Total */}
                        <div className="text-right min-w-[90px]">
                          <p className="text-sm font-black text-slate-900">
                            {formatCurrency(lineSubtotal)}
                          </p>
                          <p className="text-[11px] text-slate-400 hidden sm:block">
                            {formatCurrency(item.variant.priceMinor)} each
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Order Summary & Checkout Card (Right 4 cols) */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5 shadow-xs sticky top-28">
          <h3 className="font-black text-base text-slate-900 pb-3 border-b border-slate-100">
            Order Summary ({items.length} item{items.length === 1 ? "" : "s"})
          </h3>

          {/* Coupon Code Input */}
          <form onSubmit={handleApplyCoupon} className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Voucher (e.g. WIZZ10)"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                className="flex-1 text-xs uppercase font-mono font-semibold rounded-lg border border-slate-300 px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <Button type="submit" variant="secondary" size="sm" className="bg-slate-900 text-white hover:bg-slate-800">
                Apply
              </Button>
            </div>
            {couponError && (
              <p className="text-[11px] font-semibold text-rose-600">{couponError}</p>
            )}
            {appliedCoupon && (
              <p className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                <Check size={12} />
                <span>Coupon {appliedCoupon} active</span>
              </p>
            )}
          </form>

          {/* Cost Line Items */}
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Items Subtotal</span>
              <span className="font-semibold text-slate-900">{formatCurrency(subtotalMinor)}</span>
            </div>

            {couponDiscountMinor > 0 && (
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span className="flex items-center gap-1">
                  <Tag size={12} />
                  <span>Promotional Voucher</span>
                </span>
                <span>-{formatCurrency(couponDiscountMinor)}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-600">
              <span>Estimated Shipping</span>
              <span className="font-semibold text-slate-900">
                {shippingMinor === 0 ? "FREE" : formatCurrency(shippingMinor)}
              </span>
            </div>

            <div className="flex justify-between text-slate-600">
              <span>Sales Tax ({SITE_CONFIG.tax.defaultRatePercent}%)</span>
              <span className="font-semibold text-slate-900">{formatCurrency(taxMinor)}</span>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-between text-sm font-black text-slate-900">
              <span>Total Payable</span>
              <span className="text-base text-emerald-700">{formatCurrency(grandTotalMinor)}</span>
            </div>
          </div>

          {/* Proceed Button */}
          <Link
            href={`/checkout${appliedCoupon ? `?coupon=${appliedCoupon}` : ""}`}
            className="block"
          >
            <Button size="lg" className="w-full shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 text-xs">
              <span>Proceed to Checkout</span>
              <ArrowRight size={16} />
            </Button>
          </Link>

          <p className="text-[10px] text-center text-slate-400">
            Nationwide Cash on Delivery available. Exact shipping & taxes verified on server.
          </p>
        </div>

        {/* Guarantees */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <ShieldCheck size={15} className="text-emerald-600 shrink-0" />
            <span className="font-semibold text-slate-800">100% Genuine Physical Products</span>
          </div>
          <div className="flex items-center gap-2">
            <RotateCcw size={15} className="text-emerald-600 shrink-0" />
            <span className="font-semibold text-slate-800">30-Day Doorstep Return Guarantee</span>
          </div>
        </div>
      </div>
    </div>
  );
}
