import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { ADMIN_SECTION_ROLES } from "@/modules/admin/access";
import { ADMIN_PAGE_SIZE, adminErrorResponse, firstParam, parsePage } from "@/modules/admin/http";
import { listRiskEvents, type RiskReviewFilter } from "@/modules/risk/services";

export const dynamic = "force-dynamic";

/** GET /api/admin/risk?rule=&status=open|reviewed|all&q=&page= — read-only review queue. */
export async function GET(req: NextRequest) {
  try {
    await requireRole(ADMIN_SECTION_ROLES.orders);
    const sp = req.nextUrl.searchParams;
    const rawStatus = firstParam(sp.get("status"));
    const status: RiskReviewFilter = rawStatus === "reviewed" || rawStatus === "all" ? rawStatus : "open";
    const result = await listRiskEvents({
      rule: firstParam(sp.get("rule")) || null,
      status,
      q: firstParam(sp.get("q")),
      page: parsePage(sp.get("page")),
      pageSize: ADMIN_PAGE_SIZE,
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    return adminErrorResponse(err, "Could not load risk events.");
  }
}
