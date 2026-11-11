import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { ADMIN_SECTION_ROLES } from "@/modules/admin/access";
import { couponCreateSchema, createCoupon, listCoupons, type CouponFilter } from "@/modules/admin/coupons";
import { ADMIN_PAGE_SIZE, adminErrorResponse, firstParam, parsePage, readJson, requestAuditMeta, zodErrorResponse } from "@/modules/admin/http";

export const dynamic = "force-dynamic";

const FILTERS: CouponFilter[] = ["all", "active", "inactive", "expired", "scheduled"];

/** GET /api/admin/coupons?q=&filter=&page= */
export async function GET(req: NextRequest) {
  try {
    await requireRole(ADMIN_SECTION_ROLES.coupons);
    const sp = req.nextUrl.searchParams;
    const rawFilter = firstParam(sp.get("filter")) as CouponFilter;
    const filter = FILTERS.includes(rawFilter) ? rawFilter : "all";
    const page = parsePage(sp.get("page"));
    const result = await listCoupons({ q: firstParam(sp.get("q")), filter, page });
    return NextResponse.json({ ...result, page, pageSize: ADMIN_PAGE_SIZE }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    return adminErrorResponse(err, "Could not load coupons.");
  }
}

/** POST /api/admin/coupons — create (SUPER_ADMIN, FINANCE_ADMIN). */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireRole(ADMIN_SECTION_ROLES.coupons);
    const parsed = couponCreateSchema.safeParse(await readJson(req));
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const coupon = await createCoupon(admin.id, parsed.data, requestAuditMeta(req));
    return NextResponse.json({ success: true, coupon }, { status: 201 });
  } catch (err) {
    return adminErrorResponse(err, "Could not create the coupon.");
  }
}
