import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { ADMIN_SECTION_ROLES } from "@/modules/admin/access";
import { categoryInputSchema, createCategory, listCategoriesForAdmin } from "@/modules/admin/categories";
import { adminErrorResponse, readJson, requestAuditMeta, zodErrorResponse } from "@/modules/admin/http";

export const dynamic = "force-dynamic";

/** GET /api/admin/categories — all categories (flat, with product/child counts). */
export async function GET() {
  try {
    await requireRole(ADMIN_SECTION_ROLES.categories);
    const categories = await listCategoriesForAdmin();
    return NextResponse.json({ categories }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    return adminErrorResponse(err, "Could not load categories.");
  }
}

/** POST /api/admin/categories — create a category. */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireRole(ADMIN_SECTION_ROLES.categories);
    const parsed = categoryInputSchema.safeParse(await readJson(req));
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const category = await createCategory(admin.id, parsed.data, requestAuditMeta(req));
    return NextResponse.json({ success: true, category }, { status: 201 });
  } catch (err) {
    return adminErrorResponse(err, "Could not create the category.");
  }
}
