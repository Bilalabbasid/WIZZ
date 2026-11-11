"use client";

import React, { useState } from "react";
import { AlertCircle, CheckCircle2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";

const MIN_LENGTH = 10; // mirrors registrationSchema.password in src/lib/validation.ts (enforced again on the server)

const inputClass =
  "w-full text-sm rounded-xl border px-3 py-2.5 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-ink/15 bg-white";

type FieldName = "currentPassword" | "newPassword" | "confirmPassword";

export function AccountPasswordForm() {
  const [values, setValues] = useState<Record<FieldName, string>>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const validate = () => {
    const { currentPassword, newPassword, confirmPassword } = values;
    const errs: Record<string, string> = {};
    if (!currentPassword) errs.currentPassword = "Enter your current password.";
    if (newPassword.length < MIN_LENGTH) errs.newPassword = `Password must be at least ${MIN_LENGTH} characters.`;
    else if (newPassword.length > 128) errs.newPassword = "Password must be at most 128 characters.";
    else if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword))
      errs.newPassword = "Password must include letters and numbers.";
    else if (newPassword === currentPassword)
      errs.newPassword = "Choose a new password that is different from your current one.";
    if (confirmPassword !== newPassword) errs.confirmPassword = "Passwords do not match.";
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
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.fieldErrors) setFieldErrors(data.fieldErrors);
        throw new Error(data.error || "Could not change your password.");
      }
      setValues({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setSuccess("Password changed. Use your new password next time you sign in.");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not change your password.");
    } finally {
      setSaving(false);
    }
  };

  const renderField = (name: FieldName, label: string, autoComplete: string, hint?: string) => {
    const describedBy = [hint ? `pw-${name}-hint` : "", fieldErrors[name] ? `pw-${name}-error` : ""]
      .filter(Boolean)
      .join(" ");
    return (
      <div>
        <label htmlFor={`pw-${name}`} className="block text-xs font-bold text-ink-2 mb-1">
          {label}
        </label>
        <input
          id={`pw-${name}`}
          type="password"
          autoComplete={autoComplete}
          value={values[name]}
          onChange={(e) => setValues((prev) => ({ ...prev, [name]: e.target.value }))}
          maxLength={128}
          required
          aria-invalid={Boolean(fieldErrors[name])}
          aria-describedby={describedBy || undefined}
          className={`${inputClass} ${fieldErrors[name] ? "border-rose-400" : "border-line"}`}
        />
        {hint && (
          <p id={`pw-${name}-hint`} className="mt-1 text-[11px] text-mute">
            {hint}
          </p>
        )}
        {fieldErrors[name] && (
          <p id={`pw-${name}-error`} className="mt-1 text-xs text-rose-600">
            {fieldErrors[name]}
          </p>
        )}
      </div>
    );
  };

  return (
    <section
      aria-labelledby="password-heading"
      className="bg-white rounded-[28px] border border-line p-6 space-y-4 shadow-xs"
    >
      <h2 id="password-heading" className="text-lg font-bold text-ink flex items-center gap-2">
        <KeyRound size={18} className="text-brand-600" aria-hidden="true" />
        <span>Change password</span>
      </h2>
      <form onSubmit={onSubmit} noValidate className="space-y-3">
        {renderField("currentPassword", "Current password", "current-password")}
        {renderField(
          "newPassword",
          "New password",
          "new-password",
          `At least ${MIN_LENGTH} characters, with letters and numbers.`
        )}
        {renderField("confirmPassword", "Confirm new password", "new-password")}

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

        <Button type="submit" size="md" variant="secondary" isLoading={saving}>
          Change password
        </Button>
      </form>
    </section>
  );
}
