import { DiscountType, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ADMIN_PAGE_SIZE, AdminRuleError, writeAdminAudit } from "./http";

/*
 * Storage contract (must match src/modules/checkout/services.ts):
 * - code is stored UPPERCASE; checkout looks it up with code.trim().toUpperCase().
 * - PERCENTAGE: discountValueMinor holds the whole percent (15 = 15%); maxDiscountMinor caps it (paisa).
 * - FIXED_AMOUNT: discountValueMinor holds paisa; checkout ignores maxDiscountMinor, so we store null.
 * - minOrderAmountMinor in paisa; usageLimit null = unlimited; startsAt/expiresAt null = open-ended.
 */

const MAX_MINOR = 100_000_000; // Rs 1,000,000 sanity cap

const nullableDate = z
  .union([z.iso.datetime({ offset: true }), z.null()])
  .optional()
  .transform((v) => (v ? new Date(v) : null));

const baseFields = {
  description: z
    .string()
    .trim()
    .max(200)
    .nullish()
    .transform((v) => (v ? v : null)),
  discountType: z.enum(DiscountType),
  discountValueMinor: z.number().int().positive(),
  minOrderAmountMinor: z.number().int().min(0).max(MAX_MINOR),
  maxDiscountMinor: z.number().int().positive().max(MAX_MINOR).nullable(),
  usageLimit: z.number().int().min(1).max(10_000_000).nullable(),
  startsAt: nullableDate,
  expiresAt: nullableDate,
  isActive: z.boolean(),
};

type CouponFields = {
  discountType: DiscountType;
  discountValueMinor: number;
  maxDiscountMinor: number | null;
  startsAt: Date | null;
  expiresAt: Date | null;
};

function checkCouponRules(v: CouponFields, ctx: z.RefinementCtx) {
  if (v.discountType === DiscountType.PERCENTAGE) {
    if (v.discountValueMinor < 1 || v.discountValueMinor > 90) {
      ctx.addIssue({ code: "custom", path: ["discountValueMinor"], message: "Percentage discount must be between 1 and 90." });
    }
  } else {
    if (v.discountValueMinor > MAX_MINOR) {
      ctx.addIssue({ code: "custom", path: ["discountValueMinor"], message: "Fixed discount is too large." });
    }
    if (v.maxDiscountMinor !== null) {
      ctx.addIssue({ code: "custom", path: ["maxDiscountMinor"], message: "Maximum discount applies to percentage coupons only." });
    }
  }
  if (v.startsAt && v.expiresAt && v.expiresAt <= v.startsAt) {
    ctx.addIssue({ code: "custom", path: ["expiresAt"], message: "End date must be after the start date." });
  }
}

export const couponCreateSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9_-]{2,31}$/, "Code must be 3–32 characters: letters, digits, hyphen or underscore."),
    ...baseFields,
  })
  .superRefine(checkCouponRules);

/** Code is immutable after creation: historical orders reference coupons by code. */
export const couponUpdateSchema = z.object(baseFields).superRefine(checkCouponRules);

export type CouponCreateInput = z.infer<typeof couponCreateSchema>;
export type CouponUpdateInput = z.infer<typeof couponUpdateSchema>;
type Meta = { ipAddress: string | null; userAgent: string | null };

export type CouponFilter = "all" | "active" | "inactive" | "expired" | "scheduled";

export async function listCoupons({ q, filter, page }: { q: string; filter: CouponFilter; page: number }) {
  const now = new Date();
  const where: Prisma.CouponWhereInput = {};
  if (q) where.code = { contains: q.toUpperCase() };
  if (filter === "active") {
    where.isActive = true;
    where.AND = [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }];
  } else if (filter === "inactive") where.isActive = false;
  else if (filter === "expired") where.expiresAt = { lte: now };
  else if (filter === "scheduled") where.startsAt = { gt: now };

  const [total, coupons] = await Promise.all([
    prisma.coupon.count({ where }),
    prisma.coupon.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * ADMIN_PAGE_SIZE, take: ADMIN_PAGE_SIZE }),
  ]);
  return { total, coupons };
}

function snapshot(c: { code: string } & CouponFields & { minOrderAmountMinor: number; usageLimit: number | null; isActive: boolean; description: string | null }) {
  return {
    code: c.code,
    description: c.description,
    discountType: c.discountType,
    discountValueMinor: c.discountValueMinor,
    minOrderAmountMinor: c.minOrderAmountMinor,
    maxDiscountMinor: c.maxDiscountMinor,
    usageLimit: c.usageLimit,
    startsAt: c.startsAt?.toISOString() ?? null,
    expiresAt: c.expiresAt?.toISOString() ?? null,
    isActive: c.isActive,
  };
}

export async function createCoupon(adminUserId: string, input: CouponCreateInput, meta: Meta) {
  return prisma.$transaction(async (tx) => {
    const exists = await tx.coupon.findUnique({ where: { code: input.code }, select: { id: true } });
    if (exists) throw new AdminRuleError(`Coupon code ${input.code} already exists.`, 409);
    const coupon = await tx.coupon.create({ data: input });
    await writeAdminAudit(tx, {
      actorUserId: adminUserId,
      entityType: "Coupon",
      entityId: coupon.id,
      action: "COUPON_CREATED",
      details: snapshot(coupon),
      meta,
    });
    return coupon;
  });
}

export async function updateCoupon(adminUserId: string, id: string, input: CouponUpdateInput, meta: Meta) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.coupon.findUnique({ where: { id } });
    if (!before) throw new AdminRuleError("Coupon not found.", 404);
    if (input.usageLimit !== null && input.usageLimit < before.timesUsed) {
      throw new AdminRuleError(`Usage limit cannot be lower than the ${before.timesUsed} time(s) already used.`);
    }
    const after = await tx.coupon.update({ where: { id }, data: input });
    const action =
      before.isActive && !after.isActive ? "COUPON_DEACTIVATED" : !before.isActive && after.isActive ? "COUPON_ACTIVATED" : "COUPON_UPDATED";
    await writeAdminAudit(tx, {
      actorUserId: adminUserId,
      entityType: "Coupon",
      entityId: id,
      action,
      details: { before: snapshot(before), after: snapshot(after) },
      meta,
    });
    return after;
  });
}
