"use client";

import React, { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Package, Pause, Play } from "lucide-react";
import { formatAmount, formatCurrency } from "@/lib/formatters";

export interface HeroSlide {
  slug: string;
  title: string;
  categoryName: string | null;
  brandName: string | null;
  imageUrl: string;
  priceMinor: number;
  compareAtMinor: number | null;
}

const ROTATE_MS = 6000;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getReducedMotion() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [failedImages, setFailedImages] = useState<ReadonlySet<string>>(() => new Set());
  const markFailed = useCallback(
    (slug: string) => setFailedImages((prev) => (prev.has(slug) ? prev : new Set(prev).add(slug))),
    []
  );
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false);

  const count = slides.length;
  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  const autoplay = count > 1 && !paused && !userPaused && !reducedMotion;
  useEffect(() => {
    if (!autoplay) return;
    const t = setTimeout(() => go(index + 1), ROTATE_MS);
    return () => clearTimeout(t);
  }, [autoplay, index, go]);

  if (count === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured deals"
      className="relative h-full min-h-[250px] sm:min-h-[320px] rounded-lg overflow-hidden bg-brand-ink text-white"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {slides.map((s, i) => {
        const discount =
          s.compareAtMinor && s.compareAtMinor > s.priceMinor
            ? Math.round(((s.compareAtMinor - s.priceMinor) / s.compareAtMinor) * 100)
            : 0;
        const active = i === index;
        return (
          <div
            key={s.slug}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            aria-hidden={!active}
            className={`group absolute inset-0 grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_minmax(0,46%)] items-center gap-4 pl-5 sm:pl-14 pr-4 sm:pr-14 transition-opacity duration-500 ${
              active ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
            }`}
          >
            <div className="min-w-0 pt-5 pb-11 sm:pt-6 sm:pb-12">
              {discount > 0 && (
                <span className="inline-block bg-orange-500 text-white text-xs font-extrabold px-2 py-1 rounded tabular-nums">
                  Save {discount}%
                </span>
              )}
              <p className="mt-3 text-xs sm:text-sm font-semibold text-emerald-200/90 truncate">
                {[s.brandName, s.categoryName].filter(Boolean).join(" in ")}
              </p>
              <h2 className="mt-1 text-xl sm:text-3xl lg:text-[2.1rem] font-extrabold leading-[1.15] tracking-tight line-clamp-2 sm:line-clamp-3 text-balance">
                {/* Stretched link: the whole slide opens the product */}
                <Link
                  href={`/products/${s.slug}`}
                  tabIndex={active ? 0 : -1}
                  className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:underline"
                >
                  {s.title}
                </Link>
              </h2>
              <div className="mt-3 sm:mt-4 flex items-baseline gap-2 tabular-nums">
                <span className="flex items-baseline gap-0.5">
                  <span className="text-sm font-bold">Rs.</span>
                  <span className="text-2xl sm:text-4xl font-extrabold tracking-tight">{formatAmount(s.priceMinor)}</span>
                </span>
                {discount > 0 && (
                  <span className="text-xs sm:text-sm text-emerald-100/60 line-through">
                    {formatCurrency(s.compareAtMinor!)}
                  </span>
                )}
              </div>
              <span
                aria-hidden="true"
                className="mt-4 sm:mt-5 hidden sm:inline-flex items-center h-10 sm:h-11 px-5 rounded-md bg-white text-brand-ink text-sm font-bold group-hover:bg-emerald-50 transition-colors"
              >
                Shop now
              </span>
            </div>

            <div className="relative h-[140px] w-[120px] sm:h-[78%] sm:w-full self-center">
              {failedImages.has(s.slug) ? (
                <div className="absolute inset-0 rounded-lg bg-white/5 ring-1 ring-white/10 flex items-center justify-center text-white/30">
                  <Package size={48} strokeWidth={1.25} />
                </div>
              ) : (
                <img
                  // Catch images that failed before hydration attached onError
                  ref={(el) => {
                    if (el && el.complete && el.naturalWidth === 0) markFailed(s.slug);
                  }}
                  src={s.imageUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover rounded-lg ring-1 ring-white/10"
                  loading={i === 0 ? "eager" : "lazy"}
                  fetchPriority={i === 0 ? "high" : "auto"}
                  decoding="async"
                  onError={() => markFailed(s.slug)}
                />
              )}
            </div>
          </div>
        );
      })}

      {count > 1 && (
        <div className="absolute z-20 bottom-3 left-5 sm:left-14 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setUserPaused((p) => !p)}
            aria-label={userPaused ? "Resume slide rotation" : "Pause slide rotation"}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            {userPaused || reducedMotion ? <Play size={12} /> : <Pause size={12} />}
          </button>
          <div className="flex items-center gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.slug}
                type="button"
                onClick={() => go(i)}
                aria-label={`Show slide ${i + 1}`}
                aria-current={i === index}
                className="h-7 flex items-center"
              >
                <span
                  className={`block h-1.5 rounded-full transition-all ${
                    i === index ? "w-6 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous slide"
            className="hidden sm:flex absolute z-20 left-2 top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center rounded-full bg-black/25 hover:bg-black/40 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next slide"
            className="hidden sm:flex absolute z-20 right-2 top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center rounded-full bg-black/25 hover:bg-black/40 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </>
      )}
    </section>
  );
}
