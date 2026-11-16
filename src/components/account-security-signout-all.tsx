"use client";

import React, { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

/** "Sign out of all devices": revokes every session (including this one) and returns to sign-in. */
export function AccountSecuritySignOutAll() {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/logout-all", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "We could not sign you out everywhere.");
      // Full navigation so the header re-renders signed out.
      window.location.assign(new URL("/login", window.location.href).href);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "We could not sign you out everywhere.");
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="signout-all-heading" className="bg-white rounded-[20px] border border-line p-6 space-y-3">
      <h2 id="signout-all-heading" className="text-base font-bold text-ink">
        Signed-in devices
      </h2>
      <p className="text-sm text-mute">
        Lost a phone or used a shared computer? Sign out everywhere, including this browser. You&apos;ll need to sign in again.
      </p>
      {confirming ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="danger" onClick={run} isLoading={busy}>
            {!busy && <LogOut size={15} aria-hidden="true" />}
            <span>Yes, sign out everywhere</span>
          </Button>
          <Button type="button" variant="outline" onClick={() => setConfirming(false)} disabled={busy}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" onClick={() => setConfirming(true)}>
          <LogOut size={15} aria-hidden="true" />
          <span>Sign out of all devices</span>
        </Button>
      )}
      {error && (
        <p role="alert" className="text-xs text-rose-600">
          {error}
        </p>
      )}
    </section>
  );
}
