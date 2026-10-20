import { prisma } from "@/lib/db";
import { AdminOrdersView } from "@/components/admin-orders-view";

export default async function AdminOrdersPage() {
  const orders = await prisma.customerOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      sellerOrders: {
        include: {
          sellerOrg: { select: { name: true } },
          items: true,
          shipments: true,
        },
      },
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
          Fulfillment & Dispatch
        </span>
        <h1 className="text-3xl font-black tracking-tight text-white mt-1">
          Orders & Fulfillment Operations
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Monitor incoming customer orders, inspect line items, and generate real carrier waybills.
        </p>
      </div>

      <AdminOrdersView orders={orders} />
    </div>
  );
}
