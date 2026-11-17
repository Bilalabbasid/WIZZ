"use client";

import React, { useEffect, useState } from "react";
import { Store, MapPin, Landmark, CheckCircle2, AlertCircle, Save, ShieldAlert, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Profile {
  id: string;
  name: string;
  slug: string;
  legalName: string;
  contactEmail: string;
  contactPhone?: string | null;
  city?: string | null;
  addressLine?: string | null;
  commissionRatePercent: number;
  operationalStatus: string;
}

interface BankView {
  bankName: string | null;
  bankAccountTitle: string | null;
  bankIbanMasked: string | null;
  hasBankAccount: boolean;
  bankDetailsChangedAt: string | null;
  payoutHoldUntil: string | null;
  holdHours: number;
  history: Array<{
    id: string;
    createdAt: string;
    changedBy: string;
    bankName: string | null;
    previousIbanLast4: string | null;
    newIbanLast4: string | null;
  }>;
}

const EMPTY_BANK_FORM = { bankName: "", bankAccountTitle: "", bankIban: "", currentPassword: "" };

function formatWhen(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" });
}

export default function SellerProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bank, setBank] = useState<BankView | null>(null);
  const [canEditBank, setCanEditBank] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [bankFormOpen, setBankFormOpen] = useState(false);
  const [bankForm, setBankForm] = useState(EMPTY_BANK_FORM);
  const [bankSaving, setBankSaving] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);
  const [bankFeedback, setBankFeedback] = useState<string | null>(null);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/seller/profile", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load profile");
      setProfile(data.profile);
      setBank(data.bank);
      setCanEditBank(Boolean(data.canEditBank));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading profile");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(fetchProfile);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setIsSaving(true);
    setError(null);
    setFeedback(null);

    try {
      // Store details only: the payout bank account has its own protected form below
      const res = await fetch("/api/seller/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name,
          contactEmail: profile.contactEmail,
          contactPhone: profile.contactPhone,
          city: profile.city,
          addressLine: profile.addressLine,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save profile changes");

      setProfile(data.profile);
      setBank(data.bank);
      setFeedback("Store profile updated.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error saving profile");
    } finally {
      setIsSaving(false);
    }
  };

  const openBankForm = () => {
    setBankForm({ ...EMPTY_BANK_FORM, bankName: bank?.bankName ?? "", bankAccountTitle: bank?.bankAccountTitle ?? "" });
    setBankError(null);
    setBankFeedback(null);
    setBankFormOpen(true);
  };

  const handleBankChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setBankError(null);
    setBankFeedback(null);
    if (!bankForm.currentPassword) {
      setBankError("Enter your current password to confirm this change.");
      return;
    }
    setBankSaving(true);
    try {
      const res = await fetch("/api/seller/profile/bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bankForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not change the bank account.");
      setBank(data.bank);
      setBankForm(EMPTY_BANK_FORM);
      setBankFormOpen(false);
      setBankFeedback(
        `Payout account changed to ${data.bank.bankIbanMasked}. Payouts are paused until ${formatWhen(data.bank.payoutHoldUntil)}. All store owners and admins have been notified.`
      );
    } catch (err: unknown) {
      setBankError(err instanceof Error ? err.message : "Could not change the bank account.");
      setBankForm((f) => ({ ...f, currentPassword: "" }));
    } finally {
      setBankSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-xs text-slate-400" role="status">
        Loading merchant profile...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8 bg-rose-50 rounded-2xl text-rose-800 text-xs" role="alert">
        {error || "Failed to load store profile."}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
          Store Profile & Settings
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage public merchant branding, warehouse logistics pickup address, and the payout bank account.
        </p>
      </div>

      {feedback && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2" role="status">
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>{feedback}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        {/* Public Store Identity */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-sm space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Store size={18} className="text-brand-600" aria-hidden="true" />
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
              <label htmlFor="merchant-slug" className="block text-xs font-semibold font-mono uppercase tracking-[0.06em] text-slate-700 mb-1.5">
                Merchant Slug Identifier
              </label>
              <input
                id="merchant-slug"
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
            <MapPin size={18} className="text-brand-600" aria-hidden="true" />
            <h2 className="font-bold text-sm text-slate-900">Warehouse Fulfillment & Return Address</h2>
          </div>

          <p className="text-xs text-slate-500">
            Couriers (TCS, Leopards, Trax, PostEx) will pick up merchant packages and route customer returns to this location.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="hub-city" className="block text-xs font-semibold font-mono uppercase tracking-[0.06em] text-slate-700 mb-1.5">
                Hub / City
              </label>
              <select
                id="hub-city"
                value={profile.city || "Karachi"}
                onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
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

        <div className="flex justify-end">
          <Button type="submit" size="lg" isLoading={isSaving} disabled={isSaving} className="shadow-md shadow-brand-600/20">
            <Save size={16} aria-hidden="true" />
            <span>Save Store Profile</span>
          </Button>
        </div>
      </form>

      {/* Payout bank account (separate, password-protected) */}
      <section aria-labelledby="bank-h" className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Landmark size={18} className="text-emerald-600" aria-hidden="true" />
            <h2 id="bank-h" className="font-bold text-sm text-slate-900">Payout Bank Account</h2>
          </div>
          <span className="text-xs font-bold text-slate-500">
            Platform fee: <strong className="text-slate-900">{profile.commissionRatePercent}%</strong>
          </span>
        </div>

        {bankFeedback && (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2" role="status">
            <CheckCircle2 size={16} className="shrink-0" aria-hidden="true" />
            <span>{bankFeedback}</span>
          </div>
        )}

        {bank?.payoutHoldUntil && (
          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
            <ShieldAlert size={16} className="shrink-0" aria-hidden="true" />
            <span>
              This account was changed on {formatWhen(bank.bankDetailsChangedAt)}. For your security, payouts are paused until{" "}
              <strong>{formatWhen(bank.payoutHoldUntil)}</strong>.
            </span>
          </div>
        )}

        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <dt className="text-slate-500 font-semibold font-mono uppercase tracking-[0.06em] text-[10px]">Bank</dt>
            <dd className="text-slate-900 font-bold mt-0.5">{bank?.bankName || "Not set"}</dd>
          </div>
          <div>
            <dt className="text-slate-500 font-semibold font-mono uppercase tracking-[0.06em] text-[10px]">Account title</dt>
            <dd className="text-slate-900 font-bold mt-0.5">{bank?.bankAccountTitle || "Not set"}</dd>
          </div>
          <div>
            <dt className="text-slate-500 font-semibold font-mono uppercase tracking-[0.06em] text-[10px]">IBAN</dt>
            <dd className="text-slate-900 font-bold font-mono mt-0.5">{bank?.bankIbanMasked || "Not set"}</dd>
          </div>
        </dl>
        <p className="text-[11px] text-slate-500">
          For security only the last 4 digits are shown. WIZZ.PK finance pays your balance to this account by bank transfer.
        </p>

        {canEditBank ? (
          !bankFormOpen ? (
            <Button type="button" variant="outline" size="sm" onClick={openBankForm}>
              Change bank account
            </Button>
          ) : (
            <form onSubmit={handleBankChange} className="space-y-4 p-4 rounded-2xl border border-slate-200 bg-slate-50" aria-labelledby="bank-change-h">
              <h3 id="bank-change-h" className="text-sm font-bold text-slate-900">Change payout bank account</h3>
              <ul className="text-[11px] text-slate-600 list-disc pl-4 space-y-0.5">
                <li>Payouts are paused for {bank?.holdHours ?? 72} hours after a change, so a stolen login cannot redirect your money.</li>
                <li>Any payout already scheduled to the old account is cancelled and requested again after the pause.</li>
                <li>Every store owner and admin is notified of the change.</li>
              </ul>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Bank Name"
                  required
                  placeholder="e.g. Meezan Bank / HBL"
                  value={bankForm.bankName}
                  onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                />
                <Input
                  label="Account Title"
                  required
                  placeholder="Exactly as on the bank account"
                  value={bankForm.bankAccountTitle}
                  onChange={(e) => setBankForm({ ...bankForm, bankAccountTitle: e.target.value })}
                />
                <Input
                  label="New 24-Digit IBAN"
                  required
                  autoComplete="off"
                  placeholder="PK36MEZN0001234567890123"
                  value={bankForm.bankIban}
                  onChange={(e) => setBankForm({ ...bankForm, bankIban: e.target.value })}
                />
              </div>
              <div className="sm:max-w-xs">
                <Input
                  id="bank-current-password"
                  label="Your current password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={bankForm.currentPassword}
                  onChange={(e) => setBankForm({ ...bankForm, currentPassword: e.target.value })}
                  helperText="Required to confirm it's you."
                />
              </div>
              {bankError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2" role="alert">
                  <AlertCircle size={14} aria-hidden="true" />
                  <span>{bankError}</span>
                </div>
              )}
              <div className="flex flex-wrap gap-2 justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => setBankFormOpen(false)} disabled={bankSaving}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" isLoading={bankSaving} disabled={bankSaving}>
                  Change bank account
                </Button>
              </div>
            </form>
          )
        ) : (
          <p className="text-[11px] text-slate-500">Only the store owner or an admin can change the payout account.</p>
        )}

        {canEditBank && bank && bank.history.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <History size={14} aria-hidden="true" /> Change history
            </h3>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <caption className="sr-only">Payout bank account change history</caption>
                <thead className="bg-slate-50 text-slate-500 font-bold font-mono uppercase tracking-[0.06em] text-[10px]">
                  <tr>
                    <th scope="col" className="py-2 px-3">Date</th>
                    <th scope="col" className="py-2 px-3">Changed by</th>
                    <th scope="col" className="py-2 px-3">Bank</th>
                    <th scope="col" className="py-2 px-3">IBAN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {bank.history.map((h) => (
                    <tr key={h.id}>
                      <td className="py-2 px-3 whitespace-nowrap">{formatWhen(h.createdAt)}</td>
                      <td className="py-2 px-3">{h.changedBy}</td>
                      <td className="py-2 px-3">{h.bankName || "—"}</td>
                      <td className="py-2 px-3 font-mono whitespace-nowrap">
                        {h.previousIbanLast4 ? `•••• ${h.previousIbanLast4}` : "none"} → {h.newIbanLast4 ? `•••• ${h.newIbanLast4}` : "none"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
