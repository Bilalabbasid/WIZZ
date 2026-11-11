"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { formatCurrency } from "@/lib/formatters";
import { PAKISTAN_PROVINCES, checkoutAddressSchema, normalizePakistanPhone } from "@/lib/validation";
import type { PaymentMethodId, PaymentMethodOption } from "@/lib/payment-methods";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  Lock,
  Check,
  AlertCircle,
  Tag,
  Banknote,
  MapPin,
  RefreshCw,
  X,
} from "lucide-react";

export interface CheckoutSavedAddress {
  id: string;
  title?: string | null;
  fullName: string;
  phone: string;
  street1: string;
  street2?: string | null;
  city: string;
  stateProvince: string;
  postalCode: string;
  countryCode: string;
  isDefaultShipping?: boolean;
}

export interface CheckoutViewProps {
  cartId: string;
  initialEmail?: string;
  initialPhone?: string;
  initialCoupon?: string;
  savedAddresses?: CheckoutSavedAddress[];
  paymentMethods: PaymentMethodOption[];
  codLimitMinor: number;
  shippingRates: {
    standardMinor: number;
    expressMinor: number;
    freeThresholdMinor: number;
  };
}

interface CheckoutTotals {
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
  appliedCoupon?: { code: string; discountMinor: number };
  couponError?: string;
}

type FieldKey =
  | "email"
  | "phone"
  | "fullName"
  | "street1"
  | "street2"
  | "city"
  | "stateProvince"
  | "postalCode"
  | "countryCode";

type FieldErrors = Partial<Record<FieldKey, string>>;

const FIELD_LABELS: Record<FieldKey, string> = {
  email: "Email address",
  phone: "Mobile phone",
  fullName: "Recipient full name",
  street1: "Street address",
  street2: "Landmark / area",
  city: "City",
  stateProvince: "Province",
  postalCode: "Postal code",
  countryCode: "Country",
};

/** Friendly copy used when the server returns a generic schema message for a field. */
const FIELD_HINTS: Record<FieldKey, string> = {
  email: "Enter a valid email address.",
  phone: "Enter a valid Pakistani phone number, e.g. 0300 1234567 or +92 300 1234567.",
  fullName: "Enter the recipient's full name (2 to 120 characters).",
  street1: "Enter the house, street and area (at least 5 characters).",
  street2: "Keep the landmark under 200 characters.",
  city: "Enter your city (at least 2 characters).",
  stateProvince: "Select a valid Pakistani province or territory.",
  postalCode: "Postal code must be 5 digits.",
  countryCode: "We currently deliver within Pakistan only.",
};

