import type { RefundStatus } from "@prisma/client";
import { requireAdminPage } from "@/modules/admin/access";
import { listRefunds, REFUND_STATUS_VALUES } from "@/modules/admin/finance";
import { ADMIN_PAGE_SIZE, firstParam, parsePage } from "@/modules/admin/http";
import { formatCurrency } from "@/lib/formatters";
import { AdminFilterBar, AdminPageHeader, AdminPagination } from "@/components/admin-ui";
import { AdminRefundsView } from "@/components/admin-refunds-view";

export default async function AdminRefundsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage("refunds", "/admin/refunds");
  const sp = await searchParams;
  const q = firstParam(sp.q);
  // Default to the work queue: pending refunds. "all" shows every status.
  const rawStatus = sp.status === undefined ? "PENDING" : firstParam(sp.status);
  const status = (REFUND_STATUS_VALUES as string[]).includes(rawStatus) ? (rawStatus as RefundStatus) : null;
  const page = parsePage(sp.page);
  const { total, refunds, pendingCount, pendingMinor } = await listRefunds({ status, q, page });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Finance"
        title="Refunds"
        description="Refunds owed to customers, e.g. from paid orders cancelled before dispatch. Pay the customer first (bank or wallet transfer), then mark the refund done with that transfer reference."
      />

      <p className="text-xs text-slate-300">
        <strong className="text-white">{pendingCount}</strong> pending refund{pendingCount === 1 ? "" : "s"} totalling{" "}
        <strong className="text-white">{formatCurrency(pendingMinor)}</strong>.
      </p>

      <AdminFilterBar
        basePath="/admin/refunds"
        q={q}
        placeholder="Order number or transfer reference"
        selectName="status"
        selectLabel="Status"
        selectValue={status ?? "all"}
        selectOptions={[
          { value: "PENDING", label: "Pending" },
          { value: "SUCCEEDED", label: "Refunded" },
          { value: "FAILED", label: "Failed" },
          { value: "all", label: "All statuses" },
        ]}
      />

      <AdminRefundsView
        key={`${q}:${status}:${page}`}
        refunds={refunds.map((r) => ({
          id: r.id,
          amountMinor: r.amountMinor,
          status: r.status,
          reason: r.reason,
          reference: r.externalRefundRef,
          createdAt: r.createdAt.toISOString(),
          orderNumber: r.customerOrder.orderNumber,
          customerEmail: r.customerOrder.customerEmail,
          orderStatus: r.customerOrder.status,
          sellerOrderNumber: r.sellerOrderNumber,
          sellerName: r.sellerName,
        }))}
      />

      <AdminPagination basePath="/admin/refunds" page={page} pageSize={ADMIN_PAGE_SIZE} total={total} params={{ q, status: status ?? "all" }} />
    </div>
  );
}
