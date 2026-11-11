import { Prisma, SellerOperationalStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isFirstPartySeller } from "@/lib/config";
import { suspendSellerOrg, reactivateSellerOrg } from "@/modules/sellers/services";
import { ADMIN_PAGE_SIZE, AdminRuleError, writeAdminAudit } from "./http";

export const SELLER_STATUS_VALUES = Object.values(SellerOperationalStatus);

export async function listSellers({ q, status, page }: { q: string; status: SellerOperationalStatus | null; page: number }) {
  const where: Prisma.SellerOrgWhereInput = {};
  if (status) where.operationalStatus = status;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { legalName: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
      { contactEmail: { contains: q, mode: "insensitive" } },
    ];
  }
  const [total, rows] = await Promise.all([
    prisma.sellerOrg.count({ where }),
    prisma.sellerOrg.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        slug: true,
        legalName: true,
        contactEmail: true,
        city: true,
        operationalStatus: true,
        commissionRatePercent: true,
        createdAt: true,
        _count: { select: { products: true, sellerOrders: true, memberships: true } },
      },
    }),
  ]);
  return {
    total,
    sellers: rows.map((r) => ({ ...r, isFirstParty: isFirstPartySeller(r) })),
  };
}

export async function getSellerDetail(id: string) {
  const org = await prisma.sellerOrg.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      legalName: true,
      taxId: true,
      businessType: true,
      operationalStatus: true,
      contactEmail: true,
      contactPhone: true,
      city: true,
      addressLine: true,
      commissionRatePercent: true,
      suspensionReason: true,
      createdAt: true,
      updatedAt: true,
      memberships: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          isActive: true,
          createdAt: true,
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      },
      _count: { select: { products: true, sellerOrders: true } },
    },
  });
  if (!org) return null;

  const [application, publishedProducts, pendingModeration, gmv, recentAudit] = await Promise.all([
    prisma.sellerApplication.findFirst({
      where: { approvedOrgId: id },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, tradingName: true, reviewedAt: true },
    }),
    prisma.product.count({ where: { sellerOrgId: id, status: "PUBLISHED" } }),
    prisma.product.count({ where: { sellerOrgId: id, moderationStatus: "PENDING_REVIEW" } }),
    prisma.sellerOrder.aggregate({
      where: { sellerOrgId: id, status: { notIn: ["PENDING_PAYMENT", "CANCELLED"] } },
      _sum: { totalMinor: true },
    }),
    prisma.auditEvent.findMany({
      where: { entityType: "SellerOrg", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, action: true, detailsJson: true, createdAt: true, actorUser: { select: { email: true } } },
    }),
  ]);

  return {
    ...org,
    isFirstParty: isFirstPartySeller(org),
    application,
    publishedProducts,
    pendingModeration,
    gmvMinor: gmv._sum.totalMinor ?? 0,
    recentAudit,
  };
}

export const sellerStatusSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("suspend"),
    reason: z.string().trim().min(10, "Give a suspension reason of at least 10 characters.").max(500),
  }),
  z.object({
    action: z.literal("reactivate"),
    reason: z.string().trim().max(500).optional(),
  }),
]);

/**
 * Suspend or reactivate via the sellers module services (which write their own audit
 * event and member notifications inside one transaction). The first-party org can never
 * be suspended, and transitions are validated against the current state.
 */
export async function changeSellerStatus(sellerOrgId: string, adminUserId: string, input: z.infer<typeof sellerStatusSchema>) {
  const org = await prisma.sellerOrg.findUnique({
    where: { id: sellerOrgId },
    select: { id: true, slug: true, operationalStatus: true },
  });
  if (!org) throw new AdminRuleError("Seller not found.", 404);
  if (isFirstPartySeller(org)) {
    throw new AdminRuleError("WIZZ.PK Direct is the first-party store and cannot be suspended or reactivated here.", 409);
  }

  if (input.action === "suspend") {
    if (org.operationalStatus !== SellerOperationalStatus.ACTIVE) {
      throw new AdminRuleError(`Only ACTIVE sellers can be suspended (current status: ${org.operationalStatus}).`, 409);
    }
    return suspendSellerOrg(sellerOrgId, adminUserId, input.reason);
  }

  if (org.operationalStatus !== SellerOperationalStatus.SUSPENDED) {
    throw new AdminRuleError(`Only SUSPENDED sellers can be reactivated (current status: ${org.operationalStatus}).`, 409);
  }
  return reactivateSellerOrg(sellerOrgId, adminUserId);
}

export const MAX_COMMISSION_PERCENT = 50;

export const sellerCommissionSchema = z.object({
  commissionRatePercent: z
    .number({ error: "Commission must be a number." })
    .int("Commission must be a whole percentage.")
    .min(0, "Commission cannot be negative.")
    .max(MAX_COMMISSION_PERCENT, `Commission cannot exceed ${MAX_COMMISSION_PERCENT}%.`),
  note: z.string().trim().max(500).optional(),
});

/**
 * Updates the seller's commission rate for FUTURE orders. Existing OrderItem rows keep
 * their commissionRatePercent snapshot, so historical commissions are not touched.
 */
export async function updateSellerCommission(
  sellerOrgId: string,
  adminUserId: string,
  input: z.infer<typeof sellerCommissionSchema>,
  meta: { ipAddress: string | null; userAgent: string | null }
) {
  return prisma.$transaction(async (tx) => {
    const org = await tx.sellerOrg.findUnique({
      where: { id: sellerOrgId },
      select: { id: true, commissionRatePercent: true },
    });
    if (!org) throw new AdminRuleError("Seller not found.", 404);
    if (org.commissionRatePercent === input.commissionRatePercent) {
      throw new AdminRuleError("The commission rate is already set to this value.", 409);
    }
    const updated = await tx.sellerOrg.update({
      where: { id: sellerOrgId },
      data: { commissionRatePercent: input.commissionRatePercent },
      select: { id: true, commissionRatePercent: true },
    });
    await writeAdminAudit(tx, {
      actorUserId: adminUserId,
      entityType: "SellerOrg",
      entityId: sellerOrgId,
      action: "SELLER_COMMISSION_CHANGED",
      details: {
        from: org.commissionRatePercent,
        to: input.commissionRatePercent,
        appliesTo: "future orders only",
        note: input.note || null,
      },
      meta,
    });
    return updated;
  });
}
