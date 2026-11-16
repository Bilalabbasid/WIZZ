"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { formatDateTime } from "@/lib/formatters";
import { AdminAlert, AdminDialog, adminRequest } from "@/components/admin-dialog";
import {
  AdminBadge,
  AdminEmptyState,
  adminCardCls,
  adminInputCls,
  adminLabelCls,
  adminPrimaryBtn,
  adminSecondaryBtn,
  buildHref,
} from "@/components/admin-ui";

export interface AdminRiskRow {
  id: string;
  action: string;
  label: string;
  decision: string;
  message: string;
  userId: string | null;
  email: string | null;
  phoneLast4: string | null;
  orderId: string | null;
  orderNumber: string | null;
  ipAddress: string | null;
  createdAt: string;
  review: { reviewedAt: string; reviewerEmail: string | null; note: string | null } | null;
}

/** Read-only risk review queue with a single action: mark an event reviewed (optional note). */
export function AdminRiskView({ events }: { events: AdminRiskRow[] }) {
  const router = useRouter();
  const [reviewing, setReviewing] = useState<AdminRiskRow | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async () => {
    if (!reviewing) return;
    setSaving(true);
    setError(null);
    const res = await adminRequest(`/api/admin/risk/${reviewing.id}/review`, "POST", { note: note.trim() || undefined });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setNotice(`Marked “${reviewing.label}” reviewed.`);
    setReviewing(null);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {notice && (
        <AdminAlert tone="success" onDismiss={() => setNotice(null)}>
          {notice}
        </AdminAlert>
      )}

      {events.length === 0 ? (
        <AdminEmptyState title="Nothing to review" description="No risk events match these filters." />
      ) : (
        <div className={`${adminCardCls} overflow-x-auto`}>
          <table className="w-full text-left text-xs min-w-[900px]">
            <caption className="sr-only">Risk events</caption>
            <thead className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-700">
              <tr>
                <th scope="col" className="px-4 py-3">When</th>
                <th scope="col" className="px-4 py-3">Rule</th>
                <th scope="col" className="px-4 py-3">Customer</th>
                <th scope="col" className="px-4 py-3">Order</th>
                <th scope="col" className="px-4 py-3">What happened</th>
                <th scope="col" className="px-4 py-3">Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {events.map((e) => (
                <tr key={e.id} className="align-top">
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{formatDateTime(e.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className="block font-semibold text-white">{e.label}</span>
                    <span className="mt-1 inline-block">
                      <AdminBadge tone={e.decision === "BLOCKED" ? "danger" : "warning"}>
                        {e.decision === "BLOCKED" ? "Blocked" : "Flagged"}
                      </AdminBadge>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {e.email ? <span className="block break-all max-w-[220px]">{e.email}</span> : <span className="text-slate-500">Unknown email</span>}
                    {e.phoneLast4 && <span className="block text-slate-500">Phone ending {e.phoneLast4}</span>}
                    {e.userId ? (
                      <Link href={`/admin/customers/${e.userId}`} className="text-brand-300 hover:text-brand-200 font-semibold">
                        Customer account
                      </Link>
                    ) : (
                      <span className="block text-slate-500">Guest</span>
                    )}
                    {e.ipAddress && <span className="block font-mono text-[10px] text-slate-500 mt-1">IP {e.ipAddress}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {e.orderNumber ? (
                      <Link href={buildHref("/admin/orders", { q: e.orderNumber })} className="font-semibold text-brand-300 hover:text-brand-200">
                        {e.orderNumber}
                      </Link>
                    ) : (
                      <span className="text-slate-500">{e.decision === "BLOCKED" ? "Not placed" : "—"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-300 max-w-[320px]">{e.message || "—"}</td>
                  <td className="px-4 py-3">
                    {e.review ? (
                      <div>
                        <AdminBadge tone="success">Reviewed</AdminBadge>
                        <span className="block text-slate-400 mt-1">
                          {formatDateTime(e.review.reviewedAt)}
                          {e.review.reviewerEmail ? ` · ${e.review.reviewerEmail}` : ""}
                        </span>
                        {e.review.note && <span className="block text-slate-300 mt-1 max-w-[220px]">“{e.review.note}”</span>}
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={adminSecondaryBtn}
                        onClick={() => {
                          setReviewing(e);
                          setNote("");
                          setError(null);
                        }}
                      >
                        <CheckCircle2 size={13} aria-hidden="true" /> Mark reviewed
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminDialog
        open={reviewing !== null}
        onClose={() => !saving && setReviewing(null)}
        title="Mark this event reviewed?"
        description={
          reviewing
            ? `${reviewing.label}${reviewing.orderNumber ? ` · order ${reviewing.orderNumber}` : ""}. This only records your review; it does not block, unblock or refund anything.`
            : undefined
        }
      >
        <form
          className="space-y-3"
          onSubmit={(ev) => {
            ev.preventDefault();
            void submit();
          }}
        >
          <div>
            <label htmlFor="risk-review-note" className={adminLabelCls}>
              Note (optional)
            </label>
            <textarea
              id="risk-review-note"
              rows={3}
              maxLength={500}
              value={note}
              onChange={(ev) => setNote(ev.target.value)}
              className={adminInputCls}
              disabled={saving}
              placeholder="What you checked and decided"
            />
          </div>
          {error && <AdminAlert tone="error">{error}</AdminAlert>}
          <div className="flex justify-end gap-2">
            <button type="button" className={adminSecondaryBtn} onClick={() => setReviewing(null)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className={adminPrimaryBtn} disabled={saving}>
              {saving ? "Saving…" : "Mark reviewed"}
            </button>
          </div>
        </form>
      </AdminDialog>
    </div>
  );
}
