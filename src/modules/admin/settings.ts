import { z } from "zod";
import { prisma } from "@/lib/db";
import { SITE_CONFIG } from "@/lib/config";
import { getCommerceSettings, type CommerceSettings } from "@/lib/commerce-settings";
import { AdminRuleError, writeAdminAudit } from "./http";

/*
 * Typed editor for PlatformSetting rows.
 *
 * The six commerce keys are read by live code through getCommerceSettings()
 * (src/lib/commerce-settings.ts, once per request, falling back to SITE_CONFIG defaults when a
 * row is missing or invalid). `effectiveValue` therefore comes from that function, so the page
 * shows what is actually in force. SUPPORT_EMAIL / SUPPORT_PHONE are still governed by env
 * vars (SITE_CONFIG) and are stored only. Zod ranges below match the limits in
 * commerce-settings.ts so a saved value is never silently ignored.
 */

type Kind = "money" | "percent" | "integer" | "email" | "text";

interface SettingDefinition {
  key: string;
  label: string;
  description: string;
  category: string;
  isPublic: boolean;
  kind: Kind;
  schema: z.ZodType<string | number>;
  /** Whether any running code path reads this stored value. */
  wired: boolean;
  /** What actually governs the behaviour today. */
  effectiveSource: string;
  /** Field of getCommerceSettings() holding the in-force value, when wired. */
  commerceField?: keyof CommerceSettings;
  /** Static in-force value for keys not read from the database. */
  staticEffectiveValue?: string | number | null;
}

const money = (max: number) => z.number().int("Must be a whole number of paisa.").min(0).max(max);

export const SETTING_DEFINITIONS: SettingDefinition[] = [
  {
    key: "FREE_SHIPPING_THRESHOLD_CENTS",
    label: "Free standard shipping threshold",
    description: "Per-seller subtotal at or above which standard shipping is free. Stored in paisa (legacy key name).",
    category: "SHIPPING",
    isPublic: true,
    kind: "money",
    schema: money(100_000_000),
    wired: true,
    effectiveSource: "Applied to new checkouts (getCommerceSettings)",
    commerceField: "freeShippingThresholdMinor",
  },
  {
    key: "STANDARD_SHIPPING_FEE_MINOR",
    label: "Standard shipping fee (per seller package)",
    description: "Charged per seller package below the free-shipping threshold.",
    category: "SHIPPING",
    isPublic: true,
    kind: "money",
    schema: money(10_000_000),
    wired: true,
    effectiveSource: "Applied to new checkouts (getCommerceSettings)",
    commerceField: "standardShippingMinor",
  },
  {
    key: "EXPRESS_SHIPPING_FEE_MINOR",
    label: "Express shipping fee (per seller package)",
    description: "Charged per seller package when the customer picks express delivery.",
    category: "SHIPPING",
    isPublic: true,
    kind: "money",
    schema: money(10_000_000),
    wired: true,
    effectiveSource: "Applied to new checkouts (getCommerceSettings)",
    commerceField: "expressShippingMinor",
  },
  {
    key: "COD_MAX_ORDER_MINOR",
    label: "Cash-on-delivery order limit",
    description: "Orders above this total cannot use COD.",
    category: "PAYMENTS",
    isPublic: true,
    kind: "money",
    schema: money(1_000_000_000),
    wired: true,
    effectiveSource: "Applied to COD validation at checkout (getCommerceSettings)",
    commerceField: "codMaxOrderMinor",
  },
  {
    key: "DEFAULT_SELLER_COMMISSION_PERCENT",
    label: "Default commission for new sellers",
    description: "Commission given to newly approved sellers. Per-seller rates are edited on each seller's page and DO apply.",
    category: "MARKETPLACE",
    isPublic: false,
    kind: "percent",
    schema: z.number().int("Must be a whole percentage.").min(0).max(50),
    wired: true,
    effectiveSource: "Applied when a seller is approved or registered; existing sellers keep their own rate",
    commerceField: "defaultCommissionPercent",
  },
  {
    key: "RETURN_WINDOW_DAYS",
    label: "Return window (days)",
    description: "Days after delivery during which customers may request a return.",
    category: "POLICIES",
    isPublic: true,
    kind: "integer",
    schema: z.number().int().min(0).max(365),
    wired: true,
    effectiveSource: "Return requests are refused after this many days from delivery",
    commerceField: "returnWindowDays",
  },
  {
    key: "SUPPORT_EMAIL",
    label: "Support email",
    description: "Customer support address.",
    category: "GENERAL",
    isPublic: true,
    kind: "email",
    schema: z.email("Enter a valid email address.").max(200),
    wired: false,
    effectiveSource: "SITE_CONFIG.supportEmail (SUPPORT_EMAIL env var) — this stored value is not used",
    staticEffectiveValue: SITE_CONFIG.supportEmail,
  },
  {
    key: "SUPPORT_PHONE",
    label: "Support phone",
    description: "Customer support phone number.",
    category: "GENERAL",
    isPublic: true,
    kind: "text",
    schema: z
      .string()
      .trim()
      .max(40)
      .regex(/^[+0-9 ()-]*$/, "Use digits, spaces, +, -, ( and ) only."),
    wired: false,
    effectiveSource: "SITE_CONFIG.supportPhone (SUPPORT_PHONE env var) — this stored value is not used",
    staticEffectiveValue: SITE_CONFIG.supportPhone || null,
  },
];

