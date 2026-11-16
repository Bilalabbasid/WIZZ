import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { ADMIN_ACTION_ROLES } from "@/modules/admin/access";
import { rejectPayoutRequest, rejectPayoutSchema } from "@/modules/admin/finance";
import { adminErrorResponse, readJson, requestAuditMeta, zodErrorResponse } from "@/modules/admin/http";

/**
 * POST /api/admin/payouts/[id]/reject  { note, sellerOrgId? }
 * SUPER_ADMIN, FINANCE_ADMIN. Rejects a payout that has not been confirmed; the reserved amount
 * returns to the seller's available balance.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireRole(ADMIN_ACTION_ROLES.sellerPayouts);
    const { id } = await params;
    const parsed = rejectPayoutSchema.safeParse(await readJson(req));
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const request = await rejectPayoutRequest(id, admin.id, parsed.data, requestAuditMeta(req));
    return NextResponse.json({ success: true, request });
  } catch (err) {
    return adminErrorResponse(err, "Could not reject the payout.");
  }
}
