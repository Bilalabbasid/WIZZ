import type { Prisma } from "@prisma/client";
import { ADMIN_ACTION_ROLES, hasAnyRole, requireAdminPage } from "@/modules/admin/access";
import { ADMIN_PAGE_SIZE, firstParam, parsePage } from "@/modules/admin/http";
import { prisma } from "@/lib/db";
import { AdminOrdersView } from "@/components/admin-orders-view";
import { AdminEmptyState, AdminFilterBar, AdminPagination } from "@/components/admin-ui";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdminPage("orders", "/admin/orders");
  const permissions = {
    canFulfil: hasAnyRole(user.role, ADMIN_ACTION_ROLES.orderFulfil),
    canReconcileCod: hasAnyRole(user.role, ADMIN_ACTION_ROLES.codReconcile),
  };
  const sp = await searchParams;
  const q = firstParam(sp.q);
  const page = parsePage(sp.page);

  const where: Prisma.CustomerOrderWhereInput = q
    ? {
        OR: [
          { orderNumber: { contains: q, mode: "insensitive" } },
          { customerEmail: { contains: q, mode: "insensitive" } },
          { customerPhone: { contains: q } },
        ],
      }
    : {};

  const [total, orders] = await Promise.all([
    prisma.customerOrder.count({ where }),
    prisma.customerOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      include: {
        paymentAttempts: { select: { provider: true } },
        sellerOrders: {
          orderBy: { createdAt: "asc" },
          include: {
            sellerOrg: { select: { name: true } },
            items: true,
            shipments: true,
          },
        },
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">
          Fulfillment & Dispatch
        </span>
        <h1 className="text-3xl font-black tracking-tight text-white mt-1">
          Orders & Fulfillment Operations
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Monitor incoming customer orders, inspect line items, and generate real carrier waybills.
        </p>
      </div>

      <AdminFilterBar basePath="/admin/orders" q={q} placeholder="Order number, customer email or phone" />

      {orders.length === 0 ? (
        <AdminEmptyState title={q ? "No orders match your search" : "No orders yet"} />
      ) : (
        <AdminOrdersView key={`${q}:${page}`} orders={orders} permissions={permissions} />
      )}

      <AdminPagination basePath="/admin/orders" page={page} pageSize={ADMIN_PAGE_SIZE} total={total} params={{ q }} />
    </div>
  );
}
