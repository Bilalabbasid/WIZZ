"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Menu, X, ArrowRight } from "lucide-react";
import { AccountHeaderSignOut } from "./account-header-sign-out";
import { WizzLogo } from "./wizz-logo";

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
}

interface MobileNavProps {
  categories: CategoryItem[];
  user: {
    id: string;
    firstName: string;
    role: string;
  } | null;
  sellerWorkspaceLink: string | null;
  isPlatformAdmin: boolean;
  tone?: "light" | "dark";
}

const rowClass =
  "flex items-center justify-between gap-3 px-4 min-h-[48px] rounded-2xl text-[15px] text-ink hover:bg-white transition-colors";
const eyebrowClass = "px-4 pb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-mute";

/** Hamburger + slide-in drawer for small screens (below lg). */
export function MobileNav({
  categories,
  user,
  sellerWorkspaceLink,
  isPlatformAdmin,
  tone = "light",
}: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Close on Escape, lock page scroll, move focus into the drawer
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    const t = setTimeout(() => closeButtonRef.current?.focus(), 30);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleClose = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };
  const closeQuietly = () => setIsOpen(false);

  return (
    <div className="lg:hidden flex items-center">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Open menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
        className={`size-11 flex items-center justify-center rounded-full border transition-colors ${
          tone === "dark"
            ? "border-white/20 text-white hover:bg-white/10"
            : "border-line bg-white text-ink hover:border-ink"
        }`}
      >
        <Menu size={18} strokeWidth={1.7} aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[60] flex">
          <div className="fixed inset-0 bg-ink/50" onClick={handleClose} aria-hidden="true" />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="relative z-10 flex h-full w-full max-w-[340px] flex-col overflow-y-auto bg-canvas pb-[env(safe-area-inset-bottom)]"
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <WizzLogo size="md" />
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Close menu"
                onClick={handleClose}
                className="size-11 flex items-center justify-center rounded-full border border-line bg-white text-ink hover:border-ink"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 px-1 pb-6 space-y-6">
              <nav aria-label="Shop" className="pt-2">
                <p className={eyebrowClass}>Shop</p>
                <Link href="/products" onClick={closeQuietly} className={`${rowClass} font-medium`}>
                  <span>Shop all</span>
                  <ArrowRight size={16} className="text-mute" aria-hidden="true" />
                </Link>
                <Link href="/products?deals=true" onClick={closeQuietly} className={rowClass}>
                  <span>Deals</span>
                  <ArrowRight size={16} className="text-mute" aria-hidden="true" />
                </Link>
                <Link href="/search" onClick={closeQuietly} className={rowClass}>
                  <span>Search</span>
                  <ArrowRight size={16} className="text-mute" aria-hidden="true" />
                </Link>
              </nav>

              {categories.length > 0 && (
                <nav aria-label="Categories" className="border-t border-line pt-5">
                  <p className={eyebrowClass}>Categories</p>
                  {categories.map((c) => (
                    <Link key={c.id} href={`/categories/${c.slug}`} onClick={closeQuietly} className={rowClass}>
                      <span className="truncate">{c.name}</span>
                      <ArrowRight size={16} className="text-mute flex-shrink-0" aria-hidden="true" />
                    </Link>
                  ))}
                </nav>
              )}

              <nav aria-label="Your account" className="border-t border-line pt-5">
                <p className={eyebrowClass}>{user ? `Signed in as ${user.firstName}` : "Account"}</p>
                {user ? (
                  <>
                    <Link href="/account" onClick={closeQuietly} className={rowClass}>
                      Your account
                    </Link>
                    <Link href="/account" onClick={closeQuietly} className={rowClass}>
                      Orders and returns
                    </Link>
                    <Link href="/wishlist" onClick={closeQuietly} className={rowClass}>
                      Saved items
                    </Link>
                    <AccountHeaderSignOut
                      onDone={closeQuietly}
                      className="w-full px-4 min-h-[48px] rounded-2xl text-[15px] text-mute hover:text-ink hover:bg-white transition-colors"
                    />
                  </>
                ) : (
                  <div className="flex flex-wrap gap-2 px-4">
                    <Link
                      href="/login"
                      onClick={closeQuietly}
                      className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-full bg-ink text-white text-sm font-medium hover:bg-ink-2"
                    >
                      Sign in
                    </Link>
                    <Link
                      href="/register"
                      onClick={closeQuietly}
                      className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-full border border-ink text-ink text-sm font-medium hover:bg-white"
                    >
                      Create account
                    </Link>
                  </div>
                )}
              </nav>

              <nav aria-label="Sell" className="border-t border-line pt-5">
                <p className={eyebrowClass}>Sell</p>
                {sellerWorkspaceLink ? (
                  <Link href={sellerWorkspaceLink} onClick={closeQuietly} className={rowClass}>
                    Seller Center
                  </Link>
                ) : (
                  <Link href="/sell" onClick={closeQuietly} className={rowClass}>
                    Sell on WIZZ.PK
                  </Link>
                )}
                {isPlatformAdmin && (
                  <Link href="/admin" onClick={closeQuietly} className={rowClass}>
                    Admin
                  </Link>
                )}
                <Link href="/contact" onClick={closeQuietly} className={rowClass}>
                  Help and contact
                </Link>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
