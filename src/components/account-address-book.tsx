"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Plus, Trash2, Check, AlertCircle, X, Loader2 } from "lucide-react";

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

const PAKISTAN_PROVINCES = [
  "Punjab",
  "Sindh",
  "Khyber Pakhtunkhwa",
  "Balochistan",
  "Islamabad Capital Territory",
  "Gilgit-Baltistan",
  "Azad Jammu & Kashmir",
];

export function AccountAddressBook({
  initialAddresses,
}: {
  initialAddresses: SavedAddress[];
}) {
  const [addresses, setAddresses] = useState<SavedAddress[]>(initialAddresses);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState("Home");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("+92 ");
  const [street1, setStreet1] = useState("");
  const [street2, setStreet2] = useState("");
  const [city, setCity] = useState("Karachi");
  const [stateProvince, setStateProvince] = useState("Sindh");
  const [postalCode, setPostalCode] = useState("75500");
  const [isDefault, setIsDefault] = useState(false);

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/account/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          fullName,
          phone,
          street1,
          street2: street2 || undefined,
          city,
          stateProvince,
          postalCode,
          isDefaultShipping: isDefault,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add address.");

      if (data.address.isDefaultShipping) {
        setAddresses((prev) => [
          data.address,
          ...prev.map((a) => ({ ...a, isDefaultShipping: false })),
        ]);
      } else {
        setAddresses((prev) => [...prev, data.address]);
      }

      setShowAddModal(false);
      // Reset form
      setFullName("");
      setStreet1("");
      setStreet2("");
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Error saving address");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch("/api/account/addresses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isDefaultShipping: true }),
      });
      if (res.ok) {
        setAddresses((prev) =>
          prev.map((a) => ({ ...a, isDefaultShipping: a.id === id }))
        );
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this address?")) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/account/addresses?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setAddresses((prev) => prev.filter((a) => a.id !== id));
      }
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <MapPin size={20} className="text-indigo-600" />
          <span>Saved Addresses</span>
        </h2>
        <Button
          size="sm"
          onClick={() => setShowAddModal(true)}
          className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
        >
          <Plus size={15} />
          <span>Add Address</span>
        </Button>
      </div>

      <div className="space-y-4">
        {addresses.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <MapPin size={22} />
            </div>
            <p className="text-sm font-semibold text-slate-700">No saved addresses</p>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Add your delivery addresses here for faster one-click checkout across Pakistan.
            </p>
            <Button size="sm" onClick={() => setShowAddModal(true)} variant="outline">
              Add First Address
            </Button>
          </div>
        ) : (
          addresses.map((addr) => (
            <div
              key={addr.id}
              className="p-5 rounded-2xl bg-white border border-slate-200 space-y-3 text-xs text-slate-600 shadow-sm transition-all hover:border-slate-300"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900">
                  {addr.title || "Address"}
                </span>
                {addr.isDefaultShipping ? (
                  <Badge variant="success" size="sm">
                    Default Shipping
                  </Badge>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(addr.id)}
                    disabled={actionLoading === addr.id}
                    className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    Set as Default
                  </button>
                )}
              </div>

              <div className="space-y-0.5 text-slate-700">
                <p className="font-bold text-slate-900">{addr.fullName}</p>
                <p>{addr.street1}</p>
                {addr.street2 && <p>{addr.street2}</p>}
                <p>
                  {addr.city}, {addr.stateProvince} {addr.postalCode}
                </p>
                <p className="font-semibold text-slate-800">{addr.countryCode}</p>
                {addr.phone && <p className="text-slate-500 pt-1 font-mono">{addr.phone}</p>}
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleDelete(addr.id)}
                  disabled={actionLoading === addr.id}
                  className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1 font-medium transition-colors"
                >
                  <Trash2 size={13} />
                  <span>Remove</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Address Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={20} />
            </button>

            <div>
              <h3 className="text-xl font-bold text-slate-900">Add New Shipping Address</h3>
              <p className="text-xs text-slate-500 mt-1">
                Save delivery locations for quick nationwide dispatch in Pakistan.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleAddAddress} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Address Label</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Home, Office"
                    className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Phone Number (+92)</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+92 300 1234567"
                    className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Full Recipient Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Asad Khan"
                  className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Street Address / House No.</label>
                <input
                  type="text"
                  value={street1}
                  onChange={(e) => setStreet1(e.target.value)}
                  placeholder="House 12, Street 4, Sector F-7/1"
                  className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Apartment, Floor, Unit (Optional)</label>
                <input
                  type="text"
                  value={street2}
                  onChange={(e) => setStreet2(e.target.value)}
                  placeholder="Apartment 4B"
                  className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Karachi"
                    className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Province</label>
                  <select
                    value={stateProvince}
                    onChange={(e) => setStateProvince(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 px-2 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    {PAKISTAN_PROVINCES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Postal Code</label>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="75500"
                    className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 pt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs text-slate-700 font-medium">Set as my default shipping address</span>
              </label>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                >
                  {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                  <span>Save Address</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
