import { z } from "zod";

export const PAKISTAN_PROVINCES = [
  "Punjab",
  "Sindh",
  "Khyber Pakhtunkhwa",
  "Balochistan",
  "Islamabad Capital Territory",
  "Gilgit-Baltistan",
  "Azad Jammu & Kashmir",
] as const;

/**
 * Normalises a Pakistani phone number to +92XXXXXXXXXX.
 * Accepts 03xx-xxxxxxx, +92 3xx xxxxxxx, 0092..., 92... and landlines
 * (area code + number, 9-10 national digits). Returns null when invalid.
 */
export function normalizePakistanPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("0092")) digits = digits.slice(4);
  else if (digits.startsWith("92") && digits.length >= 11) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = digits.slice(1);

  if (/^3\d{9}$/.test(digits)) return `+92${digits}`; // mobile
  if (/^[2-9]\d{8,9}$/.test(digits)) return `+92${digits}`; // landline incl. area code
  return null;
}

const trimmed = (max: number, min = 1) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max);

export const phoneSchema = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const normalized = normalizePakistanPhone(v);
    if (!normalized) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a valid Pakistani phone number, e.g. 0300 1234567 or +92 300 1234567.",
      });
      return z.NEVER;
    }
    return normalized;
  });

export const checkoutAddressSchema = z.object({
  fullName: trimmed(120, 2),
  phone: phoneSchema,
  street1: trimmed(200, 5),
  street2: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => v || undefined),
  city: trimmed(80, 2),
  stateProvince: z.enum(PAKISTAN_PROVINCES, {
    error: "Select a valid Pakistani province or territory.",
  }),
  postalCode: z.string().trim().regex(/^\d{5}$/, "Postal code must be 5 digits."),
  countryCode: z.literal("PK", { error: "We currently deliver within Pakistan only." }),
});

export const placeOrderSchema = z.object({
  customerEmail: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  customerPhone: phoneSchema.optional(),
  shippingAddress: checkoutAddressSchema,
  billingAddress: checkoutAddressSchema.optional(),
  shippingTier: z.enum(["STANDARD", "EXPRESS"]).default("STANDARD"),
  couponCode: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => v || undefined),
  idempotencyKey: z.string().trim().min(8).max(120),
  paymentMethod: z.enum(["CASH_ON_DELIVERY", "ONLINE_SANDBOX"]).default("CASH_ON_DELIVERY"),
});

export const registrationSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  password: z
    .string()
    .min(10, "Password must be at least 10 characters.")
    .max(128, "Password must be at most 128 characters.")
    .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "Password must include letters and numbers."),
  firstName: trimmed(60),
  lastName: trimmed(60),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(phoneSchema.optional()),
});

export function formatZodError(err: z.ZodError): string {
  return err.issues
    .map((i) => {
      const path = i.path.length ? `${i.path.join(".")}: ` : "";
      return `${path}${i.message}`;
    })
    .join("; ");
}

/** First message per top-level field, for showing errors next to form inputs. */
export function zodFieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.length ? String(issue.path[issue.path.length - 1]) : "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Saved address-book entry: same Pakistan delivery rules as checkout, plus an optional label. */
export const addressBookSchema = checkoutAddressSchema.extend({
  title: z
    .string()
    .trim()
    .max(40, "Label must be at most 40 characters.")
    .optional()
    .transform((v) => v || undefined),
  fullName: z.string().trim().min(2, "Enter the recipient's full name.").max(120),
  street1: z.string().trim().min(5, "Enter the street address (at least 5 characters).").max(200),
  city: z.string().trim().min(2, "Enter the city.").max(80),
  countryCode: z.literal("PK", { error: "We currently deliver within Pakistan only." }).default("PK"),
  isDefaultShipping: z.boolean().optional(),
});

export const addressUpdateSchema = addressBookSchema.extend({
  id: z.string().trim().min(1, "Address id is required.").max(64),
});

export const profileUpdateSchema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name.").max(60, "First name is too long."),
  lastName: z.string().trim().min(1, "Enter your last name.").max(60, "Last name is too long."),
  /** Optional; an empty value clears the saved phone number. */
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const normalized = normalizePakistanPhone(v);
      if (!normalized) {
        ctx.addIssue({
          code: "custom",
          message: "Enter a valid Pakistani phone number, e.g. 0300 1234567 or +92 300 1234567.",
        });
        return z.NEVER;
      }
      return normalized;
    }),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password.").max(128),
  newPassword: registrationSchema.shape.password,
});
