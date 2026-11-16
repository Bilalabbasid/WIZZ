import type { PayoutRequestStatus } from "@prisma/client";
import { requireAdminPage } from "@/modules/admin/access";
import { listPayoutRequests, PAYOUT_LIMITS, PAYOUT_STATUS_VALUES } from "@/modules/admin/finance";
import { ADMIN_PAGE_SIZE, firstParam, parsePage } from "@/modules/admin/http";
import { formatCurrency } from "@/lib/formatters";
import { AdminFilterBar, AdminPageHeader, AdminPagination } from "@/components/admin-ui";
import { AdminPayoutQueue } from "@/components/admin-payout-queue";

/** Finance payout queue. Same roles as refunds (super + finance admins). */
export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdminPage("refunds", "/admin/payouts");
  const sp = await searchParams;
  const q = firstParam(sp.q);
  // Default to the work queue: requests waiting for confirmation. "all" shows every status.
  const rawStatus = sp.status === undefined ? "REQUESTED" : firstParam(sp.status);
  const status = (PAYOUT_STATUS_VALUES as string[]).includes(rawStatus) ? (rawStatus as PayoutRequestStatus) : null;
  const page = parsePage(sp.page);
  const { total, requests, openCount, openMinor } = await listPayoutRequests({ status, q, page });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Finance"
        title="Seller payouts"
        description={`Payouts are manual bank transfers with two people: one finance admin requests the payout from the seller's page, a different finance admin sends the transfer and confirms it here with the bank reference. Limits: ${formatCurrency(PAYOUT_LIMITS.maxSingleMinor)} per payout, ${PAYOUT_LIMITS.maxApprovedPer24h} per seller per 24 hours, none for ${PAYOUT_LIMITS.bankChangeHoldHours} hours after a seller changes bank account.`}
      />

      <p className="text-xs text-slate-300">
        <strong className="text-white">{openCount}</strong> payout{openCount === 1 ? "" : "s"} waiting for confirmation, totalling{" "}
        <strong className="text-white">{formatCurrency(openMinor)}</strong>.
      </p>

      <AdminFilterBar
        basePath="/admin/payouts"
        q={q}
        placeholder="Seller name or bank reference"
        selectName="status"
        selectLabel="Status"
        selectValue={status ?? "all"}
        selectOptions={[
          { value: "REQUESTED", label: "Awaiting confirmation" },
          { value: "APPROVED_PAID", label: "Paid" },
          { value: "FAILED", label: "Failed / returned" },
          { value: "REJECTED", label: "Rejected" },
          { value: "all", label: "All statuses" },
        ]}
      />

      <AdminPayoutQueue
        key={`${q}:${status}:${page}`}
        currentUserId={user.id}
        requests={requests.map((r) => ({
          id: r.id,
          sellerOrgId: r.sellerOrgId,
          sellerName: r.sellerOrg.name,
          bankName: r.sellerOrg.bankName,
          amountMinor: r.amountMinor,
          status: r.status,
          requestedById: r.requestedById,
          requestedBy: r.requestedBy,
          decidedBy: r.decidedBy,
          bankReference: r.bankReference,
          bankIbanLast4: r.bankIbanLast4,
          notes: r.notes,
          decisionNote: r.decisionNote,
          requestedAt: r.requestedAt.toISOString(),
          decidedAt: r.decidedAt?.toISOString() ?? null,
        }))}
      />

      <AdminPagination basePath="/admin/payouts" page={page} pageSize={ADMIN_PAGE_SIZE} total={total} params={{ q, status: status ?? "all" }} />
    </div>
  );
}
