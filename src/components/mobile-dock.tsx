"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Home, Search, ShoppingBag, User as UserIcon } from "lucide-react";

export interface MobileDockProps {
  cartCount: number;
  signedIn: boolean;
}

/** Routes where the dock would cover a primary action (checkout has its own sticky submit). */
const HIDDEN_PREFIXES = ["/checkout"];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Floating ink dock for phones (< md): Home, Saved, Cart (volt, with count), Search, Account.
 * Renders its own spacer so page content and the footer are never hidden behind it.
 */
export function MobileDock({ cartCount, signedIn }: MobileDockProps) {
  const pathname = usePathname() ?? "/";
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  const accountHref = signedIn ? "/account" : "/login";
  const countLabel = cartCount > 99 ? "99+" : String(cartCount);

  const iconLink = (href: string, label: string, Icon: typeof Home, activeHref = href) => {
    const active = isActive(pathname, activeHref);
    return (
      <Link
        href={href}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className={`size-12 rounded-full flex items-center justify-center transition-colors focus-visible:outline-volt ${
          active ? "bg-brand-ink-soft text-white" : "text-[#B4B4AD] hover:text-white"
        }`}
      >
        <Icon size={20} strokeWidth={1.7} aria-hidden="true" />
      </Link>
    );
  };

  const cartActive = isActive(pathname, "/cart");

  return (
    <>
      {/* Spacer: dock height + its bottom offset + breathing room + safe area */}
      <div aria-hidden="true" className="md:hidden h-[calc(7.5rem+env(safe-area-inset-bottom))]" />
      <nav
        aria-label="Quick links"
        className="md:hidden fixed inset-x-5 bottom-[calc(1.75rem+env(safe-area-inset-bottom))] z-40 h-16 rounded-full bg-ink px-2 flex items-center justify-between shadow-[0_16px_40px_-12px_rgba(14,14,13,0.45)]"
      >
        {iconLink("/", "Home", Home)}
        {iconLink("/wishlist", "Saved items", Heart)}
        <Link
          href="/cart"
          aria-current={cartActive ? "page" : undefined}
          aria-label={`Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}
          className={`h-12 px-4 rounded-full bg-volt text-ink text-sm font-semibold flex items-center gap-2 focus-visible:outline-white ${
            cartActive ? "ring-2 ring-white/80" : ""
          }`}
        >
          <ShoppingBag size={17} strokeWidth={1.9} aria-hidden="true" />
          <span aria-hidden="true">Cart</span>
          {cartCount > 0 && (
            <span
              aria-hidden="true"
              className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-ink text-volt font-mono text-[11px] leading-none flex items-center justify-center tabular-nums"
            >
              {countLabel}
            </span>
          )}
        </Link>
        {iconLink("/search", "Search", Search)}
        {iconLink(accountHref, signedIn ? "Your account" : "Sign in", UserIcon, "/account")}
      </nav>
    </>
  );
}
