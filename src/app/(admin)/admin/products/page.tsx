import { prisma } from "@/lib/db";
import { AdminProductsView } from "@/components/admin-products-view";

export default async function AdminProductsPage() {
  const [products, categories, brands] = await Promise.all([
    prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        category: { select: { name: true } },
        brand: { select: { name: true } },
        sellerOrg: { select: { name: true } },
        variants: {
          include: { inventoryLevel: true },
        },
        media: { take: 1, orderBy: { displayOrder: "asc" } },
      },
    }),
    prisma.category.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    prisma.brand.findMany({ select: { id: true, name: true } }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
          Catalog Operations
        </span>
        <h1 className="text-3xl font-black tracking-tight text-white mt-1">
          1P Products & Listings
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Manage flagship WIZZ.PK direct merchandise, configure variants, and set promotional features.
        </p>
      </div>

      <AdminProductsView
        products={products}
        categories={categories}
        brands={brands}
      />
    </div>
  );
}
