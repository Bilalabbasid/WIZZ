import { Prisma, ReturnStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ADMIN_PAGE_SIZE } from "./http";

export const RETURN_STATUS_VALUES = Object.values(ReturnStatus);

/**
 * Display-only estimate of the refundable value of one returned line. Mirrors the
 * server-side rule used by the resolve API: line price × qty minus the pro-rata share of
 * the line's discount. The API computes the authoritative amount when recording a refund.
 */
export function returnLineValueMinor(line: { quantity: number; orderItem: { unitPriceMinor: number; discountMinor: number; quantity: number } }) {
  const { unitPriceMinor, discountMinor, quantity: orderedQty } = line.orderItem;
  const discountShare = orderedQty > 0 ? Math.round((discountMinor * line.quantity) / orderedQty) : 0;
  return unitPriceMinor * line.quantity - discountShare;
}

export async function listReturnRequests({ status, q, page }: { status: ReturnStatus | null; q: string; page: number }) {
  const where: Prisma.ReturnRequestWhereInput = {};
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { sellerOrder: { sellerOrderNumber: { contains: q, mode: "insensitive" } } },
      { sellerOrder: { customerOrder: { orderNumber: { contains: q, mode: "insensitive" } } } },
      { sellerOrder: { customerOrder: { customerEmail: { contains: q, mode: "insensitive" } } } },
    ];
  }

  const [total, rows, statusCounts] = await Promise.all([
    prisma.returnRequest.count({ where }),
    prisma.returnRequest.findMany({
      where,
      orderBy: { requestedAt: "desc" },
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        status: true,
        reasonCode: true,
        explanation: true,
        requestedAt: true,
        resolvedAt: true,
        updatedAt: true,
        customerUserId: true,
        sellerOrder: {
          select: {
            id: true,
            sellerOrderNumber: true,
            status: true,
            sellerOrg: { select: { id: true, name: true } },
            customerOrder: { select: { id: true, orderNumber: true, customerEmail: true, paymentStatus: true } },
          },
        },
        items: {
          select: {
            id: true,
            quantity: true,
            inspectionResult: true,
            orderItem: {
              select: {
                productTitleSnapshot: true,
                variantNameSnapshot: true,
                skuSnapshot: true,
                quantity: true,
                unitPriceMinor: true,
                discountMinor: true,
              },
            },
          },
        },
      },
    }),
    prisma.returnRequest.groupBy({ by: ["status"], _count: true }),
  ]);

  // ReturnRequest has no User relation in the schema, so customers are resolved in one query.
  const customerIds = [...new Set(rows.map((r) => r.customerUserId))];
  const sellerOrderIds = [...new Set(rows.map((r) => r.sellerOrder.id))];
  const [customers, refunds] = await Promise.all([
    customerIds.length
      ? prisma.user.findMany({ where: { id: { in: customerIds } }, select: { id: true, firstName: true, lastName: true, email: true } })
      : Promise.resolve([]),
    sellerOrderIds.length
      ? prisma.refund.findMany({
          where: { sellerOrderId: { in: sellerOrderIds } },
          select: { id: true, sellerOrderId: true, amountMinor: true, status: true, reason: true, externalRefundRef: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);
  const customerMap = new Map(customers.map((c) => [c.id, c]));

  return {
    total,
    counts: Object.fromEntries(statusCounts.map((s) => [s.status, s._count])) as Partial<Record<ReturnStatus, number>>,
    returns: rows.map((r) => ({
      ...r,
      customer: customerMap.get(r.customerUserId) ?? null,
      valueMinor: r.items.reduce((sum, it) => sum + returnLineValueMinor(it), 0),
      refunds: refunds.filter((f) => f.sellerOrderId === r.sellerOrder.id),
    })),
  };
}
