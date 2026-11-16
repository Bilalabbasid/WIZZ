import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { ADMIN_ACTION_ROLES } from "@/modules/admin/access";
import { approvePayoutRequest, approvePayoutSchema } from "@/modules/admin/finance";
import { adminErrorResponse, readJson, requestAuditMeta, zodErrorResponse } from "@/modules/admin/http";

/**
 * POST /api/admin/payouts/[id]/approve  { bankReference, sellerOrgId? }
 * SUPER_ADMIN, FINANCE_ADMIN; must NOT be the admin who requested the payout (403).
 * Confirms that the bank transfer was made: writes the MANUAL_PAYOUT ledger debit and marks the
 * request APPROVED_PAID atomically (a second confirmation is refused). `sellerOrgId`, when sent,
 * binds the call to that seller (404 for another seller's request).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireRole(ADMIN_ACTION_ROLES.sellerPayouts);
    const { id } = await params;
    const parsed = approvePayoutSchema.safeParse(await readJson(req));
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const request = await approvePayoutRequest(id, admin.id, parsed.data, requestAuditMeta(req));
    return NextResponse.json({ success: true, request });
  } catch (err) {
    return adminErrorResponse(err, "Could not confirm the payout.");
  }
}
