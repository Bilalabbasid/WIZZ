import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { ADMIN_SECTION_ROLES } from "@/modules/admin/access";
import { adminErrorResponse, readJson, zodErrorResponse } from "@/modules/admin/http";
import { markRiskEventReviewed } from "@/modules/risk/services";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ note: z.string().trim().max(500).optional() });

/**
 * POST /api/admin/risk/[id]/review — marks a RISK_* event reviewed (writes a RISK_REVIEWED audit
 * event referencing it). Idempotent. Never blocks, unblocks or moves money.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(ADMIN_SECTION_ROLES.orders);
    const { id } = await params;
    const parsed = bodySchema.safeParse(await readJson(req).catch(() => ({})));
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const result = await markRiskEventReviewed(id, user.id, parsed.data.note);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return adminErrorResponse(err, "Could not mark the event reviewed.");
  }
}
