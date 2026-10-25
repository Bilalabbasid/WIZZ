"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Horizontal, snap-scrolling row of items with previous/next controls.
 * Children should be direct items; each is given a fixed width.
 */
export function ScrollRail({
  children,
  label,
  itemClassName = "w-[44%] sm:w-[200px]",
}: {
  children: React.ReactNode;
  label: string;
  itemClassName?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const update = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    update();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [update]);

  const scroll = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  const items = React.Children.toArray(children);

  return (
    <div className="relative group/rail">
      <div
        ref={trackRef}
        role="region"
        aria-label={label}
        tabIndex={0}
        className="flex gap-2.5 sm:gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-px-1 pb-1 focus-visible:outline-offset-4"
      >
        {items.map((child, i) => (
          <div key={i} className={`flex-shrink-0 snap-start ${itemClassName}`}>
            {child}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => scroll(-1)}
        aria-label={`Scroll ${label} back`}
        className={`hidden sm:flex absolute left-0 top-[38%] -translate-x-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center rounded-full bg-white border border-slate-200 shadow-md text-slate-700 hover:text-slate-950 hover:border-slate-300 transition-opacity ${
          canPrev ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        tabIndex={canPrev ? 0 : -1}
      >
        <ChevronLeft size={20} />
      </button>
      <button
        type="button"
        onClick={() => scroll(1)}
        aria-label={`Scroll ${label} forward`}
        className={`hidden sm:flex absolute right-0 top-[38%] translate-x-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center rounded-full bg-white border border-slate-200 shadow-md text-slate-700 hover:text-slate-950 hover:border-slate-300 transition-opacity ${
          canNext ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        tabIndex={canNext ? 0 : -1}
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
