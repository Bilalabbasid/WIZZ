"use client";

import React, { useState } from "react";
import { MailWarning } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Small notice for an unverified email address with a "send link" button.
 * Shopping is never blocked; this only nudges the customer.
 */
export function AccountSecurityVerifyEmail({ email, compact = false }: { email: string; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resend = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/verify-email/resend", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "We could not send the email.");
      setMessage(data.message || `We've sent a verification link to ${email}.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "We could not send the email.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`rounded-xl border border-amber-200 bg-amber-50 text-amber-900 ${compact ? "p-3" : "p-4"} flex flex-col sm:flex-row sm:items-center gap-3`}
    >
      <div className="flex items-start gap-2 flex-1 min-w-0">
        <MailWarning size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-sm">
          Please verify <span className="font-semibold break-all">{email}</span> so we can reach you about orders and
          account security.
        </p>
      </div>
      <div className="flex flex-col items-start sm:items-end gap-1">
        <Button type="button" variant="outline" size="sm" onClick={resend} isLoading={busy} disabled={Boolean(message)}>
          {message ? "Link sent" : "Send verification link"}
        </Button>
        {message && (
          <p role="status" className="text-xs text-emerald-800">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="text-xs text-rose-700">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
