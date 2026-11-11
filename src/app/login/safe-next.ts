/**
 * Post-sign-in destination from a `?next=` value. Only same-site absolute paths
 * are allowed ("/account", "/orders/x?t=y"); anything else ("//evil.com",
 * "https://...", "/\evil.com", "javascript:") falls back to the default.
 */
export function safeNextPath(raw: string | string[] | undefined | null, fallback = "/account"): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || typeof value !== "string" || value.length > 2048) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  // Backslashes and control characters can be normalised by browsers into another origin.
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  try {
    const url = new URL(value, "https://wizz.invalid");
    if (url.origin !== "https://wizz.invalid") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
