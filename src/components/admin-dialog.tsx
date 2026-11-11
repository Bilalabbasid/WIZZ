"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * Accessible modal built on the native <dialog> element: showModal() gives focus
 * containment, Escape-to-close and an inert background without extra libraries.
 */
export function AdminDialog({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby="admin-dialog-title"
      className={`m-auto w-[calc(100%-2rem)] ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-0 text-slate-100 shadow-2xl backdrop:bg-black/70`}
    >
      {open && (
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="admin-dialog-title" className="text-base font-bold text-white">
                {title}
              </h2>
              {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 -m-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              aria-label="Close dialog"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function AdminAlert({ tone, children, onDismiss }: { tone: "success" | "error" | "info"; children: React.ReactNode; onDismiss?: () => void }) {
  const cls =
    tone === "success"
      ? "bg-emerald-950/80 border-emerald-500/40 text-emerald-200"
      : tone === "error"
        ? "bg-rose-950/80 border-rose-500/40 text-rose-200"
        : "bg-sky-950/70 border-sky-500/40 text-sky-200";
  return (
    <div role={tone === "error" ? "alert" : "status"} aria-live="polite" className={`p-3 rounded-xl text-sm flex items-start justify-between gap-3 border ${cls}`}>
      <div className="min-w-0">{children}</div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="text-[11px] uppercase tracking-wider font-bold opacity-75 hover:opacity-100 shrink-0">
          Dismiss
        </button>
      )}
    </div>
  );
}

/** JSON fetch for admin APIs. Never throws; returns the API's own error message on failure. */
export async function adminRequest<T = Record<string, unknown>>(
  url: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) {
      const msg =
        data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
          ? (data as { error: string }).error
          : res.status === 403
            ? "Your role is not allowed to perform this action."
            : res.status === 401
              ? "Your session has expired. Please sign in again."
              : `Request failed (HTTP ${res.status}).`;
      return { ok: false, error: msg, status: res.status };
    }
    return { ok: true, data: (data ?? {}) as T };
  } catch {
    return { ok: false, error: "Network error. Check your connection and try again.", status: 0 };
  }
}

/** Convert a PKR rupee input string to integer minor units (paisa). Returns null if invalid. */
export function rupeesToMinor(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  return Number(whole) * 100 + Number((frac + "00").slice(0, 2));
}

export function minorToRupeesInput(minor: number | null | undefined): string {
  if (minor === null || minor === undefined) return "";
  const whole = Math.trunc(minor / 100);
  const frac = Math.abs(minor % 100);
  return frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(2, "0")}`;
}
