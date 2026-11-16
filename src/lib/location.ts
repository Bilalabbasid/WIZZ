/**
 * Shopper location (city). Chosen in the header strip and remembered in a cookie; later this
 * can be filled from real location detection by writing the same cookie. Used to show nearby
 * sellers' listings first. Not sensitive, so the cookie is readable by the browser.
 */
export const CITY_COOKIE = "wizz_city";
export const ALL_PAKISTAN = "ALL";
export const DEFAULT_CITY = "Karachi";

export const PAKISTAN_CITIES = [
  "Karachi",
  "Lahore",
  "Islamabad",
  "Rawalpindi",
  "Faisalabad",
  "Multan",
  "Peshawar",
  "Quetta",
  "Sialkot",
  "Gujranwala",
  "Hyderabad",
] as const;

/** Validated city from a raw cookie value: a known city, ALL, or the default. */
export function normalizeCity(raw: string | undefined | null): string {
  if (!raw) return DEFAULT_CITY;
  const value = decodeURIComponent(raw).trim();
  if (value === ALL_PAKISTAN) return ALL_PAKISTAN;
  return (PAKISTAN_CITIES as readonly string[]).find((c) => c.toLowerCase() === value.toLowerCase()) ?? DEFAULT_CITY;
}

/** Same-city check used to order listings (seller city vs shopper city). */
export function isSameCity(sellerCity: string | null | undefined, shopperCity: string): boolean {
  return Boolean(sellerCity) && shopperCity !== ALL_PAKISTAN && sellerCity!.trim().toLowerCase() === shopperCity.toLowerCase();
}
