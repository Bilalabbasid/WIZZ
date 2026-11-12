import type { NextConfig } from "next";

// Set by scripts/build-production.js for hosts that limit process count (shared hosting)
const lowResourceBuild = process.env.WIZZ_LOW_RESOURCE_BUILD === "1";

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
