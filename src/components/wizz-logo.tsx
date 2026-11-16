import React from "react";
import Link from "next/link";

export interface WizzLogoProps {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  variant?: "full" | "mark";
  /** "light" = white wordmark for dark surfaces; "dark" / "auto" = ink wordmark for the canvas. */
  theme?: "dark" | "light" | "auto";
  href?: string;
}

/**
 * Brand mark: volt rounded square with a heavy ink "W".
 * Decorative (aria-hidden); pair it with visible or screen-reader text.
 */
export function WizzMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <rect width="48" height="48" rx="12" fill="#D4FF3A" />
      <path
        d="M9.5 14.5 16 34h1.2L24 20.5 30.8 34H32l6.5-19.5"
        stroke="#0E0E0D"
        strokeWidth="5.2"
        strokeLinecap="square"
        strokeLinejoin="miter"
        strokeMiterlimit="3"
      />
    </svg>
  );
}

const WORDMARK_SIZES: Record<NonNullable<WizzLogoProps["size"]>, string> = {
  xs: "text-base",
  sm: "text-lg",
  md: "text-[22px]",
  lg: "text-[28px]",
  xl: "text-4xl",
};

const MARK_SIZES: Record<NonNullable<WizzLogoProps["size"]>, number> = {
  xs: 22,
  sm: 26,
  md: 30,
  lg: 38,
  xl: 48,
};

/** Small volt dot (kept for places that use it as an accent, e.g. the footer wordmark). */
export function WizzDot({
  onDark = false,
  sizeClass = "size-[0.36em] mx-[0.07em]",
  ringClass,
}: {
  onDark?: boolean;
  /** Size and side spacing, in em so the dot scales with the wordmark. */
  sizeClass?: string;
  ringClass?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block rounded-full bg-volt align-baseline ${sizeClass} ${
        ringClass ?? (onDark ? "ring-1 ring-white/70" : "ring-1 ring-ink")
      }`}
    />
  );
}

/** Logo: volt "W" square + "wizz" wordmark, tight tracking. */
export function WizzLogo({
  className = "",
  size = "md",
  variant = "full",
  theme = "auto",
  href = "/",
}: WizzLogoProps) {
  const onDark = theme === "light";

  const content = (
    <span className={`inline-flex items-center gap-2 select-none whitespace-nowrap ${className}`}>
      <WizzMark size={MARK_SIZES[size]} />
      {variant === "full" && (
        <span
          aria-hidden="true"
          className={`font-bold leading-none tracking-[-0.045em] ${WORDMARK_SIZES[size]} ${onDark ? "text-white" : "text-ink"}`}
        >
          wizz
        </span>
      )}
      <span className="sr-only">WIZZ.PK</span>
    </span>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label="WIZZ.PK home"
        className={`inline-flex items-center min-h-[44px] rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 ${
          onDark ? "focus-visible:outline-white" : "focus-visible:outline-ink"
        }`}
      >
        {content}
      </Link>
    );
  }

  return content;
}
