import { NextRequest, NextResponse } from "next/server";
import { changeSellerBankAccount, getSellerBankView } from "@/modules/sellers/services";
import { requireSellerContext, sellerErrorResponse, STORE_ADMIN_ROLES } from "@/modules/sellers/api-guard";
import { authRequestMeta } from "@/lib/auth";
import { checkRateLimit, clientIpFrom } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET  /api/seller/profile/bank  → masked payout account, 72-hour hold status, change history.
 * POST /api/seller/profile/bank  { bankName, bankAccountTitle, bankIban, currentPassword }
 *   Store OWNER/ADMIN only, current password required (rate limited). Pauses payouts for 72
 *   hours, records the change (last 4 digits only) and notifies every store owner/admin.
 */
export async function GET() {
  try {
    const { sellerOrg, membership } = await requireSellerContext();
    const canEditBank = STORE_ADMIN_ROLES.includes(membership.role);
    const bank = await getSellerBankView(sellerOrg.id, { includeHistory: canEditBank });
    return NextResponse.json({ success: true, bank, canEditBank }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err: unknown) {
    return sellerErrorResponse(err, "Could not load the payout account.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const { sellerOrg, user } = await requireSellerContext({
      roles: STORE_ADMIN_ROLES,
      roleLabel: "change the payout bank account",
    });
    // Per-IP limit on top of the per-user password-attempt limit in the service
    const ipLimit = checkRateLimit(`bank-change-ip:${clientIpFrom(req.headers)}`, { windowMs: 15 * 60 * 1000, max: 20 });
    if (!ipLimit.success) {
      return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
    }
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const result = await changeSellerBankAccount({
      sellerOrgId: sellerOrg.id,
      actorUserId: user.id,
      input: {
        bankName: body.bankName,
        bankAccountTitle: body.bankAccountTitle,
        bankIban: body.bankIban,
        currentPassword: body.currentPassword,
      },
      meta: authRequestMeta(req.headers),
    });
    const bank = await getSellerBankView(sellerOrg.id, { includeHistory: true });
    return NextResponse.json(
      { success: true, bank, cancelledPayoutRequests: result.cancelledPayoutRequests },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "";
    if (message.startsWith("RATE_LIMITED")) {
      return NextResponse.json({ error: message.replace(/^RATE_LIMITED:\s*/, "") }, { status: 429 });
    }
    return sellerErrorResponse(err, "Could not change the payout bank account.");
  }
}
