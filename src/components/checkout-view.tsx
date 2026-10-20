"use client";

import React, { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/formatters";
import { SITE_CONFIG } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  CreditCard,
  Truck,
  Lock,
  ArrowRight,
  Check,
  AlertCircle,
  Tag,
  Banknote,
  MapPin,
  Phone,
  Mail,
  User,
} from "lucide-react";

export interface CheckoutViewProps {
  cartId: string;
  initialEmail?: string;
  initialPhone?: string;
  initialCoupon?: string;
  savedAddresses?: Array<{
    id: string;
    fullName: string;
    phone: string;
    street1: string;
    street2?: string | null;
    city: string;
    stateProvince: string;
    postalCode: string;
    countryCode: string;
  }>;
}

const PAKISTAN_PROVINCES = [
  "Punjab",
  "Sindh",
  "Khyber Pakhtunkhwa",
  "Balochistan",
  "Islamabad Capital Territory",
  "Gilgit-Baltistan",
  "Azad Jammu & Kashmir",
];

const POPULAR_PAKISTAN_CITIES = [
  "Karachi",
  "Lahore",
  "Islamabad",
  "Rawalpindi",
  "Faisalabad",
  "Multan",
  "Peshawar",
  "Quetta",
  "Sialkot",
  "Gujranwala",
  "Hyderabad",
  "Bahawalpur",
  "Sargodha",
  "Sukkur",
];

