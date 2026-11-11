import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileCheck2 } from "lucide-react";
import { ADMIN_ACTION_ROLES, canAccessSection, hasAnyRole, requireAdminPage } from "@/modules/admin/access";
import { getSellerDetail } from "@/modules/admin/sellers";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/formatters";
import { AdminBadge, AdminEmptyState, adminCardCls, sellerStatusTone } from "@/components/admin-ui";
import { AdminSellerCommissionForm, AdminSellerStatusActions } from "@/components/admin-seller-actions";
import { AdminSellerPayouts } from "@/components/admin-seller-payouts";
import { getSellerPayoutSummary } from "@/modules/admin/finance";

export default async function AdminSellerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAdminPage("sellers", `/admin/sellers/${id}`);
  const seller = await getSellerDetail(id);
  if (!seller) notFound();

  const canChangeStatus = hasAnyRole(user.role, ADMIN_ACTION_ROLES.sellerStatus);
  const canEditCommission = hasAnyRole(user.role, ADMIN_ACTION_ROLES.sellerCommission);
  const canSeeAudit = canAccessSection(user.role, "auditLogs");
  // Bank details and settlement balances are finance data: super and finance admins only.
  const canManagePayouts = hasAnyRole(user.role, ADMIN_ACTION_ROLES.sellerPayouts);
  const payouts = canManagePayouts ? await getSellerPayoutSummary(seller.id) : null;

  return (
    <div className="space-y-6">
      <Link href="/admin/sellers" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-400 hover:text-brand-300">
        <ArrowLeft size={14} aria-hidden="true" /> All sellers
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">Seller organisation</span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1 flex flex-wrap items-center gap-2">
            {seller.name}
            {seller.isFirstParty && <AdminBadge tone="accent">First-party</AdminBadge>}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {seller.legalName} · /{seller.slug} · joined {formatDate(seller.createdAt)}
          </p>
        </div>
        <AdminBadge tone={sellerStatusTone(seller.operationalStatus)}>{seller.operationalStatus}</AdminBadge>
      </div>

      {seller.operationalStatus === "SUSPENDED" && seller.suspensionReason && (
        <div className="p-4 rounded-xl border border-rose-500/40 bg-rose-950/50 text-rose-200 text-sm">
          <strong>Suspension reason:</strong> {seller.suspensionReason}
        </div>
      )}

      <dl className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          ["Products", seller._count.products.toLocaleString("en-PK")],
          ["Published", seller.publishedProducts.toLocaleString("en-PK")],
          ["Pending moderation", seller.pendingModeration.toLocaleString("en-PK")],
          ["Seller orders", seller._count.sellerOrders.toLocaleString("en-PK")],
          ["GMV (excl. cancelled/unpaid)", formatCurrency(seller.gmvMinor)],
        ].map(([label, value]) => (
          <div key={label} className={`${adminCardCls} p-4`}>
            <dt className="text-[11px] font-semibold text-slate-400">{label}</dt>
            <dd className="text-lg font-black text-white tabular-nums mt-1">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section aria-labelledby="status-h" className={`${adminCardCls} p-5 space-y-3`}>
          <h2 id="status-h" className="font-bold text-sm text-white">Operational status</h2>
          <AdminSellerStatusActions
            sellerId={seller.id}
            sellerName={seller.name}
            status={seller.operationalStatus}
            isFirstParty={seller.isFirstParty}
            canChange={canChangeStatus}
          />
        </section>

        <section aria-labelledby="commission-h" className={`${adminCardCls} p-5 space-y-3`}>
          <h2 id="commission-h" className="font-bold text-sm text-white">Commission</h2>
          <AdminSellerCommissionForm sellerId={seller.id} currentRate={seller.commissionRatePercent} canEdit={canEditCommission} />
        </section>

        <section aria-labelledby="contact-h" className={`${adminCardCls} p-5 space-y-2 text-xs`}>
          <h2 id="contact-h" className="font-bold text-sm text-white">Business & contact</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            <dt className="text-slate-400">Contact email</dt><dd className="text-slate-200 break-all">{seller.contactEmail}</dd>
            <dt className="text-slate-400">Contact phone</dt><dd className="text-slate-200">{seller.contactPhone || "—"}</dd>
            <dt className="text-slate-400">Business type</dt><dd className="text-slate-200">{seller.businessType || "—"}</dd>
            <dt className="text-slate-400">Tax ID / NTN</dt><dd className="text-slate-200">{seller.taxId || "—"}</dd>
            <dt className="text-slate-400">Address</dt><dd className="text-slate-200">{[seller.addressLine, seller.city].filter(Boolean).join(", ") || "—"}</dd>
          </dl>
          <div className="pt-2">
            {seller.application ? (
              <Link href="/admin/applications" className="inline-flex items-center gap-1.5 text-brand-300 hover:text-brand-200 font-semibold">
                <FileCheck2 size={14} aria-hidden="true" />
                KYC application ({seller.application.status}{seller.application.reviewedAt ? `, reviewed ${formatDate(seller.application.reviewedAt)}` : ""})
              </Link>
            ) : (
              <span className="text-slate-500">No linked KYC application{seller.isFirstParty ? " (first-party store)" : ""}.</span>
            )}
          </div>
        </section>

        <section aria-labelledby="members-h" className={`${adminCardCls} p-5 space-y-3`}>
          <h2 id="members-h" className="font-bold text-sm text-white">Members ({seller.memberships.length})</h2>
          {seller.memberships.length === 0 ? (
            <AdminEmptyState title="No members" />
          ) : (
            <ul className="divide-y divide-slate-700/60 text-xs">
              {seller.memberships.map((m) => (
                <li key={m.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{m.user.firstName} {m.user.lastName}</p>
                    <p className="text-slate-400 truncate">{m.user.email}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <AdminBadge tone="accent">{m.role.replace(/_/g, " ")}</AdminBadge>
                    {!m.isActive && <AdminBadge tone="neutral">Inactive</AdminBadge>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {payouts && (
        <AdminSellerPayouts
          sellerId={seller.id}
          isFirstParty={seller.isFirstParty}
          summary={{
            ...payouts,
            entries: payouts.entries.map((e) => ({
              id: e.id,
              entryType: e.entryType,
              amountMinor: e.amountMinor,
              status: e.status,
              description: e.description,
              referenceId: e.referenceId,
              holdReason: e.holdReason,
              createdAt: e.createdAt.toISOString(),
              sellerOrderNumber: e.sellerOrder?.sellerOrderNumber ?? null,
              isReversed: e.isReversed,
            })),
          }}
        />
      )}

      {canSeeAudit && (
        <section aria-labelledby="audit-h" className={`${adminCardCls} p-5 space-y-3`}>
          <h2 id="audit-h" className="font-bold text-sm text-white">Recent admin actions</h2>
          {seller.recentAudit.length === 0 ? (
            <p className="text-xs text-slate-400">No recorded admin actions for this seller.</p>
          ) : (
            <ul className="divide-y divide-slate-700/60 text-xs">
              {seller.recentAudit.map((a) => (
                <li key={a.id} className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="font-mono text-[11px] text-slate-200">{a.action}</span>
                  <span className="text-slate-400 font-mono text-[11px] truncate sm:max-w-md">{a.detailsJson}</span>
                  <span className="text-slate-500 whitespace-nowrap">{a.actorUser?.email ?? "system"} · {formatDateTime(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
