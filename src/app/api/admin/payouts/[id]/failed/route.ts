import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { ADMIN_ACTION_ROLES } from "@/modules/admin/access";
import { failPayoutSchema, markPayoutRequestFailed } from "@/modules/admin/finance";
import { adminErrorResponse, readJson, requestAuditMeta, zodErrorResponse } from "@/modules/admin/http";

/**
 * POST /api/admin/payouts/[id]/failed  { reason, sellerOrgId? }
 * SUPER_ADMIN, FINANCE_ADMIN. The bank returned a confirmed transfer: marks it FAILED (once) and
 * restores the amount to the seller's balance with an ELIGIBLE "REV_<bank reference>" credit.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireRole(ADMIN_ACTION_ROLES.sellerPayouts);
    const { id } = await params;
    const parsed = failPayoutSchema.safeParse(await readJson(req));
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const { request, adjustment } = await markPayoutRequestFailed(id, admin.id, parsed.data, requestAuditMeta(req));
    return NextResponse.json({ success: true, request, adjustment: { id: adjustment.id, amountMinor: adjustment.amountMinor } });
  } catch (err) {
    return adminErrorResponse(err, "Could not record the failed payout.");
  }
}