const FIELD_ORDER: FieldKey[] = [
  "email",
  "phone",
  "fullName",
  "street1",
  "street2",
  "city",
  "stateProvince",
  "postalCode",
  "countryCode",
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isProvince = (v: string) => (PAKISTAN_PROVINCES as readonly string[]).includes(v);

const fieldId = (key: FieldKey) => `checkout-${key}`;

function isAddressValidForPakistan(a: CheckoutSavedAddress): boolean {
  return checkoutAddressSchema.safeParse({
    fullName: a.fullName,
    phone: a.phone,
    street1: a.street1,
    street2: a.street2 ?? undefined,
    city: a.city,
    stateProvince: a.stateProvince,
    postalCode: a.postalCode,
    countryCode: a.countryCode,
  }).success;
}

interface AddressFields {
  fullName: string;
  phone: string;
  street1: string;
  street2: string;
  city: string;
  stateProvince: string;
  postalCode: string;
}

const EMPTY_ADDRESS: AddressFields = {
  fullName: "",
  phone: "",
  street1: "",
  street2: "",
  city: "",
  stateProvince: "",
  postalCode: "",
};

/**
 * Prefill from a saved address, but only with values that are valid for a Pakistan
 * delivery. A legacy address saved with a foreign country or province never prefills
 * those fields, so the form can never show something the server will reject.
 */
function addressToFields(a: CheckoutSavedAddress): AddressFields {
  const inPakistan = a.countryCode === "PK";
  return {
    fullName: a.fullName || "",
    phone: normalizePakistanPhone(a.phone) ? a.phone : "",
    street1: a.street1 || "",
    street2: a.street2 || "",
    city: inPakistan ? a.city || "" : "",
    stateProvince: inPakistan && isProvince(a.stateProvince) ? a.stateProvince : "",
    postalCode: inPakistan && /^\d{5}$/.test(a.postalCode.trim()) ? a.postalCode.trim() : "",
  };
}

/** Maps a schema path from place-order (e.g. "shippingAddress.phone") to a form field. */
function pathToField(path: string): FieldKey | null {
  if (path === "customerEmail") return "email";
  if (path === "customerPhone") return "phone";
  const m = /^(?:shippingAddress|billingAddress)\.(\w+)$/.exec(path);
  if (m && (FIELD_ORDER as string[]).includes(m[1])) return m[1] as FieldKey;
  return null;
}

const GENERIC_SCHEMA_MESSAGE = /^(too small|too big|invalid|expected|required)/i;

/**
 * place-order returns validation failures as "path: message; path: message".
 * Billing mirrors shipping here, so duplicate billing/shipping messages collapse
 * into one per field.
 */
function parseServerValidation(message: string): { fields: FieldErrors; other: string[] } {
  const fields: FieldErrors = {};
  const other: string[] = [];
  for (const part of message.split(/;\s+/)) {
    const m = /^([A-Za-z0-9_.]+):\s+(.+)$/.exec(part.trim());
    const field = m ? pathToField(m[1]) : null;
    if (m && field) {
      if (!fields[field]) {
        fields[field] = GENERIC_SCHEMA_MESSAGE.test(m[2]) ? FIELD_HINTS[field] : m[2];
      }
    } else if (part.trim()) {
      const text = m ? m[2] : part.trim();
      if (!other.includes(text)) other.push(text);
    }
  }
  return { fields, other };
}

function validateClient(email: string, addr: AddressFields): FieldErrors {
  const errors: FieldErrors = {};
  const e = email.trim();
  if (!e || !EMAIL_PATTERN.test(e) || e.length > 254) errors.email = FIELD_HINTS.email;
  if (!normalizePakistanPhone(addr.phone)) errors.phone = FIELD_HINTS.phone;

  const fullName = addr.fullName.trim();
  if (fullName.length < 2 || fullName.length > 120) errors.fullName = FIELD_HINTS.fullName;
  const street1 = addr.street1.trim();
  if (street1.length < 5 || street1.length > 200) errors.street1 = FIELD_HINTS.street1;
  if (addr.street2.trim().length > 200) errors.street2 = FIELD_HINTS.street2;
  const city = addr.city.trim();
  if (city.length < 2 || city.length > 80) errors.city = FIELD_HINTS.city;
  if (!isProvince(addr.stateProvince)) errors.stateProvince = FIELD_HINTS.stateProvince;
  if (!/^\d{5}$/.test(addr.postalCode.trim())) errors.postalCode = FIELD_HINTS.postalCode;

  // Final parity check with the exact schema the server uses
  if (Object.keys(errors).length === 0) {
    const parsed = checkoutAddressSchema.safeParse({
      ...addr,
      street2: addr.street2 || undefined,
      countryCode: "PK",
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "") as FieldKey;
        if ((FIELD_ORDER as string[]).includes(key) && !errors[key]) errors[key] = FIELD_HINTS[key];
      }
    }
  }
  return errors;
}

const selectClass = (hasError: boolean) =>
  `w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/15 focus:border-ink ${
    hasError ? "border-rose-400 focus:ring-rose-500" : "border-line"
  }`;

