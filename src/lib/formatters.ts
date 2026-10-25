import { SITE_CONFIG } from "./config";

/**
 * Formats minor unit integer cents into human-readable currency.
 * e.g. 2999 -> "$29.99"
 */
export function formatCurrency(
  amountMinor: number | bigint,
  currency: string = SITE_CONFIG.defaultCurrency,
  locale: string = SITE_CONFIG.defaultLocale
): string {
  const numericAmount = typeof amountMinor === "bigint" ? Number(amountMinor) : amountMinor;
  const majorUnits = numericAmount / 100;

  if (currency === "PKR") {
    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(majorUnits);
    return `Rs. ${formatted}`;
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(majorUnits);
}

/**
 * Formats minor units as a bare number without the currency prefix,
 * for layouts that typeset "Rs." separately from the amount.
 */
export function formatAmount(
  amountMinor: number | bigint,
  locale: string = SITE_CONFIG.defaultLocale
): string {
  const numericAmount = typeof amountMinor === "bigint" ? Number(amountMinor) : amountMinor;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numericAmount / 100);
}

/**
 * Convenient alias to format minor units in Pakistani Rupees (PKR)
 */
export function formatPkr(amountMinor: number | bigint): string {
  return formatCurrency(amountMinor, "PKR");
}

/**
 * Formats a Date object or ISO string into localized human date.
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(SITE_CONFIG.defaultLocale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

/**
 * Formats a Date object or ISO string into localized timestamp with time.
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(SITE_CONFIG.defaultLocale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/**
 * Calculates and formats a realistic delivery date estimate for marketplace display.
 * e.g. "Thu, Oct 16" (skips Sundays for courier dispatch realism).
 */
export function formatEstimatedDelivery(businessDaysOffset: number = 2): string {
  const d = new Date();
  let added = 0;
  while (added < businessDaysOffset) {
    d.setDate(d.getDate() + 1);
    // 0 = Sunday
    if (d.getDay() !== 0) {
      added++;
    }
  }
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
}

const JSON_LD_ESCAPES: Array<[string, string]> = [
  ["<", "u003c"],
  [String.fromCharCode(0x2028), "u2028"],
  [String.fromCharCode(0x2029), "u2029"],
];
const BACKSLASH = String.fromCharCode(92);

/**
 * Serializes structured data for a <script type="application/ld+json"> tag.
 * Escapes "<" and the U+2028/U+2029 line separators as JSON unicode escapes so
 * seller-written text such as "</script>" cannot close the tag and inject markup.
 */
export function serializeJsonLd(data: unknown): string {
  let json = JSON.stringify(data);
  for (const [char, code] of JSON_LD_ESCAPES) {
    json = json.split(char).join(BACKSLASH + code);
  }
  return json;
}
