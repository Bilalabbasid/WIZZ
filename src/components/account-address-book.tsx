"use client";

import React, { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Plus, Trash2, Pencil, AlertCircle, X } from "lucide-react";
import { PAKISTAN_PROVINCES, normalizePakistanPhone } from "@/lib/validation";

export interface SavedAddress {
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
  isDefaultShipping: boolean;
}

type FormValues = {
  title: string;
  fullName: string;
  phone: string;
  street1: string;
  street2: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  isDefaultShipping: boolean;
};

const EMPTY_FORM: FormValues = {
  title: "",
  fullName: "",
  phone: "",
  street1: "",
  street2: "",
  city: "",
  stateProvince: "",
  postalCode: "",
  isDefaultShipping: false,
};

const PROVINCES: readonly string[] = PAKISTAN_PROVINCES;

function toFormValues(a: SavedAddress): FormValues {
  const isPk = a.countryCode === "PK";
  return {
    title: a.title ?? "",
    fullName: a.fullName,
    phone: a.phone,
    street1: a.street1,
    street2: a.street2 ?? "",
    city: isPk ? a.city : "",
    // Older saved data may hold a non-Pakistani region (e.g. "WA"); make the user pick again.
    stateProvince: isPk && PROVINCES.includes(a.stateProvince) ? a.stateProvince : "",
    postalCode: isPk && /^\d{5}$/.test(a.postalCode) ? a.postalCode : "",
    isDefaultShipping: a.isDefaultShipping,
  };
}

function validateForm(v: FormValues): Record<string, string> {
  const errs: Record<string, string> = {};
  if (v.title.trim().length > 40) errs.title = "Label must be at most 40 characters.";
  if (v.fullName.trim().length < 2) errs.fullName = "Enter the recipient's full name.";
  if (!normalizePakistanPhone(v.phone))
    errs.phone = "Enter a valid Pakistani phone number, e.g. 0300 1234567 or +92 300 1234567.";
  if (v.street1.trim().length < 5) errs.street1 = "Enter the street address (at least 5 characters).";
  if (v.city.trim().length < 2) errs.city = "Enter the city.";
  if (!PROVINCES.includes(v.stateProvince)) errs.stateProvince = "Select a valid Pakistani province or territory.";
  if (!/^\d{5}$/.test(v.postalCode.trim())) errs.postalCode = "Postal code must be 5 digits.";
  return errs;
}

const inputBase =
  "w-full text-sm rounded-xl border px-3 py-2.5 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-ink/15 bg-white";

