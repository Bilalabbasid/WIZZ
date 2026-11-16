import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * CSRF defence in depth for the JSON API (the session cookie is SameSite=Lax, which
 * already blocks most cross-site POSTs). State-changing requests to /api/* must come
 * from this site: the Origin header (or Referer when a browser omits Origin) has to
 * match the request host, X-Forwarded-Host (set by our reverse proxy) or APP_URL.
 *
 * Exempt: /api/webhooks/* (provider signatures) and /api/cron/* (CRON_SECRET bearer).
 * The matcher only covers /api, so pages, Next internals and Server Actions are untouched.
 */

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const EXEMPT_PREFIXES = ["/api/webhooks/", "/api/cron/"];

export interface CsrfCheckInput {
  method: string;
  pathname: string;
  origin: string | null;
  referer: string | null;
  host: string | null;
  forwardedHost?: string | null;
  /** Extra trusted origins/URLs, e.g. APP_URL and NEXT_PUBLIC_APP_URL. */
  trustedUrls?: Array<string | null | undefined>;
}

export type CsrfCheckResult = { ok: true } | { ok: false; reason: string };

function hostOf(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

function isExempt(pathname: string): boolean {
  return EXEMPT_PREFIXES.some((p) => pathname === p.slice(0, -1) || pathname.startsWith(p));
}

/** Pure check (unit-tested in tests/auth-security.test.ts). */
export function checkCsrf(input: CsrfCheckInput): CsrfCheckResult {
  const method = input.method.toUpperCase();
  if (!UNSAFE_METHODS.has(method)) return { ok: true };
  if (!input.pathname.startsWith("/api/") || isExempt(input.pathname)) return { ok: true };

  const allowed = new Set<string>();
  if (input.host) allowed.add(input.host.toLowerCase());
  for (const h of (input.forwardedHost || "").split(",")) {
    const v = h.trim().toLowerCase();
    if (v) allowed.add(v);
  }
  for (const url of input.trustedUrls ?? []) {
    const h = hostOf(url);
    if (h) allowed.add(h);
  }

  // "null" is sent by sandboxed frames and some privacy redirects: treat as missing.
  const origin = input.origin && input.origin !== "null" ? input.origin : null;
  const source = origin ?? input.referer;
  if (!source) return { ok: false, reason: "missing Origin and Referer" };
  const sourceHost = hostOf(source);
  if (!sourceHost) return { ok: false, reason: "malformed Origin/Referer" };
  if (!allowed.has(sourceHost)) return { ok: false, reason: `cross-site request from ${sourceHost}` };
  return { ok: true };
}

export function proxy(request: NextRequest) {
  const result = checkCsrf({
    method: request.method,
    pathname: request.nextUrl.pathname,
    origin: request.headers.get("origin"),
    referer: request.headers.get("referer"),
    host: request.headers.get("host"),
    forwardedHost: request.headers.get("x-forwarded-host"),
    trustedUrls: [process.env.APP_URL, process.env.NEXT_PUBLIC_APP_URL],
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: "This request was blocked because it didn't come from WIZZ.PK. Reload the page and try again.", code: "CSRF_REJECTED" },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