const DEF_BY_KEY = new Map(SETTING_DEFINITIONS.map((d) => [d.key, d]));

export const settingUpdateSchema = z.object({
  key: z.string().max(100),
  value: z.union([z.string(), z.number()]),
});

function parseStored(valueJson: string): unknown {
  try {
    return JSON.parse(valueJson);
  } catch {
    return valueJson;
  }
}

export async function getSettingsForAdmin() {
  const [rows, commerce] = await Promise.all([
    prisma.platformSetting.findMany({ orderBy: [{ category: "asc" }, { key: "asc" }] }),
    getCommerceSettings(),
  ]);
  const rowMap = new Map(rows.map((r) => [r.key, r]));
  const known = SETTING_DEFINITIONS.map((d) => {
    const row = rowMap.get(d.key);
    return {
      key: d.key,
      label: d.label,
      description: d.description,
      category: d.category,
      isPublic: d.isPublic,
      kind: d.kind,
      wired: d.wired,
      effectiveSource: d.effectiveSource,
      effectiveValue: d.commerceField ? commerce[d.commerceField] : (d.staticEffectiveValue ?? null),
      storedValue: row ? parseStored(row.valueJson) : null,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  });
  const other = rows
    .filter((r) => !DEF_BY_KEY.has(r.key))
    .map((r) => ({ key: r.key, category: r.category, isPublic: r.isPublic, value: r.valueJson, updatedAt: r.updatedAt.toISOString() }));
  return { known, other };
}

export type AdminSettingsData = Awaited<ReturnType<typeof getSettingsForAdmin>>;

export async function updateSetting(
  adminUserId: string,
  input: z.infer<typeof settingUpdateSchema>,
  meta: { ipAddress: string | null; userAgent: string | null }
) {
  const def = DEF_BY_KEY.get(input.key);
  if (!def) throw new AdminRuleError("This setting has no editor and cannot be changed here.");
  const parsed = def.schema.safeParse(input.value);
  if (!parsed.success) throw new AdminRuleError(`${def.label}: ${parsed.error.issues[0]?.message ?? "invalid value."}`);
  const valueJson = JSON.stringify(parsed.data);

  return prisma.$transaction(async (tx) => {
    const before = await tx.platformSetting.findUnique({ where: { key: def.key } });
    const row = await tx.platformSetting.upsert({
      where: { key: def.key },
      update: { valueJson, category: def.category, isPublic: def.isPublic },
      create: { key: def.key, valueJson, category: def.category, isPublic: def.isPublic },
    });
    await writeAdminAudit(tx, {
      actorUserId: adminUserId,
      entityType: "PlatformSetting",
      entityId: def.key,
      action: "PLATFORM_SETTING_UPDATED",
      details: { from: before ? parseStored(before.valueJson) : null, to: parsed.data, wired: def.wired },
      meta,
    });
    return { key: row.key, storedValue: parsed.data, updatedAt: row.updatedAt.toISOString(), wired: def.wired };
  });
}
