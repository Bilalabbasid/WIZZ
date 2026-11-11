"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";

export interface MegaMenuCategory {
  id: string;
  name: string;
  slug: string;
  _count?: { products: number };
}

export interface MegaMenuProps {
  categories: MegaMenuCategory[];
}

/**
 * Header "Categories" control: a nav-styled button that opens a panel of real catalog
 * categories (from the database) below the header. Closes on Escape, outside click or
 * choosing a link.
 */
export function MegaMenu({ categories }: MegaMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointer = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [isOpen]);

  // Only categories with public products, unless none have any yet (fresh catalogue)
  const withProducts = categories.filter((c) => (c._count?.products ?? 0) > 0);
  const shown = withProducts.length > 0 ? withProducts : categories;
  const close = () => setIsOpen(false);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className={`inline-flex items-center gap-1 min-h-[44px] px-1 text-sm font-medium transition-colors ${
          isOpen ? "text-ink" : "text-mute hover:text-ink"
        }`}
      >
        Categories
        <ChevronDown
          size={15}
          aria-hidden="true"
          className={`transition-transform motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          id={panelId}
          className="absolute left-0 top-full mt-2 w-[min(640px,calc(100vw-80px))] rounded-[24px] border border-line-soft bg-white p-3 shadow-[0_24px_48px_-24px_rgba(14,14,13,0.35)] z-50"
        >
          <p className="px-3 pt-2 pb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-mute">
            Shop by category
          </p>
          {shown.length === 0 ? (
            <p className="px-3 pb-3 text-sm text-mute">Categories will appear here once products are listed.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-x-2">
              {shown.map((c) => (
                <li key={c.id} className="min-w-0">
                  <Link
                    href={`/categories/${c.slug}`}
                    onClick={close}
                    className="flex items-center justify-between gap-3 px-3 min-h-[44px] rounded-xl text-sm text-ink hover:bg-canvas transition-colors"
                  >
                    <span className="truncate">{c.name}</span>
                    {(c._count?.products ?? 0) > 0 && (
                      <span className="font-mono text-xs text-mute-2 tabular-nums flex-shrink-0">
                        {c._count!.products}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 border-t border-line-soft pt-2 flex flex-wrap gap-2 px-1">
            <Link
              href="/products"
              onClick={close}
              className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-full border border-ink text-sm font-medium text-ink hover:bg-canvas"
            >
              All products
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
            <Link
              href="/products?deals=true"
              onClick={close}
              className="inline-flex items-center min-h-[44px] px-4 rounded-full text-sm font-medium text-mute hover:text-ink"
            >
              Deals
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
