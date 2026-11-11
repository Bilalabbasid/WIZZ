import { NextRequest, NextResponse } from "next/server";
import { SellerOperationalStatus } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { ADMIN_SECTION_ROLES } from "@/modules/admin/access";
import { listSellers, SELLER_STATUS_VALUES } from "@/modules/admin/sellers";
import { ADMIN_PAGE_SIZE, adminErrorResponse, firstParam, parsePage } from "@/modules/admin/http";

export const dynamic = "force-dynamic";

/** GET /api/admin/sellers?q=&status=&page= */
export async function GET(req: NextRequest) {
  try {
    await requireRole(ADMIN_SECTION_ROLES.sellers);
    const sp = req.nextUrl.searchParams;
    const rawStatus = firstParam(sp.get("status"));
    const status = (SELLER_STATUS_VALUES as string[]).includes(rawStatus) ? (rawStatus as SellerOperationalStatus) : null;
    const page = parsePage(sp.get("page"));
    const result = await listSellers({ q: firstParam(sp.get("q")), status, page });
    return NextResponse.json({ ...result, page, pageSize: ADMIN_PAGE_SIZE }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    return adminErrorResponse(err, "Could not load sellers.");
  }
}