export function CheckoutView({
  cartId,
  initialEmail = "",
  initialPhone = "",
  initialCoupon = "",
  savedAddresses = [],
  paymentMethods,
  codLimitMinor,
  shippingRates,
}: CheckoutViewProps) {
  const firstValidSaved = savedAddresses.find(isAddressValidForPakistan);

  const [email, setEmail] = useState(initialEmail);
  const [selectedAddressId, setSelectedAddressId] = useState<string>(firstValidSaved?.id ?? "new");
  const [address, setAddress] = useState<AddressFields>(() =>
    firstValidSaved
      ? addressToFields(firstValidSaved)
      : { ...EMPTY_ADDRESS, phone: normalizePakistanPhone(initialPhone) ? initialPhone : "" }
  );
  const [shippingTier, setShippingTier] = useState<"STANDARD" | "EXPRESS">("STANDARD");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId | null>(paymentMethods[0]?.id ?? null);

  // Coupon: `couponInput` is what the shopper is typing; `requestedCoupon` is the code
  // last sent to the server. Only the server-applied code is ever sent with the order.
  const [couponInput, setCouponInput] = useState(initialCoupon);
  const [requestedCoupon, setRequestedCoupon] = useState(initialCoupon);

  const [totals, setTotals] = useState<CheckoutTotals | null>(null);
  const [totalsError, setTotalsError] = useState<string | null>(null);
  const [isLoadingTotals, setIsLoadingTotals] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitErrors, setSubmitErrors] = useState<string[]>([]);

  const idempotencyKeyRef = useRef<string | null>(null);
  const totalsRequestRef = useRef(0);
  const summaryRef = useRef<HTMLDivElement>(null);

  const fetchTotals = useCallback(
    async (coupon: string, tier: "STANDARD" | "EXPRESS") => {
      const requestId = ++totalsRequestRef.current;
      setIsLoadingTotals(true);
      setTotalsError(null);
      try {
        const res = await fetch("/api/checkout/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cartId, couponCode: coupon.trim() || undefined, shippingTier: tier }),
        });
        const data = await res.json().catch(() => ({}));
        if (requestId !== totalsRequestRef.current) return;
        if (!res.ok) throw new Error(data.error || "We could not calculate your order total.");
        setTotals(data.totals as CheckoutTotals);
      } catch (err: unknown) {
        if (requestId !== totalsRequestRef.current) return;
        setTotals(null);
        setTotalsError(err instanceof Error ? err.message : "We could not calculate your order total.");
      } finally {
        if (requestId === totalsRequestRef.current) setIsLoadingTotals(false);
      }
    },
    [cartId]
  );

  useEffect(() => {
    // Initial server-side total for the cart (and any coupon carried from the cart page)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchTotals(initialCoupon, "STANDARD");
  }, [fetchTotals, initialCoupon]);

  const updateField = (key: keyof AddressFields, value: string) => {
    setAddress((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const selectSavedAddress = (id: string) => {
    setSelectedAddressId(id);
    setFieldErrors({});
    if (id === "new") {
      setAddress({ ...EMPTY_ADDRESS, phone: normalizePakistanPhone(initialPhone) ? initialPhone : "" });
      return;
    }
    const saved = savedAddresses.find((a) => a.id === id);
    if (saved) setAddress(addressToFields(saved));
  };

  const handleApplyCoupon = () => {
    const code = couponInput.trim();
    setRequestedCoupon(code);
    void fetchTotals(code, shippingTier);
  };

  const handleRemoveCoupon = () => {
    setCouponInput("");
    setRequestedCoupon("");
    void fetchTotals("", shippingTier);
  };

  const handleShippingTierChange = (tier: "STANDARD" | "EXPRESS") => {
    if (tier === shippingTier) return;
    setShippingTier(tier);
    void fetchTotals(requestedCoupon, tier);
  };

  const showSummary = () => {
    requestAnimationFrame(() => {
      summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      summaryRef.current?.focus({ preventScroll: true });
    });
  };

  const codExceeded =
    paymentMethod === "CASH_ON_DELIVERY" && totals !== null && totals.totalMinor > codLimitMinor;
  const codEnabled = paymentMethods.some((m) => m.id === "CASH_ON_DELIVERY");
  const otherMethodThanCod = paymentMethods.find((m) => m.id !== "CASH_ON_DELIVERY");
  const appliedCode = totals?.appliedCoupon?.code;
  const couponPending = couponInput.trim().length > 0 && couponInput.trim().toUpperCase() !== (appliedCode ?? "").toUpperCase();

  const submitBlockedReason = !paymentMethod
    ? "No payment method is available right now."
    : !totals
      ? isLoadingTotals
        ? null
        : "Your order total could not be calculated."
      : codExceeded
        ? "Cash on delivery is not available for this order total."
        : null;

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !totals || !paymentMethod || codExceeded) return;

    const clientErrors = validateClient(email, address);
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setSubmitErrors([]);
      showSummary();
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});
    setSubmitErrors([]);

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? `chk_${crypto.randomUUID()}`
          : `chk_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    }

    const shippingAddress = {
      fullName: address.fullName.trim(),
      phone: address.phone.trim(),
      street1: address.street1.trim(),
      street2: address.street2.trim() || undefined,
      city: address.city.trim(),
      stateProvince: address.stateProvince,
      postalCode: address.postalCode.trim(),
      countryCode: "PK",
    };

    try {
      const res = await fetch("/api/checkout/place-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cartId,
          customerEmail: email.trim(),
          customerPhone: shippingAddress.phone,
          shippingAddress,
          billingAddress: shippingAddress,
          shippingTier,
          // Only a code the server actually applied is sent; an unapplied typed code never is.
          couponCode: appliedCode || undefined,
          idempotencyKey: idempotencyKeyRef.current,
          paymentMethod,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message: string = data.error || "We could not place your order. Please try again.";
        if (data.code === "VALIDATION") {
          const parsed = parseServerValidation(message);
          setFieldErrors(parsed.fields);
          setSubmitErrors(parsed.other);
        } else {
          setSubmitErrors([message]);
          // Stock, price or coupon state may have changed: refresh the server total
          if (res.status === 409 || data.code === "COUPON_INVALID" || data.code === "COD_LIMIT_EXCEEDED") {
            void fetchTotals(requestedCoupon, shippingTier);
          }
        }
        setIsSubmitting(false);
        showSummary();
        return;
      }

      window.location.href =
        typeof data.redirectTo === "string" && data.redirectTo.startsWith("/")
          ? data.redirectTo
          : `/orders/${data.orderId}`;
    } catch {
      setSubmitErrors(["We could not reach the server. Check your connection and try again."]);
      setIsSubmitting(false);
      showSummary();
    }
  };

  const errorEntries = FIELD_ORDER.filter((k) => fieldErrors[k]).map((k) => [k, fieldErrors[k] as string] as const);
  const hasSummary = errorEntries.length > 0 || submitErrors.length > 0;

  return (
    <form onSubmit={handleSubmitOrder} noValidate className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">
      {/* Checkout Inputs (Left 7 cols) */}
      <div className="lg:col-span-7 space-y-6 lg:space-y-8 min-w-0">
        {/* Error summary */}
        <div ref={summaryRef} tabIndex={-1} aria-live="assertive" className="focus:outline-none scroll-mt-24">
          {hasSummary && (
            <div role="alert" className="p-4 rounded-[20px] bg-rose-50 border border-rose-200 text-rose-800 text-sm space-y-2">
              <p className="font-bold flex items-center gap-2">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>
                  {errorEntries.length > 0
                    ? "Please fix the following before placing your order:"
                    : "Your order was not placed."}
                </span>
              </p>
              <ul className="list-disc pl-6 space-y-1 text-xs">
                {errorEntries.map(([key, msg]) => (
                  <li key={key}>
                    <a href={`#${fieldId(key)}`} className="underline font-semibold">
                      {FIELD_LABELS[key]}
                    </a>
                    : {msg}
                  </li>
                ))}
                {submitErrors.map((msg) => (
                  <li key={msg}>{msg}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* 1. Contact Information */}
        <section aria-labelledby="checkout-contact-heading" className="bg-white p-4 sm:p-6 rounded-[20px] border border-line space-y-4 ">
          <div className="flex items-center gap-2 pb-3 border-b border-line-soft">
            <div aria-hidden className="w-6 h-6 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center">
              1
            </div>
            <h2 id="checkout-contact-heading" className="font-bold text-base text-ink">Contact Information</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id={fieldId("email")}
              label="Email address"
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              required
              placeholder="you@example.com"
              value={email}
              error={fieldErrors.email}
              helperText="Order updates are sent here."
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }));
              }}
            />
            <Input
              id={fieldId("phone")}
              label="Mobile phone"
              type="tel"
              name="phone"
              autoComplete="tel"
              inputMode="tel"
              required
              placeholder="0300 1234567"
              value={address.phone}
              error={fieldErrors.phone}
              helperText="The courier calls this number to arrange delivery."
              onChange={(e) => updateField("phone", e.target.value)}
            />
          </div>
        </section>

        {/* 2. Shipping Address */}
        <section aria-labelledby="checkout-address-heading" className="bg-white p-4 sm:p-6 rounded-[20px] border border-line space-y-4 ">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-line-soft">
            <div className="flex items-center gap-2">
              <div aria-hidden className="w-6 h-6 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center">
                2
              </div>
              <h2 id="checkout-address-heading" className="font-bold text-base text-ink">Delivery Address</h2>
            </div>
            <span className="text-xs text-mute flex items-center gap-1">
              <MapPin size={13} className="text-brand-600" />
              <span>Pakistan only</span>
            </span>
          </div>

          {savedAddresses.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold tracking-normal text-ink-2 mb-2">
                Deliver to
              </legend>
              {savedAddresses.map((a) => {
                const valid = isAddressValidForPakistan(a);
                const checked = selectedAddressId === a.id;
                return (
                  <label
                    key={a.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      checked ? "border-brand-600 bg-brand-50/40" : "border-line hover:border-line"
                    }`}
                  >
                    <input
                      type="radio"
                      name="saved-address"
                      value={a.id}
                      checked={checked}
                      onChange={() => selectSavedAddress(a.id)}
                      className="mt-1 h-4 w-4 accent-brand-600"
                    />
                    <span className="text-xs text-mute leading-relaxed min-w-0">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-sm text-ink">{a.title || a.fullName}</span>
                        {a.isDefaultShipping && <Badge variant="success" size="sm">Default</Badge>}
                        {!valid && <Badge variant="warning" size="sm">Needs updating</Badge>}
                      </span>
                      <span className="block break-words">
                        {a.fullName} · {a.street1}
                        {a.street2 ? `, ${a.street2}` : ""}, {a.city}
                        {a.countryCode === "PK" && isProvince(a.stateProvince) ? `, ${a.stateProvince}` : ""}{" "}
                        {a.postalCode}
                      </span>
                      {!valid && (
                        <span className="block text-amber-700 mt-0.5">
                          Some details are missing or not valid for delivery in Pakistan. Complete the highlighted fields below.
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
              <label
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  selectedAddressId === "new" ? "border-brand-600 bg-brand-50/40" : "border-line hover:border-line"
                }`}
              >
                <input
                  type="radio"
                  name="saved-address"
                  value="new"
                  checked={selectedAddressId === "new"}
                  onChange={() => selectSavedAddress("new")}
                  className="h-4 w-4 accent-brand-600"
                />
                <span className="font-bold text-sm text-ink">Use a new address</span>
              </label>
            </fieldset>
          )}

          <div className="space-y-4">
            <Input
              id={fieldId("fullName")}
              label="Recipient full name"
              name="fullName"
              autoComplete="name"
              required
              placeholder="e.g. Muhammad Ali Khan"
              value={address.fullName}
              error={fieldErrors.fullName}
              onChange={(e) => updateField("fullName", e.target.value)}
            />

            <Input
              id={fieldId("street1")}
              label="Street address / house / flat"
              name="street1"
              autoComplete="address-line1"
              required
              placeholder="House 14-B, Street 3, Block 5"
              value={address.street1}
              error={fieldErrors.street1}
              onChange={(e) => updateField("street1", e.target.value)}
            />

            <Input
              id={fieldId("street2")}
              label="Nearby landmark / area (optional)"
              name="street2"
              autoComplete="address-line2"
              placeholder="e.g. near the main market"
              value={address.street2}
              error={fieldErrors.street2}
              onChange={(e) => updateField("street2", e.target.value)}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                id={fieldId("city")}
                label="City"
                name="city"
                autoComplete="address-level2"
                required
                list="checkout-city-suggestions"
                placeholder="e.g. Lahore"
                value={address.city}
                error={fieldErrors.city}
                onChange={(e) => updateField("city", e.target.value)}
              />
              <datalist id="checkout-city-suggestions">
                {POPULAR_PAKISTAN_CITIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>

              <div>
                <label
                  htmlFor={fieldId("stateProvince")}
                  className="block text-xs font-semibold tracking-normal text-ink-2 mb-1.5"
                >
                  Province / territory
                </label>
                <select
                  id={fieldId("stateProvince")}
                  name="stateProvince"
                  autoComplete="address-level1"
                  required
                  value={address.stateProvince}
                  onChange={(e) => updateField("stateProvince", e.target.value)}
                  aria-invalid={Boolean(fieldErrors.stateProvince)}
                  aria-describedby={fieldErrors.stateProvince ? `${fieldId("stateProvince")}-error` : undefined}
                  className={selectClass(Boolean(fieldErrors.stateProvince))}
                >
                  <option value="" disabled>
                    Select province
                  </option>
                  {PAKISTAN_PROVINCES.map((prov) => (
                    <option key={prov} value={prov}>
                      {prov}
                    </option>
                  ))}
                </select>
                {fieldErrors.stateProvince && (
                  <p id={`${fieldId("stateProvince")}-error`} role="alert" className="mt-1 text-xs text-rose-600 font-medium">
                    {fieldErrors.stateProvince}
                  </p>
                )}
              </div>

              <Input
                id={fieldId("postalCode")}
                label="Postal code"
                name="postalCode"
                autoComplete="postal-code"
                inputMode="numeric"
                maxLength={5}
                required
                placeholder="5 digits"
                value={address.postalCode}
                error={fieldErrors.postalCode}
                onChange={(e) => updateField("postalCode", e.target.value.replace(/[^\d]/g, ""))}
              />
            </div>

            <div>
              <label
                htmlFor={fieldId("countryCode")}
                className="block text-xs font-semibold tracking-normal text-ink-2 mb-1.5"
              >
                Country
              </label>
              <input
                id={fieldId("countryCode")}
                type="text"
                value="Pakistan"
                readOnly
                aria-describedby={`${fieldId("countryCode")}-helper`}
                className="w-full rounded-lg border border-line bg-canvas px-3.5 py-2.5 text-sm text-ink-2"
              />
              <p id={`${fieldId("countryCode")}-helper`} className="mt-1 text-xs text-mute">
                We currently deliver within Pakistan only.
              </p>
            </div>
          </div>
        </section>

        {/* 3. Delivery Method */}
        <section aria-labelledby="checkout-shipping-heading" className="bg-white p-4 sm:p-6 rounded-[20px] border border-line space-y-4 ">
          <div className="flex items-center gap-2 pb-3 border-b border-line-soft">
            <div aria-hidden className="w-6 h-6 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center">
              3
            </div>
            <h2 id="checkout-shipping-heading" className="font-bold text-base text-ink">Shipping Method</h2>
          </div>

          <div role="radiogroup" aria-labelledby="checkout-shipping-heading" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              role="radio"
              aria-checked={shippingTier === "STANDARD"}
              onClick={() => handleShippingTierChange("STANDARD")}
              className={`p-4 rounded-xl border text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                shippingTier === "STANDARD"
                  ? "border-brand-600 bg-brand-50/40 ring-2 ring-brand-500"
                  : "border-line hover:border-line"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-sm text-ink">Standard Delivery</span>
                <span className="text-xs font-bold text-brand-700">
                  {formatCurrency(shippingRates.standardMinor)}
                </span>
              </div>
              <p className="text-xs text-mute mt-1">
                3 - 5 business days. Charged per seller package; free on packages over{" "}
                {formatCurrency(shippingRates.freeThresholdMinor)}.
              </p>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={shippingTier === "EXPRESS"}
              onClick={() => handleShippingTierChange("EXPRESS")}
              className={`p-4 rounded-xl border text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                shippingTier === "EXPRESS"
                  ? "border-brand-600 bg-brand-50/40 ring-2 ring-brand-500"
                  : "border-line hover:border-line"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-sm text-ink">Express Priority</span>
                <span className="text-xs font-bold text-ink-2">
                  {formatCurrency(shippingRates.expressMinor)}
                </span>
              </div>
              <p className="text-xs text-mute mt-1">1 - 2 business days. Charged per seller package.</p>
            </button>
          </div>
        </section>

        {/* 4. Payment Method Selection */}
        <section aria-labelledby="checkout-payment-heading" className="bg-white p-4 sm:p-6 rounded-[20px] border border-line space-y-4 ">
          <div className="flex items-center gap-2 pb-3 border-b border-line-soft">
            <div aria-hidden className="w-6 h-6 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center">
              4
            </div>
            <h2 id="checkout-payment-heading" className="font-bold text-base text-ink">Payment Method</h2>
          </div>

          {paymentMethods.length === 0 ? (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>
                No payment method is available right now, so orders cannot be placed. Please try again later or contact support.
              </span>
            </div>
          ) : (
            <div role="radiogroup" aria-labelledby="checkout-payment-heading" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {paymentMethods.map((m) => {
                const selected = paymentMethod === m.id;
                const isCod = m.id === "CASH_ON_DELIVERY";
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setPaymentMethod(m.id)}
                    className={`p-4 rounded-xl border text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                      selected
                        ? "border-brand-600 bg-brand-50/50 ring-2 ring-brand-500"
                        : "border-line hover:border-line"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-bold text-sm text-ink flex items-center gap-1.5">
                        {isCod ? (
                          <Banknote size={16} className="text-brand-600" />
                        ) : (
                          <CreditCard size={16} className="text-mute" />
                        )}
                        <span>{m.label}</span>
                      </span>
                      {!isCod && <Badge variant="neutral" size="sm">Test mode</Badge>}
                    </div>
                    <p className="text-xs text-mute leading-relaxed">{m.description}</p>
                  </button>
                );
              })}
            </div>
          )}

          {codEnabled && paymentMethod === "CASH_ON_DELIVERY" && !codExceeded && (
            <div className="p-3.5 rounded-xl bg-brand-50/60 border border-brand-200 text-xs text-brand-900 flex items-start gap-2">
              <Check size={16} className="text-brand-600 flex-shrink-0 mt-0.5" />
              <span>
                Pay in cash when your parcel arrives. Please keep the exact amount ready for the courier.
              </span>
            </div>
          )}

          {codExceeded && (
            <div role="alert" className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>
                Cash on delivery is available for orders up to {formatCurrency(codLimitMinor)}. Your total is{" "}
                {formatCurrency(totals?.totalMinor ?? 0)}.{" "}
                {otherMethodThanCod
                  ? `Choose ${otherMethodThanCod.label} or reduce the items in your cart.`
                  : "Please reduce the items in your cart to continue."}
              </span>
            </div>
          )}

          {paymentMethod === "ONLINE_SANDBOX" && (
            <div className="p-3.5 rounded-xl bg-canvas border border-line text-xs text-ink-2 flex items-start gap-2">
              <Lock size={16} className="text-mute flex-shrink-0 mt-0.5" />
              <span>Test-mode payment: no money is charged. This option is not available on the live store.</span>
            </div>
          )}
        </section>
      </div>

      {/* Right Column: Order Summary & Placement (5 cols) */}
      <div className="lg:col-span-5 space-y-6 min-w-0">
        <section aria-labelledby="checkout-summary-heading" className="bg-white p-4 sm:p-6 rounded-[20px] border border-line space-y-6 lg:sticky lg:top-24">
          <h2 id="checkout-summary-heading" className="font-semibold text-base text-ink pb-3 border-b border-line-soft">
            Order Summary
          </h2>

          {/* Coupon Code Input */}
          <div className="space-y-2">
            <label htmlFor="checkout-coupon" className="block text-xs font-semibold tracking-normal text-ink-2">
              Coupon code
            </label>
            <div className="flex gap-2">
              <input
                id="checkout-coupon"
                type="text"
                autoComplete="off"
                placeholder="Enter code"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (couponInput.trim()) handleApplyCoupon();
                  }
                }}
                aria-invalid={Boolean(totals?.couponError)}
                aria-describedby="checkout-coupon-status"
                className="flex-1 min-w-0 text-sm uppercase font-mono font-semibold rounded-lg border border-line px-3 py-2 bg-canvas focus:bg-white focus:outline-none focus:ring-2 focus:ring-ink/15"
              />
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={handleApplyCoupon}
                disabled={!couponInput.trim() || isLoadingTotals}
              >
                Apply
              </Button>
            </div>
            <div id="checkout-coupon-status" aria-live="polite" className="text-[11px] font-semibold">
              {appliedCode ? (
                <p className="text-brand-700 flex items-center gap-1 flex-wrap">
                  <Check size={12} />
                  <span>Coupon {appliedCode} applied</span>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="ml-1 inline-flex items-center gap-0.5 text-mute hover:text-rose-600 underline min-h-[24px]"
                  >
                    <X size={11} /> Remove
                  </button>
                </p>
              ) : totals?.couponError && requestedCoupon ? (
                <p className="text-rose-600 flex items-center gap-1">
                  <AlertCircle size={12} />
                  <span>
                    {requestedCoupon.toUpperCase()}: {totals.couponError}
                  </span>
                </p>
              ) : null}
              {couponPending && appliedCode && (
                <p className="text-mute font-normal mt-0.5">Press Apply to switch to the new code.</p>
              )}
              {couponPending && !appliedCode && !totals?.couponError && (
                <p className="text-mute font-normal">Press Apply to check this code. Unapplied codes are not used.</p>
              )}
            </div>
          </div>

          {/* Calculations */}
          <div aria-live="polite" aria-busy={isLoadingTotals}>
            {isLoadingTotals && !totals ? (
              <div className="space-y-3 animate-pulse" aria-label="Calculating your total">
                <div className="h-3 bg-canvas rounded w-full" />
                <div className="h-3 bg-canvas rounded w-5/6" />
                <div className="h-5 bg-canvas rounded w-2/3 mt-4" />
              </div>
            ) : totals ? (
              <div className={`space-y-3 text-xs transition-opacity ${isLoadingTotals ? "opacity-60" : ""}`}>
                <div className="flex justify-between text-mute">
                  <span>Items subtotal</span>
                  <span className="font-semibold text-ink">{formatCurrency(totals.subtotalMinor)}</span>
                </div>

                {totals.discountMinor > 0 && (
                  <div className="flex justify-between text-brand-700 font-semibold">
                    <span className="flex items-center gap-1">
                      <Tag size={12} />
                      <span>Coupon discount{appliedCode ? ` (${appliedCode})` : ""}</span>
                    </span>
                    <span>-{formatCurrency(totals.discountMinor)}</span>
                  </div>
                )}

                <div className="flex justify-between text-mute">
                  <span>Shipping ({shippingTier === "STANDARD" ? "Standard" : "Express"})</span>
                  <span className="font-semibold text-ink">
                    {totals.shippingMinor === 0 ? "FREE" : formatCurrency(totals.shippingMinor)}
                  </span>
                </div>

                {totals.taxMinor > 0 && (
                  <div className="flex justify-between text-mute">
                    <span>Sales tax</span>
                    <span className="font-semibold text-ink">{formatCurrency(totals.taxMinor)}</span>
                  </div>
                )}

                <div className="pt-3 border-t border-line-soft flex justify-between text-base font-semibold text-ink">
                  <span>Total</span>
                  <span className="text-brand-700">{formatCurrency(totals.totalMinor)}</span>
                </div>
              </div>
            ) : totalsError ? (
              <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs space-y-2">
                <p className="flex items-start gap-2">
                  <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                  <span>{totalsError}</span>
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void fetchTotals(requestedCoupon, shippingTier)}
                    className="inline-flex items-center gap-1 font-semibold underline min-h-[32px]"
                  >
                    <RefreshCw size={12} /> Try again
                  </button>
                  <Link href="/cart" className="inline-flex items-center font-semibold underline min-h-[32px]">
                    Review cart
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          {submitBlockedReason && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{submitBlockedReason}</span>
            </p>
          )}

          {hasSummary && (
            <p className="text-xs text-rose-700 lg:hidden">
              Your order was not placed. See the messages at the top of the form.
            </p>
          )}

          {/* Confirm & Place Order Button */}
          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting || isLoadingTotals || Boolean(submitBlockedReason)}
            isLoading={isSubmitting}
            className="w-full shadow-brand-600/25 font-bold"
          >
            {paymentMethod === "ONLINE_SANDBOX" ? (
              <>
                <Lock size={18} />
                <span>Place order and pay (test mode)</span>
              </>
            ) : (
              <>
                <Banknote size={18} />
                <span>Place order, pay on delivery</span>
              </>
            )}
          </Button>

          <p className="text-[11px] text-center text-mute">
            Prices, stock and totals are re-checked when you place the order. Items are held for you while the order is created.
          </p>
        </section>
      </div>
    </form>
  );
}
