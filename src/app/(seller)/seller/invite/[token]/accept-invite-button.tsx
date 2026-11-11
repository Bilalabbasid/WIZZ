"use client";

import { useState } from "react";

export function AcceptInviteButton({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  const accept = async () => {
    setState("loading");
    setError("");
    try {
      const res = await fetch("/api/seller/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not accept the invitation.");
      window.location.href = data.redirectTo || "/seller/portal";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not accept the invitation.");
      setState("error");
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={accept}
        disabled={state === "loading"}
        className="w-full rounded-xl bg-brand-700 px-4 py-2.5 font-bold text-white hover:bg-brand-800 disabled:opacity-60"
      >
        {state === "loading" ? "Joining…" : "Accept and open Seller Center"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}
