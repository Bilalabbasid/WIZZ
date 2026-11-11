import { requireAdminPage } from "@/modules/admin/access";
import { listCategoriesForAdmin } from "@/modules/admin/categories";
import { AdminPageHeader } from "@/components/admin-ui";
import { AdminCategoriesManager } from "@/components/admin-categories-manager";

export default async function AdminCategoriesPage() {
  await requireAdminPage("categories", "/admin/categories");
  const categories = await listCategoriesForAdmin();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Catalog"
        title="Categories"
        description="Storefront taxonomy. Inactive categories are hidden from storefront category listings. Categories that still hold products or sub-categories cannot be deleted — deactivate them instead."
      />
      <AdminCategoriesManager
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          imageUrl: c.imageUrl,
          parentId: c.parentId,
          displayOrder: c.displayOrder,
          isActive: c.isActive,
          productCount: c._count.products,
          childCount: c._count.children,
        }))}
      />
    </div>
  );
}