export function CheckoutView({
  cartId,
  initialEmail = "",
  initialPhone = "",
  initialCoupon = "",
  savedAddresses = [],
}: CheckoutViewProps) {
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone || "+92 ");
  const [shippingTier, setShippingTier] = useState<"STANDARD" | "EXPRESS">("STANDARD");
  const [paymentMethod, setPaymentMethod] = useState<"CASH_ON_DELIVERY" | "ONLINE_SANDBOX">("CASH_ON_DELIVERY");
  const [couponCode, setCouponCode] = useState(initialCoupon);

  // Address State
  const defaultAddr = savedAddresses[0];
  const [fullName, setFullName] = useState(defaultAddr?.fullName || "");
  const [street1, setStreet1] = useState(defaultAddr?.street1 || "");
  const [street2, setStreet2] = useState(defaultAddr?.street2 || "");
  const [city, setCity] = useState(defaultAddr?.city || "Karachi");
  const [stateProvince, setStateProvince] = useState(defaultAddr?.stateProvince || "Sindh");
  const [postalCode, setPostalCode] = useState(defaultAddr?.postalCode || "75500");
  const [countryCode, setCountryCode] = useState(defaultAddr?.countryCode || "PK");

  // Server Calculated Totals State
  const [totals, setTotals] = useState<{
    subtotalMinor: number;
    discountMinor: number;
    shippingMinor: number;
    taxMinor: number;
    totalMinor: number;
    appliedCoupon?: { code: string; discountMinor: number };
  } | null>(null);

  const [isLoadingTotals, setIsLoadingTotals] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");

  useEffect(() => {
    // Generate unique idempotency key on mount
    setIdempotencyKey(`idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
    fetchTotals(initialCoupon, shippingTier);
  }, []);

  const fetchTotals = async (coupon: string, tier: "STANDARD" | "EXPRESS") => {
    setIsLoadingTotals(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/checkout/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cartId,
          couponCode: coupon,
          shippingTier: tier,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to calculate totals.");
      setTotals(data.totals);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Error calculating totals");
    } finally {
      setIsLoadingTotals(false);
    }
  };

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTotals(couponCode, shippingTier);
  };

  const handleShippingTierChange = (tier: "STANDARD" | "EXPRESS") => {
    setShippingTier(tier);
    fetchTotals(couponCode, tier);
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !fullName || !street1 || !city || !postalCode) {
      setErrorMessage("Please fill in all required shipping address fields.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const address = {
      fullName,
      phone: phone || "N/A",
      street1,
      street2: street2 || undefined,
      city,
      stateProvince,
      postalCode,
      countryCode,
    };

    try {
      const res = await fetch("/api/checkout/place-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cartId,
          customerEmail: email,
          customerPhone: phone,
          shippingAddress: address,
          billingAddress: address,
          shippingTier,
          couponCode: totals?.appliedCoupon?.code || couponCode,
          idempotencyKey,
          paymentMethod,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to place order.");

      // Redirect to order confirmation receipt
      window.location.href = `/orders/${data.orderId}`;
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Error placing order");
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-10">
      {/* Checkout Inputs (Left 7 cols) */}
      <div className="lg:col-span-7 space-y-8">
        {/* 1. Contact Information */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
              1
            </div>
            <h2 className="font-bold text-base text-slate-900">Contact Information</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Email Address (for order receipts)"
              type="email"
              required
              placeholder="buyer@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Mobile Phone (for delivery coordination)"
              type="tel"
              required
              placeholder="+92 300 1234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>

        {/* 2. Shipping Address */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                2
              </div>
              <h2 className="font-bold text-base text-slate-900">Delivery Address in Pakistan</h2>
            </div>
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <MapPin size={13} className="text-emerald-600" />
              <span>Nationwide Coverage</span>
            </span>
          </div>

          <div className="space-y-4">
            <Input
              label="Recipient Full Name"
              required
              placeholder="e.g. Muhammad Ali Khan"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />

            <Input
              label="Complete Street Address / House / Flat"
              required
              placeholder="House 14-B, Street 3, Block 5, Clifton"
              value={street1}
              onChange={(e) => setStreet1(e.target.value)}
            />

            <Input
              label="Nearby Landmark / Area (Optional)"
              placeholder="Near Boat Basin / PSO Station"
              value={street2}
              onChange={(e) => setStreet2(e.target.value)}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  City
                </label>
                <div className="space-y-1">
                  <input
                    type="text"
                    required
                    list="city-suggestions"
                    placeholder="Karachi, Lahore..."
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <datalist id="city-suggestions">
                    {POPULAR_PAKISTAN_CITIES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Province / Region
                </label>
                <select
                  value={stateProvince}
                  onChange={(e) => setStateProvince(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {PAKISTAN_PROVINCES.map((prov) => (
                    <option key={prov} value={prov}>
                      {prov}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Postal / Zip Code"
                required
                placeholder="75500"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Country
              </label>
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="PK">Pakistan (PKR)</option>
                <option value="US">United States (USD International)</option>
                <option value="GB">United Kingdom (GBP International)</option>
                <option value="AE">United Arab Emirates (AED)</option>
              </select>
            </div>
          </div>
        </div>

        {/* 3. Delivery Method */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
              3
            </div>
            <h2 className="font-bold text-base text-slate-900">Shipping Method</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => handleShippingTierChange("STANDARD")}
              className={`p-4 rounded-xl border text-left transition-all ${
                shippingTier === "STANDARD"
                  ? "border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-500"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900">Standard Delivery</span>
                <span className="text-xs font-bold text-emerald-700">
                  {totals && totals.subtotalMinor >= SITE_CONFIG.shipping.freeShippingThresholdMinor
                    ? "FREE"
                    : formatCurrency(SITE_CONFIG.shipping.standardRateMinor)}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">3 - 5 Business Days • Real courier tracking</p>
            </button>

            <button
              type="button"
              onClick={() => handleShippingTierChange("EXPRESS")}
              className={`p-4 rounded-xl border text-left transition-all ${
                shippingTier === "EXPRESS"
                  ? "border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-500"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900">Express Priority</span>
                <span className="text-xs font-bold text-slate-700">
                  {formatCurrency(SITE_CONFIG.shipping.expressRateMinor)}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">1 - 2 Business Days • Fast-track dispatch</p>
            </button>
          </div>
        </div>

        {/* 4. Payment Method Selection */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                4
              </div>
              <h2 className="font-bold text-base text-slate-900">Payment Method</h2>
            </div>
            <span className="text-xs text-slate-500">Secure Processing</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Cash on Delivery */}
            <button
              type="button"
              onClick={() => setPaymentMethod("CASH_ON_DELIVERY")}
              className={`p-4 rounded-xl border text-left transition-all relative ${
                paymentMethod === "CASH_ON_DELIVERY"
                  ? "border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <Banknote size={16} className="text-emerald-600" />
                  <span>Cash on Delivery</span>
                </span>
                <Badge variant="success" size="sm">Recommended</Badge>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Pay in cash when courier delivers the package to your doorstep. Verified inventory reservation held upon placement.
              </p>
            </button>

            {/* Online Sandbox Adapter */}
            <button
              type="button"
              onClick={() => setPaymentMethod("ONLINE_SANDBOX")}
              className={`p-4 rounded-xl border text-left transition-all ${
                paymentMethod === "ONLINE_SANDBOX"
                  ? "border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <CreditCard size={16} className="text-slate-600" />
                  <span>Online Card (Sandbox)</span>
                </span>
                <Badge variant="neutral" size="sm">Dev Testing</Badge>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Simulated online payment gateway adapter for development testing without live card authorization.
              </p>
            </button>
          </div>

          {paymentMethod === "CASH_ON_DELIVERY" ? (
            <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
              <Check size={16} className="text-emerald-600 flex-shrink-0" />
              <span>
                COD is enabled for your location. Please keep exact cash ready upon delivery for courier handover.
              </span>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-center gap-2">
              <Lock size={16} className="text-slate-500 flex-shrink-0" />
              <span>
                Online payment sandbox adapter will transition order status immediately in development mode.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Order Summary & Placement (5 cols) */}
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-6 shadow-sm sticky top-24">
          <h3 className="font-extrabold text-base text-slate-900 pb-3 border-b border-slate-100">
            Order Summary
          </h3>

          {/* Coupon Code Input */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Coupon code (e.g. WIZZ10)"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                className="flex-1 text-xs uppercase font-mono font-semibold rounded-lg border border-slate-300 px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <Button type="button" variant="secondary" size="sm" onClick={handleApplyCoupon}>
                Apply
              </Button>
            </div>
            {totals?.appliedCoupon && (
              <p className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                <Check size={12} />
                <span>Coupon {totals.appliedCoupon.code} active</span>
              </p>
            )}
          </div>

          {/* Calculations */}
          {isLoadingTotals ? (
            <div className="py-6 text-center text-xs text-slate-400 animate-pulse">
              Calculating authoritative server totals...
            </div>
          ) : totals ? (
            <div className="space-y-3 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Items Subtotal</span>
                <span className="font-semibold text-slate-900">
                  {formatCurrency(totals.subtotalMinor)}
                </span>
              </div>

              {totals.discountMinor > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span className="flex items-center gap-1">
                    <Tag size={12} />
                    <span>Coupon Discount</span>
                  </span>
                  <span>-{formatCurrency(totals.discountMinor)}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-600">
                <span>Shipping ({shippingTier})</span>
                <span className="font-semibold text-slate-900">
                  {totals.shippingMinor === 0 ? "FREE" : formatCurrency(totals.shippingMinor)}
                </span>
              </div>

              {totals.taxMinor > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Sales Tax</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(totals.taxMinor)}
                  </span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex justify-between text-base font-black text-slate-900">
                <span>Total Amount Due</span>
                <span className="text-emerald-700">{formatCurrency(totals.totalMinor)}</span>
              </div>

              <div className="text-[11px] text-slate-500 pt-1">
                Payment Method: <strong className="text-slate-800">{paymentMethod === "CASH_ON_DELIVERY" ? "Cash on Delivery" : "Sandbox Card"}</strong>
              </div>
            </div>
          ) : null}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Confirm & Place Order Button */}
          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting || isLoadingTotals}
            isLoading={isSubmitting}
            className="w-full shadow-lg shadow-emerald-600/25 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          >
            {paymentMethod === "CASH_ON_DELIVERY" ? (
              <>
                <Banknote size={18} />
                <span>Place Order with Cash on Delivery</span>
              </>
            ) : (
              <>
                <Lock size={18} />
                <span>Authorize & Pay with Sandbox</span>
              </>
            )}
          </Button>

          <div className="space-y-1.5 text-[11px] text-center text-slate-400">
            <p>✓ 15-Minute Transactional Stock Reservation Protected</p>
            <p>✓ 100% Genuine Physical Products Guaranteed</p>
          </div>
        </div>
      </div>
    </form>
  );
}