export function AccountAddressBook({ initialAddresses }: { initialAddresses: SavedAddress[] }) {
  const [addresses, setAddresses] = useState<SavedAddress[]>(initialAddresses);
  const [editing, setEditing] = useState<SavedAddress | "new" | null>(null);
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) return;
    firstFieldRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) setEditing(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, isSubmitting]);

  const openNew = () => {
    setForm({ ...EMPTY_FORM, isDefaultShipping: addresses.length === 0 });
    setFieldErrors({});
    setFormError(null);
    setEditing("new");
  };

  const openEdit = (a: SavedAddress) => {
    setForm(toFormValues(a));
    setFieldErrors({});
    setFormError(null);
    setEditing(a);
  };

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const errs = validateForm(form);
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      setFormError("Please fix the highlighted fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...(editing && editing !== "new" ? { id: editing.id } : {}),
        title: form.title.trim() || undefined,
        fullName: form.fullName,
        phone: form.phone,
        street1: form.street1,
        street2: form.street2 || undefined,
        city: form.city,
        stateProvince: form.stateProvince,
        postalCode: form.postalCode.trim(),
        countryCode: "PK",
        isDefaultShipping: form.isDefaultShipping,
      };
      const res = await fetch("/api/account/addresses", {
        method: editing === "new" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.fieldErrors) {
          setFieldErrors(data.fieldErrors);
          throw new Error("Please fix the highlighted fields.");
        }
        throw new Error(data.error || "Could not save this address.");
      }
      if (Array.isArray(data.addresses)) setAddresses(data.addresses);
      setEditing(null);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Could not save this address.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    setActionLoading(id);
    setListError(null);
    try {
      const res = await fetch("/api/account/addresses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isDefaultShipping: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not change the default address.");
      if (Array.isArray(data.addresses)) setAddresses(data.addresses);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Could not change the default address.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (addr: SavedAddress) => {
    if (!confirm(`Remove the address for ${addr.fullName}?`)) return;
    setActionLoading(addr.id);
    setListError(null);
    try {
      const res = await fetch(`/api/account/addresses?id=${encodeURIComponent(addr.id)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not remove this address.");
      // Server returns the list after promoting a new default, so the badge matches the database.
      setAddresses(Array.isArray(data.addresses) ? data.addresses : (prev) => prev.filter((a) => a.id !== addr.id));
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Could not remove this address.");
    } finally {
      setActionLoading(null);
    }
  };

  const fieldError = (name: string) =>
    fieldErrors[name] ? (
      <p id={`addr-${name}-error`} className="mt-1 text-xs text-rose-600">
        {fieldErrors[name]}
      </p>
    ) : null;

  const inputProps = (name: keyof FormValues) => ({
    id: `addr-${name}`,
    "aria-invalid": Boolean(fieldErrors[name]),
    "aria-describedby": fieldErrors[name] ? `addr-${name}-error` : undefined,
    className: `${inputBase} ${fieldErrors[name] ? "border-rose-400" : "border-line"}`,
  });

  const labelClass = "font-bold text-xs text-ink-2 block mb-1";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-ink flex items-center gap-2">
          <MapPin size={20} className="text-brand-600" aria-hidden="true" />
          <span>Saved Addresses</span>
        </h2>
        <Button size="md" onClick={openNew}>
          <Plus size={15} aria-hidden="true" />
          <span>Add address</span>
        </Button>
      </div>

      {listError && (
        <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle size={15} aria-hidden="true" />
          <span>{listError}</span>
        </div>
      )}

      <div className="space-y-4">
        {addresses.length === 0 ? (
          <div className="p-8 rounded-[20px] bg-white border border-line text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-canvas text-mute-2 flex items-center justify-center mx-auto">
              <MapPin size={22} aria-hidden="true" />
            </div>
            <p className="text-sm font-semibold text-ink-2">No saved addresses</p>
            <p className="text-xs text-mute max-w-xs mx-auto">
              Save a delivery address to fill in checkout faster.
            </p>
            <Button size="md" onClick={openNew} variant="outline">
              Add your first address
            </Button>
          </div>
        ) : (
          addresses.map((addr) => {
            const busy = actionLoading === addr.id;
            const needsUpdate = addr.countryCode !== "PK" || !PROVINCES.includes(addr.stateProvince);
            return (
              <div
                key={addr.id}
                className="p-5 rounded-[20px] bg-white border border-line space-y-3 text-xs text-mute "
                aria-busy={busy}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-sm text-ink">{addr.title || "Address"}</span>
                  {addr.isDefaultShipping ? (
                    <Badge variant="success" size="sm">
                      Default shipping
                    </Badge>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(addr.id)}
                      disabled={actionLoading !== null}
                      className="min-h-[44px] px-2 text-xs font-semibold text-brand-700 hover:text-brand-900 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {busy ? "Saving…" : "Set as default"}
                    </button>
                  )}
                </div>

                <div className="space-y-0.5 text-ink-2">
                  <p className="font-bold text-ink">{addr.fullName}</p>
                  <p>{addr.street1}</p>
                  {addr.street2 && <p>{addr.street2}</p>}
                  <p>
                    {addr.city}, {addr.stateProvince} {addr.postalCode}
                  </p>
                  <p className="font-semibold text-ink-2">{addr.countryCode === "PK" ? "Pakistan" : addr.countryCode}</p>
                  {addr.phone && <p className="text-mute pt-1 font-mono">{addr.phone}</p>}
                </div>

                {needsUpdate && (
                  <p className="text-[11px] font-semibold text-orange-700">
                    This address is outside our Pakistan delivery format. Edit it before using it at checkout.
                  </p>
                )}

                <div className="pt-2 border-t border-line-soft flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(addr)}
                    disabled={actionLoading !== null}
                    aria-label={`Edit address for ${addr.fullName}`}
                    className="min-h-[44px] px-3 text-xs text-ink-2 hover:text-ink flex items-center gap-1 font-semibold disabled:opacity-50"
                  >
                    <Pencil size={13} aria-hidden="true" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(addr)}
                    disabled={actionLoading !== null}
                    aria-label={`Remove address for ${addr.fullName}`}
                    className="min-h-[44px] px-3 text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1 font-semibold disabled:opacity-50"
                  >
                    <Trash2 size={13} aria-hidden="true" />
                    <span>{busy ? "Removing…" : "Remove"}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="address-dialog-title"
            className="bg-white rounded-[28px] max-w-lg w-full p-5 sm:p-8 space-y-5 shadow-2xl relative my-auto"
          >
            <button
              type="button"
              onClick={() => setEditing(null)}
              disabled={isSubmitting}
              aria-label="Close"
              className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center rounded-full text-mute-2 hover:text-mute hover:bg-canvas"
            >
              <X size={20} aria-hidden="true" />
            </button>

            <div className="pr-10">
              <h3 id="address-dialog-title" className="text-xl font-bold text-ink">
                {editing === "new" ? "Add delivery address" : "Edit delivery address"}
              </h3>
              <p className="text-xs text-mute mt-1">We currently deliver within Pakistan only.</p>
            </div>

            {formError && (
              <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle size={15} aria-hidden="true" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="addr-title" className={labelClass}>
                    Label <span className="font-normal text-mute">(optional)</span>
                  </label>
                  <input
                    {...inputProps("title")}
                    ref={firstFieldRef}
                    type="text"
                    value={form.title}
                    onChange={(e) => set("title", e.target.value)}
                    placeholder="e.g. Home, Office"
                    maxLength={40}
                  />
                  {fieldError("title")}
                </div>
                <div>
                  <label htmlFor="addr-phone" className={labelClass}>
                    Mobile number
                  </label>
                  <input
                    {...inputProps("phone")}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    placeholder="03XX XXXXXXX"
                    maxLength={30}
                    required
                  />
                  {fieldError("phone")}
                </div>
              </div>

              <div>
                <label htmlFor="addr-fullName" className={labelClass}>
                  Recipient full name
                </label>
                <input
                  {...inputProps("fullName")}
                  type="text"
                  autoComplete="name"
                  value={form.fullName}
                  onChange={(e) => set("fullName", e.target.value)}
                  maxLength={120}
                  required
                />
                {fieldError("fullName")}
              </div>

              <div>
                <label htmlFor="addr-street1" className={labelClass}>
                  Street address / house no.
                </label>
                <input
                  {...inputProps("street1")}
                  type="text"
                  autoComplete="address-line1"
                  value={form.street1}
                  onChange={(e) => set("street1", e.target.value)}
                  placeholder="House, street, sector / area"
                  maxLength={200}
                  required
                />
                {fieldError("street1")}
              </div>

              <div>
                <label htmlFor="addr-street2" className={labelClass}>
                  Apartment, floor, landmark <span className="font-normal text-mute">(optional)</span>
                </label>
                <input
                  {...inputProps("street2")}
                  type="text"
                  autoComplete="address-line2"
                  value={form.street2}
                  onChange={(e) => set("street2", e.target.value)}
                  maxLength={200}
                />
                {fieldError("street2")}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="addr-city" className={labelClass}>
                    City
                  </label>
                  <input
                    {...inputProps("city")}
                    type="text"
                    autoComplete="address-level2"
                    value={form.city}
                    onChange={(e) => set("city", e.target.value)}
                    maxLength={80}
                    required
                  />
                  {fieldError("city")}
                </div>
                <div>
                  <label htmlFor="addr-stateProvince" className={labelClass}>
                    Province
                  </label>
                  <select
                    {...inputProps("stateProvince")}
                    autoComplete="address-level1"
                    value={form.stateProvince}
                    onChange={(e) => set("stateProvince", e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Select province
                    </option>
                    {PROVINCES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  {fieldError("stateProvince")}
                </div>
                <div>
                  <label htmlFor="addr-postalCode" className={labelClass}>
                    Postal code
                  </label>
                  <input
                    {...inputProps("postalCode")}
                    type="text"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    value={form.postalCode}
                    onChange={(e) => set("postalCode", e.target.value.replace(/\D/g, "").slice(0, 5))}
                    placeholder="5 digits"
                    maxLength={5}
                    required
                  />
                  {fieldError("postalCode")}
                </div>
              </div>

              <div>
                <span className={labelClass}>Country</span>
                <p className="text-sm font-semibold text-ink-2">Pakistan</p>
              </div>

              <label htmlFor="addr-default" className="flex items-center gap-2 min-h-[44px] cursor-pointer">
                <input
                  id="addr-default"
                  type="checkbox"
                  checked={form.isDefaultShipping}
                  disabled={editing !== "new" && editing.isDefaultShipping}
                  onChange={(e) => set("isDefaultShipping", e.target.checked)}
                  className="w-4 h-4 rounded border-line text-brand-600 focus:ring-ink/15"
                />
                <span className="text-xs text-ink-2 font-medium">
                  {editing !== "new" && editing.isDefaultShipping
                    ? "This is your default shipping address"
                    : "Make this my default shipping address"}
                </span>
              </label>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-line-soft">
                <Button type="button" variant="outline" size="md" onClick={() => setEditing(null)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" size="md" isLoading={isSubmitting}>
                  {editing === "new" ? "Save address" : "Save changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
