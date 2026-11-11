import { NextRequest, NextResponse } from "next/server";
import type { ReturnStatus } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { ADMIN_SECTION_ROLES } from "@/modules/admin/access";
import { listReturnRequests, RETURN_STATUS_VALUES } from "@/modules/admin/returns";
import { ADMIN_PAGE_SIZE, adminErrorResponse, firstParam, parsePage } from "@/modules/admin/http";

export const dynamic = "force-dynamic";

/** GET /api/admin/returns?status=&q=&page= — read-only list. Actions use /api/admin/returns/[id]/resolve. */
export async function GET(req: NextRequest) {
  try {
    await requireRole(ADMIN_SECTION_ROLES.returns);
    const sp = req.nextUrl.searchParams;
    const rawStatus = firstParam(sp.get("status"));
    const status = (RETURN_STATUS_VALUES as string[]).includes(rawStatus) ? (rawStatus as ReturnStatus) : null;
    const page = parsePage(sp.get("page"));
    const result = await listReturnRequests({ status, q: firstParam(sp.get("q")), page });
    return NextResponse.json({ ...result, page, pageSize: ADMIN_PAGE_SIZE }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    return adminErrorResponse(err, "Could not load return requests.");
  }
}
