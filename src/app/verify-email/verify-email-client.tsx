"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { WizzLogo } from "@/components/wizz-logo";

type State = { status: "working" } | { status: "done" } | { status: "error"; message: string };

/**
 * Confirms the token with a POST from the browser. Email link scanners usually fetch the
 * page without running scripts, so they don't use up the single-use token.
 */
export function VerifyEmailClient({ token }: { token: string }) {
  const [state, setState] = useState<State>(
    token ? { status: "working" } : { status: "error", message: "This verification link is incomplete." }
  );
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "We could not verify your email.");
        setState({ status: "done" });
      } catch (err: unknown) {
        setState({ status: "error", message: err instanceof Error ? err.message : "We could not verify your email." });
      }
    })();
  }, [token]);

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-[28px] border border-line/90 p-8 space-y-6 text-center">
        <div className="flex justify-center">
          <WizzLogo size="lg" />
        </div>
        <h1 className="text-xl font-bold text-ink">Verify your email</h1>

        {state.status === "working" && (
          <p role="status" className="text-sm text-mute flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            <span>Confirming your email address…</span>
          </p>
        )}

        {state.status === "done" && (
          <div role="status" className="space-y-4">
            <p className="text-sm text-emerald-800 flex items-center justify-center gap-2">
              <CheckCircle2 size={18} aria-hidden="true" />
              <span>Your email address is verified. Thank you!</span>
            </p>
            <Link
              href="/account"
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-bold text-white hover:bg-brand-700"
            >
              Go to your account
            </Link>
          </div>
        )}

        {state.status === "error" && (
          <div role="alert" className="space-y-4">
            <p className="text-sm text-rose-700 flex items-center justify-center gap-2">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{state.message}</span>
            </p>
            <p className="text-xs text-mute">You can send a new link from your account&apos;s security page.</p>
            <Link
              href="/account/security"
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-line bg-white px-4 text-sm font-medium text-ink-2 hover:bg-canvas"
            >
              Account security
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
