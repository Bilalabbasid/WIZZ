"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, LogOut, Package, ShieldCheck, Store, User as UserIcon } from "lucide-react";

/**
 * Compact sign-out control for the header and mobile drawer. Uses POST (the
 * logout route has no GET handler, so links/images can't sign users out), then
 * navigates home and refreshes so every server-rendered part of the page drops the session.
 */
export function AccountHeaderSignOut({
  className = "",
  label = "Sign out",
  onDone,
}: {
  className?: string;
  label?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const signOut = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", redirect: "manual" });
      if (!res.ok && res.type !== "opaqueredirect" && res.status !== 0) throw new Error("failed");
      onDone?.();
      // refresh() re-renders server components (header, cart) without the session
      router.replace("/");
      router.refresh();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      aria-busy={busy}
      className={`inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-wait ${className}`}
    >
      <LogOut size={15} aria-hidden="true" />
      <span>{busy ? "Signing out…" : failed ? "Sign out failed — retry" : label}</span>
    </button>
  );
}

const menuLinkClass =
  "flex items-center gap-2.5 px-3 min-h-[44px] rounded-xl text-sm text-ink hover:bg-canvas transition-colors";

/**
 * Header account control for signed-in shoppers: a round 44px button that opens a small
 * panel with account, saved items, seller / admin workspaces and sign out.
 * Disclosure pattern (button + panel of links), closes on Escape and outside click.
 */
export function AccountMenu({
  firstName,
  sellerWorkspaceLink,
  isPlatformAdmin,
}: {
  firstName: string;
  sellerWorkspaceLink: string | null;
  isPlatformAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Account menu for ${firstName}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={`size-11 rounded-full border flex items-center justify-center transition-colors ${
          open ? "bg-ink border-ink text-white" : "bg-white border-line text-ink hover:border-ink"
        }`}
      >
        <UserIcon size={18} strokeWidth={1.6} aria-hidden="true" />
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute right-0 top-full mt-2 w-64 rounded-[20px] border border-line-soft bg-white p-2 shadow-[0_24px_48px_-24px_rgba(14,14,13,0.35)] z-50"
        >
          <p className="px-3 pt-2 pb-2 text-[13px] text-mute">
            Signed in as <span className="font-semibold text-ink">{firstName}</span>
          </p>
          <nav aria-label="Account" className="flex flex-col">
            <Link href="/account" onClick={close} className={menuLinkClass}>
              <UserIcon size={16} strokeWidth={1.6} aria-hidden="true" />
              Your account
            </Link>
            <Link href="/account" onClick={close} className={menuLinkClass}>
              <Package size={16} strokeWidth={1.6} aria-hidden="true" />
              Orders and returns
            </Link>
            <Link href="/wishlist" onClick={close} className={menuLinkClass}>
              <Heart size={16} strokeWidth={1.6} aria-hidden="true" />
              Saved items
            </Link>
            {sellerWorkspaceLink && (
              <Link href={sellerWorkspaceLink} onClick={close} className={menuLinkClass}>
                <Store size={16} strokeWidth={1.6} aria-hidden="true" />
                Seller Center
              </Link>
            )}
            {isPlatformAdmin && (
              <Link href="/admin" onClick={close} className={menuLinkClass}>
                <ShieldCheck size={16} strokeWidth={1.6} aria-hidden="true" />
                Admin
              </Link>
            )}
          </nav>
          <div className="mt-1 border-t border-line-soft pt-1">
            <AccountHeaderSignOut
              onDone={close}
              className="w-full px-3 min-h-[44px] rounded-xl text-sm text-mute hover:text-ink hover:bg-canvas transition-colors"
            />
          </div>
        </div>
      )}
    </div>
  );
}
