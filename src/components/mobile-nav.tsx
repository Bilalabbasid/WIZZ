"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Menu, X, Search, ChevronRight, Store, ShieldCheck, User as UserIcon, Truck, ShoppingBag, Package } from "lucide-react";
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

  // Close on Escape & trap focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
      setTimeout(() => closeButtonRef.current?.focus(), 50);
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleClose = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className="lg:hidden flex items-center">
      {/* Mobile Hamburger Trigger */}
      <button
        ref={triggerRef}
        type="button"
        aria-label="Open Navigation Menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
        className={`w-11 h-11 flex items-center justify-center rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400 ${tone === "dark" ? "text-white hover:bg-white/10" : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"}`}
      >
        <Menu size={22} />
      </button>

      {/* Backdrop & Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Navigation Menu"
            className="relative w-full max-w-xs bg-white h-full shadow-2xl flex flex-col z-10 overflow-y-auto"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div onClick={handleClose}>
                <WizzLogo size="sm" />
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Close Navigation Menu"
                onClick={handleClose}
                className="w-11 h-11 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <X size={20} />
              </button>
            </div>

            {/* Mobile Search Form */}
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <form action="/search" method="GET" onSubmit={handleClose}>
                <div className="relative">
                  <input
                    type="text"
                    name="q"
                    placeholder="Search products or brands..."
                    className="w-full bg-white text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-900"
                  />
                  <Search className="absolute left-3 top-3 text-slate-400" size={15} />
                </div>
              </form>
            </div>

            {/* Navigation Links */}
            <div className="flex-1 p-4 space-y-6">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2 px-2">
                  Browse Catalog
                </span>
                <nav className="space-y-1">
                  <Link
                    href="/products"
                    onClick={handleClose}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors"
                  >
                    <span>All Products</span>
                    <ChevronRight size={14} className="text-slate-400" />
                  </Link>
                  {categories.map((c) => (
                    <Link
                      key={c.id}
                      href={`/categories/${c.slug}`}
                      onClick={handleClose}
                      className="flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      <span>{c.name}</span>
                      <ChevronRight size={14} className="text-slate-400" />
                    </Link>
                  ))}
                </nav>
              </div>

              {/* Quick Services */}
              <div className="pt-4 border-t border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2 px-2">
                  Customer & Order Services
                </span>
                <nav className="space-y-1 text-xs">
                  <Link
                    href="/orders/track"
                    onClick={handleClose}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <Package size={15} className="text-emerald-600" />
                    <span>Track Physical Parcel</span>
                  </Link>

                  {user ? (
                    <Link
                      href="/account"
                      onClick={handleClose}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-semibold text-slate-800 hover:bg-slate-100 transition-colors"
                    >
                      <UserIcon size={15} className="text-slate-600" />
                      <span>My Account ({user.firstName})</span>
                    </Link>
                  ) : (
                    <Link
                      href="/login"
                      onClick={handleClose}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-semibold text-slate-800 hover:bg-slate-100 transition-colors"
                    >
                      <UserIcon size={15} className="text-slate-600" />
                      <span>Sign In / Create Account</span>
                    </Link>
                  )}
                </nav>
              </div>

              {/* Merchant / Admin Section */}
              <div className="pt-4 border-t border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2 px-2">
                  Merchant Workspace
                </span>
                <nav className="space-y-1 text-xs">
                  {sellerWorkspaceLink ? (
                    <Link
                      href={sellerWorkspaceLink}
                      onClick={handleClose}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-semibold text-indigo-700 bg-indigo-50/60 hover:bg-indigo-100 transition-colors"
                    >
                      <Store size={15} className="text-indigo-600" />
                      <span>Seller Portal</span>
                    </Link>
                  ) : (
                    <Link
                      href="/sell"
                      onClick={handleClose}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      <Store size={15} className="text-emerald-600" />
                      <span>Sell on WIZZ.PK</span>
                    </Link>
                  )}

                  {isPlatformAdmin && (
                    <Link
                      href="/admin"
                      onClick={handleClose}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors mt-2"
                    >
                      <ShieldCheck size={15} className="text-emerald-400" />
                      <span>Admin Operations</span>
                    </Link>
                  )}
                </nav>
              </div>
            </div>

            {/* Bottom Pakistan Delivery Promise */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-2">
              <Truck size={14} className="text-emerald-600 flex-shrink-0" />
              <span>Nationwide TCS / Leopards COD Delivery</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
