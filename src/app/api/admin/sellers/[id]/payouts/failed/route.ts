import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { ADMIN_ACTION_ROLES } from "@/modules/admin/access";
import { markSellerPayoutFailed, payoutFailedSchema } from "@/modules/admin/finance";
import { adminErrorResponse, readJson, zodErrorResponse } from "@/modules/admin/http";

/**
 * POST /api/admin/sellers/[id]/payouts/failed  { payoutReferenceId, failureReason }
 * SUPER_ADMIN, FINANCE_ADMIN. Restores the eligible balance for a bounced payout (once).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireRole(ADMIN_ACTION_ROLES.sellerPayouts);
    const { id } = await params;
    const parsed = payoutFailedSchema.safeParse(await readJson(req));
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const adjustment = await markSellerPayoutFailed(id, admin.id, parsed.data);
    return NextResponse.json({ success: true, adjustment: { id: adjustment.id, amountMinor: adjustment.amountMinor } });
  } catch (err) {
    return adminErrorResponse(err, "Could not record the failed payout.");
  }
}
