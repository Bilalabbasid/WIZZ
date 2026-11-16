import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { ADMIN_ACTION_ROLES } from "@/modules/admin/access";
import { revealBankSchema, revealSellerBankDetails } from "@/modules/admin/finance";
import { adminErrorResponse, readJson, requestAuditMeta, zodErrorResponse } from "@/modules/admin/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/sellers/[id]/bank/reveal  { reason? }
 * SUPER_ADMIN, FINANCE_ADMIN (requireRole also enforces the staff two-factor session).
 * The ONLY endpoint that returns a full IBAN: needed by the finance admin making the transfer.
 * Every reveal writes a BANK_DETAILS_REVEALED audit event; responses are never cached.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireRole(ADMIN_ACTION_ROLES.sellerPayouts);
    const limit = checkRateLimit(`bank-reveal:${admin.id}`, { windowMs: 60 * 60 * 1000, max: 30 });
    if (!limit.success) {
      return NextResponse.json({ error: "Too many account-number reveals. Try again later." }, { status: 429 });
    }
    const { id } = await params;
    const parsed = revealBankSchema.safeParse(await readJson(req).catch(() => ({})));
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const bank = await revealSellerBankDetails(id, admin.id, parsed.data.reason, requestAuditMeta(req));
    return NextResponse.json({ success: true, bank }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (err) {
    return adminErrorResponse(err, "Could not reveal the bank details.");
  }
}
