import { requireAdminPage } from "@/modules/admin/access";
import { listCoupons, type CouponFilter } from "@/modules/admin/coupons";
import { ADMIN_PAGE_SIZE, firstParam, parsePage } from "@/modules/admin/http";
import { AdminFilterBar, AdminPageHeader, AdminPagination } from "@/components/admin-ui";
import { AdminCouponsManager } from "@/components/admin-coupons-manager";

const FILTERS: Array<{ value: CouponFilter; label: string }> = [
  { value: "all", label: "All coupons" },
  { value: "active", label: "Live now" },
  { value: "scheduled", label: "Scheduled" },
  { value: "expired", label: "Expired" },
  { value: "inactive", label: "Deactivated" },
];

export default async function AdminCouponsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage("coupons", "/admin/coupons");
  const sp = await searchParams;
  const q = firstParam(sp.q);
  const rawFilter = firstParam(sp.filter) as CouponFilter;
  const filter = FILTERS.some((f) => f.value === rawFilter) ? rawFilter : "all";
  const page = parsePage(sp.page);
  const { total, coupons } = await listCoupons({ q, filter, page });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Promotions"
        title="Coupons"
        description="Codes customers enter at checkout. Checkout re-validates every rule on the server (dates, usage limit, minimum order). Codes cannot be renamed once created."
      />
      <AdminFilterBar
        basePath="/admin/coupons"
        q={q}
        placeholder="Coupon code"
        selectName="filter"
        selectLabel="Show"
        selectValue={filter}
        selectOptions={FILTERS}
      />
      <AdminCouponsManager
        key={`${q}:${filter}:${page}`}
        nowIso={new Date().toISOString()}
        coupons={coupons.map((c) => ({
          id: c.id,
          code: c.code,
          description: c.description,
          discountType: c.discountType,
          discountValueMinor: c.discountValueMinor,
          minOrderAmountMinor: c.minOrderAmountMinor,
          maxDiscountMinor: c.maxDiscountMinor,
          usageLimit: c.usageLimit,
          timesUsed: c.timesUsed,
          startsAt: c.startsAt?.toISOString() ?? null,
          expiresAt: c.expiresAt?.toISOString() ?? null,
          isActive: c.isActive,
        }))}
      />
      <AdminPagination basePath="/admin/coupons" page={page} pageSize={ADMIN_PAGE_SIZE} total={total} params={{ q, filter }} />
    </div>
  );
}
