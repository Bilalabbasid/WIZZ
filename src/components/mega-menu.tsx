"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Menu,
  X,
  ChevronRight,
  Layers,
  Sparkles,
  Zap,
  ShieldCheck,
  Store,
  Package,
  HelpCircle,
  Phone,
} from "lucide-react";
import { WizzMark } from "./wizz-logo";

export interface MegaMenuCategory {
  id: string;
  name: string;
  slug: string;
  _count?: { products: number };
}

export interface MegaMenuProps {
  categories: MegaMenuCategory[];
}

export function MegaMenu({ categories }: MegaMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => triggerRef.current?.focus(), 50);
  };

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 py-2 px-3 rounded-lg text-slate-800 hover:text-emerald-700 hover:bg-slate-100 font-bold text-xs sm:text-sm transition-colors border border-slate-200/80 bg-slate-50 min-h-[44px]"
        aria-label="Open All Departments Menu"
        aria-expanded={isOpen}
      >
        <Menu size={16} className="text-emerald-600" />
        <span className="whitespace-nowrap">All Categories</span>
      </button>

      {/* Slide-over Drawer & Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Drawer content */}
          <div
            ref={drawerRef}
            className="relative w-full max-w-sm bg-white shadow-2xl z-10 flex flex-col h-full animate-in slide-in-from-left duration-200"
            role="dialog"
            aria-modal="true"
            aria-label="Browse All Departments"
          >
            {/* Header */}
            <div className="p-4 bg-slate-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <WizzMark size={28} />
                <span className="font-extrabold text-sm tracking-tight">
                  Shop by Department
                </span>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="w-11 h-11 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500"
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {/* Highlight / Special Features */}
              <div className="p-3 bg-slate-50 space-y-1">
                <Link
                  href="/products?sort=featured"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-emerald-800 hover:bg-emerald-100/70 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles size={15} className="text-emerald-600" />
                    Featured Hardware & Tech
                  </span>
                  <ChevronRight size={13} />
                </Link>

                <Link
                  href="/products?sort=price_asc"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-amber-900 hover:bg-amber-50 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Zap size={15} className="text-amber-600" />
                    Special Deals & Discounts
                  </span>
                  <ChevronRight size={13} />
                </Link>

                <Link
                  href="/products"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-indigo-900 hover:bg-indigo-50 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <ShieldCheck size={15} className="text-indigo-600" />
                    WIZZ.PK Direct Flagship
                  </span>
                  <ChevronRight size={13} />
                </Link>
              </div>

              {/* Categories Section */}
              <div className="p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 block mb-2">
                  All Departments ({categories.length})
                </span>
                <div className="space-y-0.5">
                  {categories.map((c) => (
                    <Link
                      key={c.id}
                      href={`/categories/${c.slug}`}
                      onClick={() => setIsOpen(false)}
                      className="flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-emerald-700 transition-colors group"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <Layers size={14} className="text-slate-400 group-hover:text-emerald-600 flex-shrink-0" />
                        <span className="truncate">{c.name}</span>
                      </span>
                      {c._count && c._count.products > 0 && (
                        <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                          {c._count.products}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Merchant & Customer Services */}
              <div className="p-3 bg-slate-50/50 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 block mb-1">
                  Customer & Merchant
                </span>
                <Link
                  href="/sell"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2 p-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <Store size={14} className="text-emerald-600" />
                  <span>Sell on WIZZ.PK Marketplace</span>
                </Link>
                <Link
                  href="/contact"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2 p-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <HelpCircle size={14} className="text-slate-500" />
                  <span>Help & Customer Care Desk</span>
                </Link>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="p-3 bg-slate-100 text-[11px] text-slate-500 border-t border-slate-200 text-center">
              WIZZ.PK • Nationwide Verified Marketplace
            </div>
          </div>
        </div>
      )}
    </>
  );
}
