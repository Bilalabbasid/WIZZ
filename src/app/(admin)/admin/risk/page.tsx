import { requireAdminPage } from "@/modules/admin/access";
import { ADMIN_PAGE_SIZE, firstParam, parsePage } from "@/modules/admin/http";
import { listRiskEvents, type RiskReviewFilter } from "@/modules/risk/services";
import { RISK_LIMITS, RISK_RULE_LABELS, RISK_RULE_VALUES } from "@/modules/risk/config";
import { AdminPageHeader, AdminPagination, adminInputCls, adminLabelCls, adminPrimaryBtn } from "@/components/admin-ui";
import { AdminRiskView } from "@/components/admin-risk-view";

export default async function AdminRiskPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage("orders", "/admin/risk");
  const sp = await searchParams;
  const q = firstParam(sp.q);
  const rawRule = firstParam(sp.rule);
  const rule = (RISK_RULE_VALUES as string[]).includes(rawRule) ? rawRule : "";
  const rawStatus = firstParam(sp.status);
  const status: RiskReviewFilter = rawStatus === "reviewed" || rawStatus === "all" ? rawStatus : "open";
  const page = parsePage(sp.page);

  const { total, events } = await listRiskEvents({ rule: rule || null, status, q, page, pageSize: ADMIN_PAGE_SIZE });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Orders"
        title="Risk review"
        description={`Checkouts blocked or flagged by fraud and abuse rules. Flags never freeze money or block a customer by themselves: review the customer and order, act through the normal order, return or refund screens, then mark the event reviewed. Limits: ${RISK_LIMITS.codOrdersPer24h} COD orders per phone/email per day, ${RISK_LIMITS.openCodOrdersPerPhone} open COD orders per phone, ${RISK_LIMITS.orderAttemptsPerIpPerHour} order attempts per IP per hour, guest COD off after ${RISK_LIMITS.codCustomerCancellations} customer cancellations in ${RISK_LIMITS.codCustomerCancellationWindowDays} days, review after ${RISK_LIMITS.refundedReturns} refunded returns in ${RISK_LIMITS.refundedReturnsWindowDays} days, one coupon use per customer.`}
      />

      <form method="get" action="/admin/risk" role="search" className="flex flex-col lg:flex-row gap-2 lg:items-end">
        <div className="flex-1">
          <label htmlFor="risk-q" className={adminLabelCls}>
            Search
          </label>
          <input
            id="risk-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Email, order number or ID"
            className={adminInputCls}
            maxLength={120}
          />
        </div>
        <div className="lg:w-64">
          <label htmlFor="risk-rule" className={adminLabelCls}>
            Rule
          </label>
          <select id="risk-rule" name="rule" defaultValue={rule} className={adminInputCls}>
            <option value="">All rules</option>
            {RISK_RULE_VALUES.map((r) => (
              <option key={r} value={r}>
                {RISK_RULE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <div className="lg:w-44">
          <label htmlFor="risk-status" className={adminLabelCls}>
            Review status
          </label>
          <select id="risk-status" name="status" defaultValue={status} className={adminInputCls}>
            <option value="open">Needs review</option>
            <option value="reviewed">Reviewed</option>
            <option value="all">All</option>
          </select>
        </div>
        <button type="submit" className={adminPrimaryBtn}>
          Apply
        </button>
      </form>

      <p className="text-xs text-slate-300" aria-live="polite">
        <strong className="text-white">{total.toLocaleString("en-PK")}</strong>{" "}
        {status === "open" ? "event(s) need review" : status === "reviewed" ? "reviewed event(s)" : "event(s)"}
        {rule ? ` for “${RISK_RULE_LABELS[rule as keyof typeof RISK_RULE_LABELS]}”` : ""}.
      </p>

      <AdminRiskView
        key={`${q}:${rule}:${status}:${page}`}
        events={events.map((e) => ({
          id: e.id,
          action: e.action,
          label: RISK_RULE_LABELS[e.action as keyof typeof RISK_RULE_LABELS] ?? e.action,
          decision: e.details.decision ?? "FLAGGED",
          message: e.details.message ?? "",
          userId: e.details.userId ?? null,
          email: e.details.email ?? null,
          phoneLast4: e.details.phoneLast4 ?? null,
          orderId: e.details.orderId ?? null,
          orderNumber: e.details.orderNumber ?? null,
          ipAddress: e.ipAddress,
          createdAt: e.createdAt.toISOString(),
          review: e.review
            ? { reviewedAt: e.review.reviewedAt.toISOString(), reviewerEmail: e.review.reviewerEmail, note: e.review.note }
            : null,
        }))}
      />

      <AdminPagination
        basePath="/admin/risk"
        page={page}
        pageSize={ADMIN_PAGE_SIZE}
        total={total}
        params={{ q, rule, status }}
      />
    </div>
  );
}
