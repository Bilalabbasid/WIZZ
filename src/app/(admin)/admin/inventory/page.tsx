import { prisma } from "@/lib/db";
import { AdminInventoryView } from "@/components/admin-inventory-view";

export default async function AdminInventoryPage() {
  const [variants, recentAdjustments] = await Promise.all([
    prisma.productVariant.findMany({
      orderBy: { sku: "asc" },
      include: {
        product: { select: { title: true, sellerOrgId: true } },
        inventoryLevel: true,
      },
    }),
    prisma.inventoryAdjustment.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
      include: {
        variant: { select: { sku: true, title: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
          Warehouse & Operations
        </span>
        <h1 className="text-3xl font-black tracking-tight text-white mt-1">
          Inventory & Stock Adjustments
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Monitor transactional warehouse balances, manage receiving and cycle counts with audit logs.
        </p>
      </div>

      <AdminInventoryView
        variants={variants}
        recentAdjustments={recentAdjustments}
      />
    </div>
  );
}
