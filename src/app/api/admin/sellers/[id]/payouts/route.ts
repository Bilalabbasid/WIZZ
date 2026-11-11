import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { ADMIN_ACTION_ROLES } from "@/modules/admin/access";
import { payoutSchema, recordSellerPayout } from "@/modules/admin/finance";
import { adminErrorResponse, readJson, zodErrorResponse } from "@/modules/admin/http";

/**
 * POST /api/admin/sellers/[id]/payouts  { payoutAmountMinor, bankTransactionRef, notes? }
 * SUPER_ADMIN, FINANCE_ADMIN. Records a bank transfer finance has already made; no money is
 * moved by this endpoint. The sellers service validates the eligible balance under a row
 * lock and writes the audit event in the same transaction.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireRole(ADMIN_ACTION_ROLES.sellerPayouts);
    const { id } = await params;
    const parsed = payoutSchema.safeParse(await readJson(req));
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const payout = await recordSellerPayout(id, admin.id, parsed.data);
    return NextResponse.json({ success: true, payout }, { status: 201 });
  } catch (err) {
    return adminErrorResponse(err, "Could not record the payout.");
  }
}
