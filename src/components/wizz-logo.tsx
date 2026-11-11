import React from "react";
import Link from "next/link";

export interface WizzLogoProps {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  variant?: "full" | "mark";
  /** "light" = light text for dark surfaces; "dark" / "auto" = ink text for the canvas. */
  theme?: "dark" | "light" | "auto";
  href?: string;
}

/**
 * Compact square mark: ink rounded square with a lowercase "w" and the volt dot.
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
      <rect width="48" height="48" rx="13" fill="#0E0E0D" />
      <path
        d="M10.5 17.5 15.6 32h1.1L22 20.4 27.3 32h1.1l5.1-14.5"
        stroke="#FFFFFF"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="38" cy="31" r="3.6" fill="#D4FF3A" stroke="#0E0E0D" strokeWidth="1" />
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
  xs: 24,
  sm: 30,
  md: 36,
  lg: 44,
  xl: 56,
};

/** The volt dot between "wizz" and "pk". Sits on the baseline like a domain dot. */
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

/** Wordmark: "wizz" + volt dot + "pk", same weight, tight tracking. */
export function WizzLogo({
  className = "",
  size = "md",
  variant = "full",
  theme = "auto",
  href = "/",
}: WizzLogoProps) {
  const onDark = theme === "light";

  const content =
    variant === "mark" ? (
      <span className={`inline-flex ${className}`}>
        <WizzMark size={MARK_SIZES[size]} />
        <span className="sr-only">WIZZ.PK</span>
      </span>
    ) : (
      <span
        className={`inline-block select-none whitespace-nowrap font-bold leading-none tracking-[-0.04em] ${
          WORDMARK_SIZES[size]
        } ${onDark ? "text-white" : "text-ink"} ${className}`}
      >
        <span aria-hidden="true">
          wizz
          <WizzDot onDark={onDark} />
          pk
        </span>
        <span className="sr-only">WIZZ.PK</span>
      </span>
    );

  if (href) {
    return (
      <Link
        href={href}
        aria-label="WIZZ.PK home"
        className="inline-flex items-center min-h-[44px] rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {content}
      </Link>
    );
  }

  return content;
}
