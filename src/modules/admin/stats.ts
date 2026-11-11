import { CustomerOrderStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { SITE_CONFIG } from "@/lib/config";

/** Orders that never became real sales: unpaid online checkouts and cancellations. */
export const GMV_EXCLUDED_STATUSES: CustomerOrderStatus[] = [
  CustomerOrderStatus.PENDING_PAYMENT,
  CustomerOrderStatus.CANCELLED,
];

function startOfToday(now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Real platform counters for the admin dashboard. Every figure is a live database count;
 * nothing is estimated.
 *
 * "Today" uses the server's local midnight. Low stock = sellable units (available − reserved)
 * at or below the variant's lowStockThreshold, active variants only.
 */
export async function getAdminDashboardStats() {
  const now = new Date();
  const todayStart = startOfToday(now);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    ordersToday,
    orders7d,
    gmvAll,
    gmv7d,
    pendingApplications,
    pendingModeration,
    openReturns,
    lowStockRows,
    activeSellers,
    customers,
    publishedFirstParty,
    publishedAll,
    pendingRefunds,
  ] = await Promise.all([
    prisma.customerOrder.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.customerOrder.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.customerOrder.aggregate({
      _sum: { totalMinor: true },
      _count: true,
      where: { status: { notIn: GMV_EXCLUDED_STATUSES } },
    }),
    prisma.customerOrder.aggregate({
      _sum: { totalMinor: true },
      where: { status: { notIn: GMV_EXCLUDED_STATUSES }, createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.sellerApplication.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
    prisma.product.count({ where: { moderationStatus: "PENDING_REVIEW" } }),
    prisma.returnRequest.count({ where: { status: { in: ["SUBMITTED", "APPROVED", "RECEIVED"] } } }),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "InventoryLevel" il
      JOIN "ProductVariant" pv ON pv."id" = il."variantId"
      WHERE pv."isActive" = true
        AND (il."availableUnits" - il."reservedUnits") <= il."lowStockThreshold"
    `,
    prisma.sellerOrg.count({ where: { operationalStatus: "ACTIVE" } }),
    prisma.user.count({ where: { role: UserRole.CUSTOMER } }),
    prisma.product.count({ where: { status: "PUBLISHED", sellerOrgId: SITE_CONFIG.flagshipSellerId } }),
    prisma.product.count({ where: { status: "PUBLISHED" } }),
    prisma.refund.aggregate({ _count: true, _sum: { amountMinor: true }, where: { status: "PENDING" } }),
  ]);

  return {
    ordersToday,
    orders7d,
    gmvMinor: gmvAll._sum.totalMinor ?? 0,
    gmvOrderCount: gmvAll._count,
    gmv7dMinor: gmv7d._sum.totalMinor ?? 0,
    pendingApplications,
    pendingModeration,
    openReturns,
    lowStock: Number(lowStockRows[0]?.count ?? 0),
    activeSellers,
    customers,
    publishedFirstParty,
    publishedAll,
    pendingRefunds: pendingRefunds._count,
    pendingRefundsMinor: pendingRefunds._sum.amountMinor ?? 0,
  };
}

export type AdminDashboardStats = Awaited<ReturnType<typeof getAdminDashboardStats>>;
