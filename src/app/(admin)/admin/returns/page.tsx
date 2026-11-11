import type { ReturnStatus } from "@prisma/client";
import { ADMIN_ACTION_ROLES, canAccessSection, hasAnyRole, requireAdminPage } from "@/modules/admin/access";
import { listReturnRequests, RETURN_STATUS_VALUES } from "@/modules/admin/returns";
import { ADMIN_PAGE_SIZE, firstParam, parsePage } from "@/modules/admin/http";
import { AdminFilterBar, AdminPageHeader, AdminPagination } from "@/components/admin-ui";
import { AdminReturnsView } from "@/components/admin-returns-view";

export default async function AdminReturnsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdminPage("returns", "/admin/returns");
  const sp = await searchParams;
  const q = firstParam(sp.q);
  const rawStatus = firstParam(sp.status);
  const status = (RETURN_STATUS_VALUES as string[]).includes(rawStatus) ? (rawStatus as ReturnStatus) : null;
  const page = parsePage(sp.page);
  const { total, counts, returns } = await listReturnRequests({ status, q, page });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="After-sales"
        title="Returns & Disputes"
        description="Approve or reject requests, confirm when goods arrive back (restocks inventory), then record the refund your finance team actually paid. WIZZ.PK never auto-refunds."
      />
      <AdminFilterBar
        basePath="/admin/returns"
        q={q}
        placeholder="Order number, package number or customer email"
        selectName="status"
        selectLabel="Status"
        selectValue={status ?? ""}
        selectOptions={[
          { value: "", label: "All statuses" },
          ...RETURN_STATUS_VALUES.map((s) => ({ value: s, label: `${s} (${counts[s] ?? 0})` })),
        ]}
      />
      <AdminReturnsView
        key={`${q}:${status}:${page}`}
        permissions={{
          canReview: hasAnyRole(user.role, ADMIN_ACTION_ROLES.returnReview),
          canRefund: hasAnyRole(user.role, ADMIN_ACTION_ROLES.returnRefund),
          canViewCustomers: canAccessSection(user.role, "customers"),
        }}
        returns={returns.map((r) => ({
          id: r.id,
          status: r.status,
          reasonCode: r.reasonCode,
          explanation: r.explanation,
          requestedAt: r.requestedAt.toISOString(),
          resolvedAt: r.resolvedAt?.toISOString() ?? null,
          orderId: r.sellerOrder.customerOrder.id,
          orderNumber: r.sellerOrder.customerOrder.orderNumber,
          orderPaymentStatus: r.sellerOrder.customerOrder.paymentStatus,
          sellerOrderNumber: r.sellerOrder.sellerOrderNumber,
          sellerName: r.sellerOrder.sellerOrg.name,
          customerName: r.customer ? `${r.customer.firstName} ${r.customer.lastName}` : null,
          customerEmail: r.customer?.email ?? r.sellerOrder.customerOrder.customerEmail,
          customerId: r.customer ? r.customerUserId : null,
          valueMinor: r.valueMinor,
          items: r.items.map((it) => ({
            id: it.id,
            title: it.orderItem.productTitleSnapshot,
            variant: it.orderItem.variantNameSnapshot,
            sku: it.orderItem.skuSnapshot,
            quantity: it.quantity,
            orderedQuantity: it.orderItem.quantity,
            unitPriceMinor: it.orderItem.unitPriceMinor,
            discountMinor: it.orderItem.discountMinor,
            inspectionResult: it.inspectionResult,
          })),
          refunds: r.refunds.map((f) => ({
            id: f.id,
            amountMinor: f.amountMinor,
            status: f.status,
            reason: f.reason,
            externalRefundRef: f.externalRefundRef,
            createdAt: f.createdAt.toISOString(),
          })),
        }))}
      />
      <AdminPagination basePath="/admin/returns" page={page} pageSize={ADMIN_PAGE_SIZE} total={total} params={{ q, status: status ?? undefined }} />
    </div>
  );
}
