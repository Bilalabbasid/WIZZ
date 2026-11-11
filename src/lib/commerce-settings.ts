import { cache } from "react";
import { prisma } from "@/lib/db";
import { SITE_CONFIG } from "@/lib/config";

/**
 * Commerce settings editable in Admin → Settings (PlatformSetting rows), with the
 * built-in defaults from SITE_CONFIG when a row is missing or invalid. Read once per
 * request (React cache), so an admin change applies to the next request.
 */
export interface CommerceSettings {
  freeShippingThresholdMinor: number;
  standardShippingMinor: number;
  expressShippingMinor: number;
  codMaxOrderMinor: number;
  defaultCommissionPercent: number;
  returnWindowDays: number;
}

export const COMMERCE_SETTING_KEYS = {
  freeShippingThresholdMinor: "FREE_SHIPPING_THRESHOLD_CENTS",
  standardShippingMinor: "STANDARD_SHIPPING_FEE_MINOR",
  expressShippingMinor: "EXPRESS_SHIPPING_FEE_MINOR",
  codMaxOrderMinor: "COD_MAX_ORDER_MINOR",
  defaultCommissionPercent: "DEFAULT_SELLER_COMMISSION_PERCENT",
  returnWindowDays: "RETURN_WINDOW_DAYS",
} as const satisfies Record<keyof CommerceSettings, string>;

export const DEFAULT_COMMERCE_SETTINGS: CommerceSettings = {
  freeShippingThresholdMinor: SITE_CONFIG.shipping.freeShippingThresholdMinor,
  standardShippingMinor: SITE_CONFIG.shipping.standardRateMinor,
  expressShippingMinor: SITE_CONFIG.shipping.expressRateMinor,
  codMaxOrderMinor: SITE_CONFIG.cod.maxOrderLimitMinor,
  defaultCommissionPercent: 10,
  returnWindowDays: 30,
};

const LIMITS: Record<keyof CommerceSettings, [number, number]> = {
  freeShippingThresholdMinor: [0, 100_000_000],
  standardShippingMinor: [0, 10_000_000],
  expressShippingMinor: [0, 10_000_000],
  codMaxOrderMinor: [0, 1_000_000_000],
  defaultCommissionPercent: [0, 50],
  returnWindowDays: [0, 365],
};

async function load(): Promise<CommerceSettings> {
  const settings = { ...DEFAULT_COMMERCE_SETTINGS };
  try {
    const rows = await prisma.platformSetting.findMany({
      where: { key: { in: Object.values(COMMERCE_SETTING_KEYS) } },
      select: { key: true, valueJson: true },
    });
    const byKey = new Map(rows.map((r) => [r.key, r.valueJson]));
    for (const [field, key] of Object.entries(COMMERCE_SETTING_KEYS) as Array<[keyof CommerceSettings, string]>) {
      const raw = byKey.get(key);
      if (raw === undefined) continue;
      let value: unknown;
      try {
        value = JSON.parse(raw);
      } catch {
        continue;
      }
      const [min, max] = LIMITS[field];
      if (typeof value === "number" && Number.isInteger(value) && value >= min && value <= max) {
        settings[field] = value;
      }
    }
  } catch (err) {
    // Never block shopping on a settings read: fall back to the defaults
    console.error("[settings] could not read platform settings, using defaults:", err instanceof Error ? err.message : err);
  }
  return settings;
}

export const getCommerceSettings = cache(load);
