"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";

type SavedState = { signedIn: boolean; ids: Set<string> };

/**
 * One GET /api/wishlist?idsOnly=1 per page load, shared by every heart on the page.
 * A 401 (guest) or network failure resolves to "nothing saved".
 */
let savedStatePromise: Promise<SavedState> | null = null;

function loadSavedState(): Promise<SavedState> {
  if (!savedStatePromise) {
    savedStatePromise = fetch("/api/wishlist?idsOnly=1", { cache: "no-store", credentials: "same-origin" })
      .then(async (res) => {
        if (res.status === 401) return { signedIn: false, ids: new Set<string>() };
        if (!res.ok) throw new Error("wishlist unavailable");
        const data = (await res.json()) as { productIds?: string[] };
        return { signedIn: true, ids: new Set(data.productIds ?? []) };
      })
      .catch(() => {
        // Allow a retry on the next mount instead of caching the failure forever.
        savedStatePromise = null;
        return { signedIn: true, ids: new Set<string>() };
      });
  }
  return savedStatePromise;
}

function rememberLocally(productId: string, saved: boolean) {
  if (!savedStatePromise) return;
  savedStatePromise = savedStatePromise.then((state) => {
    const ids = new Set(state.ids);
    if (saved) ids.add(productId);
    else ids.delete(productId);
    return { signedIn: true, ids };
  });
}

function loginHref() {
  const next = `${window.location.pathname}${window.location.search}`;
  return `/login?next=${encodeURIComponent(next)}`;
}

export interface WishlistButtonProps {
  productId: string;
  productTitle: string;
  className?: string;
  variant?: "icon" | "round" | "full";
}

export function WishlistButton({ productId, productTitle, className = "", variant = "icon" }: WishlistButtonProps) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadSavedState().then((state) => {
      if (active) setSaved(state.ids.has(productId));
    });
    return () => {
      active = false;
    };
  }, [productId]);

  const toggle = async (e: React.MouseEvent<HTMLButtonElement>) => {
    // Cards wrap the button in a link; keep the click from navigating.
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;

    const next = !saved;
    setSaved(next); // optimistic
    setBusy(true);
    setError(null);
    try {
      const res = next
        ? await fetch("/api/wishlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId }),
          })
        : await fetch(`/api/wishlist?productId=${encodeURIComponent(productId)}`, { method: "DELETE" });

      if (res.status === 401) {
        setSaved(!next);
        router.push(loginHref());
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data?.error === "string" ? data.error : "Could not update your wishlist.");
      }
      rememberLocally(productId, next);
    } catch (err) {
      setSaved(!next); // revert
      setError(err instanceof Error ? err.message : "Could not update your wishlist.");
    } finally {
      setBusy(false);
    }
  };

  const label = saved ? `Remove ${productTitle} from wishlist` : `Save ${productTitle} to wishlist`;
  const focusRing =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";
  const heartClass = saved ? "fill-ink text-ink" : "text-ink";

  if (variant === "full") {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={toggle}
          aria-pressed={saved}
          aria-label={label}
          aria-busy={busy}
          className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border px-5 text-sm font-medium text-ink transition-colors touch-manipulation ${focusRing} ${
            saved ? "border-ink bg-white" : "border-line bg-white hover:border-ink"
          }`}
        >
          <Heart size={18} className={heartClass} strokeWidth={1.6} aria-hidden="true" />
          <span>{saved ? "Saved to wishlist" : "Save to wishlist"}</span>
        </button>
        {error && (
          <p role="alert" className="mt-1.5 text-xs text-rose-700">
            {error}
          </p>
        )}
      </div>
    );
  }

  // "round": 52px outline circle beside the product page buttons.
  // "icon": 44px white circle over a product photo.
  const shape =
    variant === "round"
      ? `h-[52px] w-[52px] border bg-white ${error ? "border-rose-500" : "border-ink"} hover:bg-canvas`
      : `h-11 w-11 bg-white/92 hover:bg-white ${error ? "ring-1 ring-rose-500" : ""}`;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={label}
      aria-busy={busy}
      title={error ?? label}
      className={`inline-flex shrink-0 items-center justify-center rounded-full transition-colors touch-manipulation ${focusRing} ${shape} ${className}`}
    >
      <Heart size={variant === "round" ? 20 : 18} strokeWidth={1.6} aria-hidden="true" className={heartClass} />
      {error && <span className="sr-only" role="alert">{error}</span>}
    </button>
  );
}
