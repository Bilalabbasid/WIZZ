import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { ADMIN_ACTION_ROLES } from "@/modules/admin/access";
import { createPayoutRequest, createPayoutRequestSchema } from "@/modules/admin/finance";
import { adminErrorResponse, readJson, requestAuditMeta, zodErrorResponse } from "@/modules/admin/http";

/**
 * POST /api/admin/payouts  { sellerOrgId, amountMinor, idempotencyKey (UUID), notes? }
 * SUPER_ADMIN, FINANCE_ADMIN. Step 1 (maker) of a seller payout: reserves the amount against the
 * seller's available balance under a row lock. Same idempotencyKey → the same request (200),
 * never a second one. A different finance admin confirms the transfer at /[id]/approve.
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireRole(ADMIN_ACTION_ROLES.sellerPayouts);
    const parsed = createPayoutRequestSchema.safeParse(await readJson(req));
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const { sellerOrgId, ...input } = parsed.data;
    const { request, replayed } = await createPayoutRequest(sellerOrgId, admin.id, input, requestAuditMeta(req));
    return NextResponse.json({ success: true, request, replayed }, { status: replayed ? 200 : 201 });
  } catch (err) {
    return adminErrorResponse(err, "Could not create the payout request.");
  }
}
