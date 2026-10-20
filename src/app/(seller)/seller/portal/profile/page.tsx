"use client";

import React, { useEffect, useState } from "react";
import { Store, Building2, MapPin, DollarSign, CheckCircle2, AlertCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SellerProfilePage() {
  const [profile, setProfile] = useState<{
    id: string;
    name: string;
    slug: string;
    legalName: string;
    contactEmail: string;
    contactPhone?: string | null;
    city?: string | null;
    addressLine?: string | null;
    bankName?: string | null;
    bankAccountTitle?: string | null;
    bankIban?: string | null;
    commissionRatePercent: number;
    operationalStatus: string;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/seller/profile");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load profile");
      setProfile(data.profile);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setIsSaving(true);
    setError(null);
    setFeedback(null);

    try {
      const res = await fetch("/api/seller/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name,
          contactEmail: profile.contactEmail,
          contactPhone: profile.contactPhone,
          city: profile.city,
          addressLine: profile.addressLine,
          bankName: profile.bankName,
          bankAccountTitle: profile.bankAccountTitle,
          bankIban: profile.bankIban,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save profile changes");

      setProfile(data.profile);
      setFeedback("Store profile and settlement settings updated successfully.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error saving profile");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-xs text-slate-400">
        Loading merchant profile...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8 bg-rose-50 rounded-2xl text-rose-800 text-xs">
        Failed to load store profile.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Store Profile & Settings
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage public merchant branding, warehouse logistics pickup address, and settlement bank credentials.
        </p>
      </div>

      {feedback && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{feedback}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        {/* Public Store Identity */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-sm space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Store size={18} className="text-indigo-600" />
            <h2 className="font-bold text-sm text-slate-900">Public Store Identity</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Store Trading Name"
              required
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            />
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Merchant Slug Identifier
              </label>
              <input
                disabled
                value={profile.slug}
                className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-slate-50 text-slate-500 font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Store URL: wizz.pk/sellers/{profile.slug}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Customer Support Email"
              type="email"
              required
              value={profile.contactEmail}
              onChange={(e) => setProfile({ ...profile, contactEmail: e.target.value })}
            />
            <Input
              label="Customer Support Phone"
              type="tel"
              value={profile.contactPhone || ""}
              onChange={(e) => setProfile({ ...profile, contactPhone: e.target.value })}
            />
          </div>
        </div>

        {/* Fulfillment & Warehouse Address */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-sm space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <MapPin size={18} className="text-indigo-600" />
            <h2 className="font-bold text-sm text-slate-900">Warehouse Fulfillment & Return Address</h2>
          </div>

          <p className="text-xs text-slate-500">
            Couriers (TCS, Leopards, Trax, PostEx) will pick up merchant packages and route customer returns to this location.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Hub / City
              </label>
              <select
                value={profile.city || "Karachi"}
                onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Karachi">Karachi</option>
                <option value="Lahore">Lahore</option>
                <option value="Islamabad">Islamabad</option>
                <option value="Rawalpindi">Rawalpindi</option>
                <option value="Faisalabad">Faisalabad</option>
                <option value="Multan">Multan</option>
                <option value="Peshawar">Peshawar</option>
                <option value="Sialkot">Sialkot</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <Input
                label="Full Street & Unit Address"
                required
                value={profile.addressLine || ""}
                onChange={(e) => setProfile({ ...profile, addressLine: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Settlement & Banking */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <DollarSign size={18} className="text-emerald-600" />
              <h2 className="font-bold text-sm text-slate-900">Settlement Bank Account</h2>
            </div>
            <span className="text-xs font-bold text-slate-500">
              Platform Fee: <strong className="text-slate-900">{profile.commissionRatePercent}%</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Bank Name"
              placeholder="e.g. Meezan Bank / HBL"
              value={profile.bankName || ""}
              onChange={(e) => setProfile({ ...profile, bankName: e.target.value })}
            />
            <Input
              label="Account Title"
              placeholder="e.g. Apex Sports Gear"
              value={profile.bankAccountTitle || ""}
              onChange={(e) => setProfile({ ...profile, bankAccountTitle: e.target.value })}
            />
            <Input
              label="24-Digit IBAN"
              placeholder="PK36MEZN0001234567890123"
              value={profile.bankIban || ""}
              onChange={(e) => setProfile({ ...profile, bankIban: e.target.value })}
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            size="lg"
            isLoading={isSaving}
            disabled={isSaving}
            className="shadow-md shadow-indigo-600/20"
          >
            <Save size={16} />
            <span>Save Profile & Settlement Changes</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
