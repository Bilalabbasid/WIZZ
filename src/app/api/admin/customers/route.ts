import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { ADMIN_SECTION_ROLES } from "@/modules/admin/access";
import { listCustomers } from "@/modules/admin/customers";
import { ADMIN_PAGE_SIZE, adminErrorResponse, firstParam, parsePage } from "@/modules/admin/http";

export const dynamic = "force-dynamic";

/** GET /api/admin/customers?q=&page= — paginated customer list (no credentials). */
export async function GET(req: NextRequest) {
  try {
    await requireRole(ADMIN_SECTION_ROLES.customers);
    const q = firstParam(req.nextUrl.searchParams.get("q"));
    const page = parsePage(req.nextUrl.searchParams.get("page"));
    const result = await listCustomers({ q, page });
    return NextResponse.json(
      { ...result, page, pageSize: ADMIN_PAGE_SIZE },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err) {
    return adminErrorResponse(err, "Could not load customers.");
  }
}
