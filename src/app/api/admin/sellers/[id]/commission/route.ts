import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { ADMIN_ACTION_ROLES } from "@/modules/admin/access";
import { sellerCommissionSchema, updateSellerCommission } from "@/modules/admin/sellers";
import { adminErrorResponse, readJson, requestAuditMeta, zodErrorResponse } from "@/modules/admin/http";

/**
 * PATCH /api/admin/sellers/[id]/commission  { commissionRatePercent: 0–50 integer, note? }
 * SUPER_ADMIN only. Applies to future orders; OrderItem commission snapshots are immutable.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireRole(ADMIN_ACTION_ROLES.sellerCommission);
    const { id } = await params;
    const parsed = sellerCommissionSchema.safeParse(await readJson(req));
    if (!parsed.success) return zodErrorResponse(parsed.error);

    const seller = await updateSellerCommission(id, admin.id, parsed.data, requestAuditMeta(req));
    return NextResponse.json({ success: true, seller });
  } catch (err) {
    return adminErrorResponse(err, "Could not update the commission rate.");
  }
}
