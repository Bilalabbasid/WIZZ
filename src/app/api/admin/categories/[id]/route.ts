import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { ADMIN_SECTION_ROLES } from "@/modules/admin/access";
import { categoryPatchSchema, deleteCategory, updateCategory } from "@/modules/admin/categories";
import { adminErrorResponse, readJson, requestAuditMeta, zodErrorResponse } from "@/modules/admin/http";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/admin/categories/[id] — partial update (also used for the active toggle). */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const admin = await requireRole(ADMIN_SECTION_ROLES.categories);
    const { id } = await params;
    const parsed = categoryPatchSchema.safeParse(await readJson(req));
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const category = await updateCategory(admin.id, id, parsed.data, requestAuditMeta(req));
    return NextResponse.json({ success: true, category });
  } catch (err) {
    return adminErrorResponse(err, "Could not update the category.");
  }
}

/** DELETE /api/admin/categories/[id] — only for categories with no products and no children. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const admin = await requireRole(ADMIN_SECTION_ROLES.categories);
    const { id } = await params;
    await deleteCategory(admin.id, id, requestAuditMeta(req));
    return NextResponse.json({ success: true });
  } catch (err) {
    return adminErrorResponse(err, "Could not delete the category.");
  }
}
