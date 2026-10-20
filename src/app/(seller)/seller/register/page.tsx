"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Store, ShieldCheck, ArrowRight, AlertCircle, Building2, UserCheck, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SellerRegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    tradingName: "",
    legalBusinessName: "",
    city: "Karachi",
    addressLine: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/seller/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to register merchant account.");
      }

      router.push("/seller/onboarding");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error creating seller account");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl text-center space-y-3">
        <Link href="/" className="inline-flex items-center gap-2">
          <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-lg tracking-wider shadow-sm">
            W
          </div>
          <span className="text-2xl font-black text-slate-900 tracking-tight">WIZZ.PK</span>
        </Link>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <Store size={14} />
          <span>Merchant Network Registration</span>
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
          Start Selling on WIZZ.PK
        </h1>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Create your merchant user account and store organization. Log in immediately and access your onboarding workspace.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Store Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Building2 size={16} className="text-indigo-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Store & Business Identity
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Trading Store Name (Public)"
                  required
                  placeholder="e.g. Apex Sports Gear"
                  value={formData.tradingName}
                  onChange={(e) => setFormData({ ...formData, tradingName: e.target.value })}
                />
                <Input
                  label="Legal Business Name (Optional)"
                  placeholder="e.g. Apex Enterprises Pvt Ltd"
                  value={formData.legalBusinessName}
                  onChange={(e) => setFormData({ ...formData, legalBusinessName: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Hub / City
                  </label>
                  <select
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
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
                    label="Warehouse / Pickup Street Address"
                    placeholder="e.g. Plot 42, Sector 15, Korangi Industrial Area"
                    value={formData.addressLine}
                    onChange={(e) => setFormData({ ...formData, addressLine: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Merchant Account Login Credentials */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <UserCheck size={16} className="text-indigo-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Primary Merchant Account Login
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="First Name"
                  required
                  placeholder="Zubair"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                />
                <Input
                  label="Last Name"
                  required
                  placeholder="Khan"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Business Email Address"
                  type="email"
                  required
                  placeholder="merchant@apexgear.pk"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
                <Input
                  label="Direct Contact Phone (+92)"
                  type="tel"
                  placeholder="+92 300 1234567"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <Input
                label="Account Password"
                type="password"
                required
                placeholder="Minimum 8 characters"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full shadow-lg shadow-indigo-600/20"
              isLoading={isLoading}
              disabled={isLoading}
            >
              <span>Create Merchant Account & Enter Workspace</span>
              <ArrowRight size={16} />
            </Button>
          </form>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Already have an account?</span>
            <Link href="/login?next=/seller" className="font-bold text-slate-900 hover:underline">
              Log in to Seller Hub
            </Link>
          </div>
        </div>

        {/* Value Prop Badges */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 space-y-1">
            <Truck size={20} className="mx-auto text-indigo-600" />
            <h3 className="font-bold text-xs text-slate-900">Nationwide Fulfillment</h3>
            <p className="text-[11px] text-slate-500">Integrated COD with TCS, Leopards, Trax, PostEx</p>
          </div>
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 space-y-1">
            <ShieldCheck size={20} className="mx-auto text-emerald-600" />
            <h3 className="font-bold text-xs text-slate-900">Encrypted KYC</h3>
            <p className="text-[11px] text-slate-500">Bank-grade private document compliance storage</p>
          </div>
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 space-y-1">
            <Store size={20} className="mx-auto text-blue-600" />
            <h3 className="font-bold text-xs text-slate-900">Autonomous Catalog</h3>
            <p className="text-[11px] text-slate-500">Self-serve variants, images, and live inventory</p>
          </div>
        </div>
      </div>
    </div>
  );
}
