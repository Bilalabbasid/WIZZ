import type { NextConfig } from "next";

// Set by scripts/build-production.js for hosts that limit process count (shared hosting)
const lowResourceBuild = process.env.WIZZ_LOW_RESOURCE_BUILD === "1";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy. Notes:
 * - script-src needs 'unsafe-inline' because Next.js injects inline bootstrap scripts and
 *   this app doesn't use per-request nonces (nonces would force every page to be dynamic).
 *   'unsafe-eval' is only added in development (React Refresh / dev overlay).
 * - img-src allows any https: image because sellers may link product images from any
 *   https host (see imageUrl in src/modules/sellers/catalog-services.ts) and several
 *   views render them with <img>; next/image itself is served from 'self'. data:/blob:
 *   cover inline QR codes and local upload previews.
 * - connect-src 'self' covers every fetch (uploads go through /api/uploads); dev adds
 *   ws: for hot reload.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "media-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  ...(lowResourceBuild
    ? {
        experimental: {
          cpus: 1, // one static-generation worker instead of one per CPU core
          webpackBuildWorker: false, // compile in the main process
          parallelServerCompiles: false,
          parallelServerBuildTraces: false,
        },
      }
    : {}),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      // One canonical host for search engines and cookies: www.wizz.pk -> wizz.pk
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.wizz.pk" }],
        destination: "https://wizz.pk/:path*",
        permanent: true,
      },
      {
        source: "/product/:slug",
        destination: "/products/:slug",
        permanent: true,
      },
      {
        source: "/category/:slug",
        destination: "/categories/:slug",
        permanent: true,
      },
      {
        source: "/categories",
        destination: "/products",
        permanent: true,
      },
      {
        source: "/shop",
        destination: "/products",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
