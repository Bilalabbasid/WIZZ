import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { ADMIN_SECTION_ROLES } from "@/modules/admin/access";
import { couponUpdateSchema, updateCoupon } from "@/modules/admin/coupons";
import { adminErrorResponse, readJson, requestAuditMeta, zodErrorResponse } from "@/modules/admin/http";

/**
 * PATCH /api/admin/coupons/[id] — full edit of everything except the code (immutable).
 * Deactivation is an edit with isActive=false; coupons are never hard-deleted so order
 * history that references the code stays meaningful.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireRole(ADMIN_SECTION_ROLES.coupons);
    const { id } = await params;
    const parsed = couponUpdateSchema.safeParse(await readJson(req));
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const coupon = await updateCoupon(admin.id, id, parsed.data, requestAuditMeta(req));
    return NextResponse.json({ success: true, coupon });
  } catch (err) {
    return adminErrorResponse(err, "Could not update the coupon.");
  }
}
