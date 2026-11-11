import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { ADMIN_SECTION_ROLES } from "@/modules/admin/access";
import { getAdminDashboardStats } from "@/modules/admin/stats";
import { adminErrorResponse } from "@/modules/admin/http";

export const dynamic = "force-dynamic";

/** GET /api/admin/stats — the same live counters shown on the admin dashboard. */
export async function GET() {
  try {
    await requireRole(ADMIN_SECTION_ROLES.dashboard);
    const stats = await getAdminDashboardStats();
    return NextResponse.json({ stats }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    return adminErrorResponse(err, "Could not load dashboard statistics.");
  }
}
