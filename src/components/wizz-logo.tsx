"use client";

import React from "react";
import Link from "next/link";

export interface WizzLogoProps {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  variant?: "full" | "mark";
  theme?: "dark" | "light" | "auto";
  href?: string;
}

export function WizzMark({
  size = 36,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 transition-transform duration-300 group-hover:scale-105 ${className}`}
      aria-hidden="true"
    >
      <defs>
        {/* Emerald Core Linear Gradient */}
        <linearGradient id="wizz-gem-grad" x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="45%" stopColor="#059669" />
          <stop offset="100%" stopColor="#064E3B" />
        </linearGradient>

        {/* Titanium Core Accent */}
        <linearGradient id="wizz-slate-grad" x1="12" y1="8" x2="36" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="60%" stopColor="#0F172A" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>

        {/* Sharp Kinetic Highlights */}
        <linearGradient id="wizz-edge-bright" x1="18" y1="4" x2="30" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6EE7B7" />
          <stop offset="50%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>

        {/* Glow Filter */}
        <filter id="wizz-subtle-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#059669" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* Hexagonal Tech Frame / Boundary */}
      <polygon
        points="24,2 42,12 42,36 24,46 6,36 6,12"
        fill="url(#wizz-slate-grad)"
        stroke="#1E293B"
        strokeWidth="1.2"
        className="drop-shadow-xs"
      />

      {/* Subtle Micro Circuit Accent Paths */}
      <path
        d="M10 16L18 20M38 32L30 28M12 33L18 30M36 15L30 18"
        stroke="#10B981"
        strokeWidth="1"
        strokeOpacity="0.4"
        strokeLinecap="round"
      />
      <circle cx="10" cy="16" r="1.2" fill="#34D399" fillOpacity="0.8" />
      <circle cx="38" cy="32" r="1.2" fill="#34D399" fillOpacity="0.8" />

      {/* Kinetic Sonic Prism - Facet 1: Upper Left Shard */}
      <polygon
        points="24,4 32,15 24,19 16,13"
        fill="url(#wizz-gem-grad)"
        filter="url(#wizz-subtle-glow)"
      />

      {/* Kinetic Sonic Prism - Facet 2: Upper Right Blade */}
      <polygon
        points="24,4 40,14 31,19 24,15"
        fill="url(#wizz-edge-bright)"
        fillOpacity="0.95"
      />

      {/* Kinetic Sonic Prism - Facet 3: Dynamic Center Bolt / Speed Core */}
      <polygon
        points="31,16 19,25 25,26 17,37 33,23 26,22"
        fill="#FFFFFF"
        opacity="0.96"
        className="drop-shadow-sm"
      />

      {/* Kinetic Sonic Prism - Facet 4: Lower Left Shield */}
      <polygon
        points="8,15 22,25 15,36 7,33"
        fill="url(#wizz-edge-bright)"
        fillOpacity="0.85"
      />

      {/* Kinetic Sonic Prism - Facet 5: Lower Right Anchor */}
      <polygon
        points="25,27 41,33 33,43 24,44 26,35"
        fill="url(#wizz-gem-grad)"
      />

      {/* Center Precision Vertex Spark */}
      <polygon
        points="24,19 28,24 24,29 20,24"
        fill="#A7F3D0"
        opacity="0.9"
      />
    </svg>
  );
}

export function WizzLogo({
  className = "",
  size = "md",
  variant = "full",
  theme = "auto",
  href = "/",
}: WizzLogoProps) {
  const pixelSizes = {
    xs: 24,
    sm: 30,
    md: 38,
    lg: 46,
    xl: 56,
  };

  const textSizes = {
    xs: "text-base tracking-tight",
    sm: "text-lg tracking-tight",
    md: "text-xl sm:text-2xl tracking-tighter",
    lg: "text-2xl sm:text-3xl tracking-tighter",
    xl: "text-3xl sm:text-4xl tracking-tighter",
  };

  const px = pixelSizes[size];

  const content = (
    <span className={`group inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Dynamic Emblem */}
      <span className="relative flex items-center justify-center">
        <WizzMark size={px} />
      </span>

      {/* Typographic Wordmark */}
      {variant === "full" && (
        <span className="flex items-baseline font-black leading-none">
          <span
            className={`font-black ${textSizes[size]} ${
              theme === "light"
                ? "text-white"
                : theme === "dark"
                ? "text-slate-900"
                : "text-slate-900 group-hover:text-slate-950 transition-colors"
            }`}
          >
            WIZZ
          </span>
          <span className="font-extrabold text-emerald-600 ml-0.5 text-xs sm:text-sm uppercase tracking-wider">
            .PK
          </span>
        </span>
      )}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-lg p-0.5">
        {content}
      </Link>
    );
  }

  return content;
}
