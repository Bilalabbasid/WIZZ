import { CustomerOrderStatus, Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ADMIN_PAGE_SIZE } from "./http";

/** Orders that do not count toward what a customer has actually spent. */
const NOT_SPENT_STATUSES: CustomerOrderStatus[] = [
  CustomerOrderStatus.PENDING_PAYMENT,
  CustomerOrderStatus.CANCELLED,
  CustomerOrderStatus.REFUNDED,
];

// Explicit allow-list: passwordHash and session data are never selected.
const customerListSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  isEmailVerified: true,
  createdAt: true,
  _count: { select: { orders: true } },
} satisfies Prisma.UserSelect;

export async function listCustomers({ q, page }: { q: string; page: number }) {
  const where: Prisma.UserWhereInput = { role: UserRole.CUSTOMER };
  if (q) {
    const terms = q.split(/\s+/).filter(Boolean).slice(0, 4);
    where.AND = terms.map((t) => ({
      OR: [
        { firstName: { contains: t, mode: "insensitive" } },
        { lastName: { contains: t, mode: "insensitive" } },
        { email: { contains: t, mode: "insensitive" } },
        { phone: { contains: t } },
      ],
    }));
  }

  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: customerListSelect,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
    }),
  ]);

  const spent = rows.length
    ? await prisma.customerOrder.groupBy({
        by: ["customerUserId"],
        where: { customerUserId: { in: rows.map((r) => r.id) }, status: { notIn: NOT_SPENT_STATUSES } },
        _sum: { totalMinor: true },
      })
    : [];
  const spentMap = new Map(spent.map((s) => [s.customerUserId, s._sum.totalMinor ?? 0]));

  return {
    total,
    customers: rows.map((r) => ({
      id: r.id,
      email: r.email,
      firstName: r.firstName,
      lastName: r.lastName,
      phone: r.phone,
      isEmailVerified: r.isEmailVerified,
      createdAt: r.createdAt,
      orderCount: r._count.orders,
      totalSpentMinor: spentMap.get(r.id) ?? 0,
    })),
  };
}

export async function getCustomerDetail(id: string) {
  const user = await prisma.user.findFirst({
    where: { id, role: UserRole.CUSTOMER },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      isEmailVerified: true,
      createdAt: true,
      updatedAt: true,
      addresses: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          fullName: true,
          phone: true,
          street1: true,
          street2: true,
          city: true,
          stateProvince: true,
          postalCode: true,
          countryCode: true,
          isDefaultShipping: true,
          isDefaultBilling: true,
        },
      },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          totalMinor: true,
          createdAt: true,
          _count: { select: { sellerOrders: true } },
        },
      },
      _count: { select: { orders: true, reviews: true } },
    },
  });
  if (!user) return null;

  const [spent, returnsCount] = await Promise.all([
    prisma.customerOrder.aggregate({
      where: { customerUserId: id, status: { notIn: NOT_SPENT_STATUSES } },
      _sum: { totalMinor: true },
    }),
    prisma.returnRequest.count({ where: { customerUserId: id } }),
  ]);

  return { ...user, totalSpentMinor: spent._sum.totalMinor ?? 0, returnsCount };
}
