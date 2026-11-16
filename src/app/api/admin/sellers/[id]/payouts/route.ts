import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { ADMIN_ACTION_ROLES } from "@/modules/admin/access";
import { createPayoutRequest, payoutRequestBodySchema } from "@/modules/admin/finance";
import { adminErrorResponse, readJson, requestAuditMeta, zodErrorResponse } from "@/modules/admin/http";

/**
 * POST /api/admin/sellers/[id]/payouts  { amountMinor, idempotencyKey (UUID), notes? }
 * SUPER_ADMIN, FINANCE_ADMIN. Step 1 of the maker-checker payout: reserves the amount for the
 * seller in the URL. Nothing is paid until a DIFFERENT finance admin confirms the bank transfer
 * at POST /api/admin/payouts/[requestId]/approve. Same idempotencyKey → same request (200).
 * (Replaces the retired direct "record payout" endpoint.)
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireRole(ADMIN_ACTION_ROLES.sellerPayouts);
    const { id } = await params;
    const parsed = payoutRequestBodySchema.safeParse(await readJson(req));
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const { request, replayed } = await createPayoutRequest(id, admin.id, parsed.data, requestAuditMeta(req));
    return NextResponse.json({ success: true, request, replayed }, { status: replayed ? 200 : 201 });
  } catch (err) {
    return adminErrorResponse(err, "Could not create the payout request.");
  }
}
