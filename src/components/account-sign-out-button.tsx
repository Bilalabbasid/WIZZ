"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Signs out with POST (never GET, so a link or image can't log the user out), then leaves the account area. */
export function AccountSignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signOut = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", redirect: "manual" });
      // With redirect: "manual" a redirect response is an opaqueredirect (status 0).
      if (!res.ok && res.type !== "opaqueredirect" && res.status !== 0) {
        throw new Error("Sign out failed");
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("We could not sign you out. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-start sm:items-end gap-1">
      <Button
        variant="outline"
        size="md"
        type="button"
        onClick={signOut}
        isLoading={busy}
        className="text-slate-600 hover:text-rose-600"
      >
        {!busy && <LogOut size={15} aria-hidden="true" />}
        <span>Sign out</span>
      </Button>
      {error && (
        <p role="alert" className="text-xs text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
