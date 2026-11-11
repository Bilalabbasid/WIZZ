"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { normalizePakistanPhone } from "@/lib/validation";

const inputClass =
  "w-full text-sm rounded-xl border px-3 py-2.5 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-ink/15 bg-white";

export function AccountProfileForm({
  initialFirstName,
  initialLastName,
  initialPhone,
  email,
}: {
  initialFirstName: string;
  initialLastName: string;
  initialPhone: string;
  email: string;
}) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [phone, setPhone] = useState(initialPhone);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = "Enter your first name.";
    if (!lastName.trim()) errs.lastName = "Enter your last name.";
    if (phone.trim() && !normalizePakistanPhone(phone)) {
      errs.phone = "Enter a valid Pakistani phone number, e.g. 0300 1234567 or +92 300 1234567.";
    }
    return errs;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(null);
    setFormError(null);
    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.fieldErrors) setFieldErrors(data.fieldErrors);
        throw new Error(
          data.fieldErrors ? "Please fix the highlighted fields." : data.error || "Could not save your profile."
        );
      }
      setFirstName(data.profile.firstName);
      setLastName(data.profile.lastName);
      setPhone(data.profile.phone ?? "");
      setSuccess("Profile saved.");
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  };

  const errorFor = (name: string) =>
    fieldErrors[name] ? (
      <p id={`profile-${name}-error`} className="mt-1 text-xs text-rose-600">
        {fieldErrors[name]}
      </p>
    ) : null;

  return (
    <section
      aria-labelledby="profile-heading"
      className="bg-white rounded-[28px] border border-line p-6 space-y-4 shadow-xs"
    >
      <h2 id="profile-heading" className="text-lg font-bold text-ink flex items-center gap-2">
        <UserRound size={18} className="text-brand-600" aria-hidden="true" />
        <span>Profile</span>
      </h2>

      <form onSubmit={onSubmit} noValidate className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="profile-firstName" className="block text-xs font-bold text-ink-2 mb-1">
              First name
            </label>
            <input
              id="profile-firstName"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              maxLength={60}
              required
              aria-invalid={Boolean(fieldErrors.firstName)}
              aria-describedby={fieldErrors.firstName ? "profile-firstName-error" : undefined}
              className={`${inputClass} ${fieldErrors.firstName ? "border-rose-400" : "border-line"}`}
            />
            {errorFor("firstName")}
          </div>
          <div>
            <label htmlFor="profile-lastName" className="block text-xs font-bold text-ink-2 mb-1">
              Last name
            </label>
            <input
              id="profile-lastName"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              maxLength={60}
              required
              aria-invalid={Boolean(fieldErrors.lastName)}
              aria-describedby={fieldErrors.lastName ? "profile-lastName-error" : undefined}
              className={`${inputClass} ${fieldErrors.lastName ? "border-rose-400" : "border-line"}`}
            />
            {errorFor("lastName")}
          </div>
        </div>

        <div>
          <label htmlFor="profile-email" className="block text-xs font-bold text-ink-2 mb-1">
            Email
          </label>
          <input
            id="profile-email"
            value={email}
            readOnly
            aria-describedby="profile-email-hint"
            className={`${inputClass} border-line bg-canvas text-mute`}
          />
          <p id="profile-email-hint" className="mt-1 text-[11px] text-mute">
            To change your sign-in email, contact support.
          </p>
        </div>

        <div>
          <label htmlFor="profile-phone" className="block text-xs font-bold text-ink-2 mb-1">
            Mobile number <span className="font-normal text-mute">(optional)</span>
          </label>
          <input
            id="profile-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="03XX XXXXXXX"
            maxLength={30}
            aria-invalid={Boolean(fieldErrors.phone)}
            aria-describedby={fieldErrors.phone ? "profile-phone-error" : undefined}
            className={`${inputClass} font-mono ${fieldErrors.phone ? "border-rose-400" : "border-line"}`}
          />
          {errorFor("phone")}
        </div>

        <div aria-live="polite">
          {formError && (
            <p className="flex items-center gap-1.5 text-xs text-rose-600">
              <AlertCircle size={14} aria-hidden="true" />
              <span>{formError}</span>
            </p>
          )}
          {success && (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-700">
              <CheckCircle2 size={14} aria-hidden="true" />
              <span>{success}</span>
            </p>
          )}
        </div>

        <Button type="submit" size="md" isLoading={saving}>
          Save profile
        </Button>
      </form>
    </section>
  );
}
