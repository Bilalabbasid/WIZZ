"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WizzLogo } from "@/components/wizz-logo";

const MIN_LENGTH = 10; // mirrors registrationSchema.password (enforced again on the server)

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const errs: Record<string, string> = {};
    if (password.length < MIN_LENGTH) errs.password = `Password must be at least ${MIN_LENGTH} characters.`;
    else if (password.length > 128) errs.password = "Password must be at most 128 characters.";
    else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) errs.password = "Password must include letters and numbers.";
    if (confirm !== password) errs.confirm = "Passwords do not match.";
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "We could not reset your password.");
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "We could not reset your password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-[28px] border border-line/90 p-8 space-y-6">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <WizzLogo size="lg" />
          </div>
          <h1 className="text-xl font-bold text-ink">Choose a new password</h1>
          <p className="text-xs text-mute">This signs you out on every device. You&apos;ll sign in again with the new password.</p>
        </div>

        {!token ? (
          <div role="alert" className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm space-y-2">
            <p>This reset link is incomplete. Open the link from your email again, or request a new one.</p>
            <Link href="/forgot-password" className="font-bold underline">
              Request a new link
            </Link>
          </div>
        ) : done ? (
          <div role="status" className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm space-y-3">
            <p className="flex items-start gap-2">
              <CheckCircle2 size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
              <span>Your password has been changed.</span>
            </p>
            <Link
              href="/login?reset=1"
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-bold text-white hover:bg-brand-700"
            >
              Sign in
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs space-y-1">
                <p className="flex items-center gap-2">
                  <AlertCircle size={15} aria-hidden="true" />
                  <span>{error}</span>
                </p>
                {/expired|invalid|used/i.test(error) && (
                  <Link href="/forgot-password" className="font-bold underline">
                    Request a new link
                  </Link>
                )}
              </div>
            )}
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <Input
                id="reset-password"
                label="New password"
                type="password"
                autoComplete="new-password"
                required
                minLength={MIN_LENGTH}
                helperText="At least 10 characters, with letters and numbers."
                error={fieldErrors.password}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Input
                id="reset-confirm"
                label="Confirm new password"
                type="password"
                autoComplete="new-password"
                required
                error={fieldErrors.confirm}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              <Button type="submit" size="lg" className="w-full" isLoading={busy}>
                <KeyRound size={16} aria-hidden="true" />
                <span>Save new password</span>
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
