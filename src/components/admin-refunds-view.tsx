"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { AdminAlert, AdminDialog, adminRequest } from "@/components/admin-dialog";
import { AdminBadge, AdminEmptyState, adminCardCls, adminInputCls, adminLabelCls, adminPrimaryBtn, adminSecondaryBtn, buildHref } from "@/components/admin-ui";

export interface AdminRefundRow {
  id: string;
  amountMinor: number;
  status: string;
  reason: string | null;
  reference: string | null;
  createdAt: string;
  orderNumber: string;
  customerEmail: string;
  orderStatus: string;
  sellerOrderNumber: string | null;
  sellerName: string | null;
}

export function AdminRefundsView({ refunds }: { refunds: AdminRefundRow[] }) {
  const router = useRouter();
  const [completing, setCompleting] = useState<AdminRefundRow | null>(null);
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async () => {
    if (!completing) return;
    const ref = reference.trim();
    if (ref.length < 3 || ref.length > 120) {
      setError("Enter the transfer reference (3–120 characters).");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await adminRequest(`/api/admin/refunds/${completing.id}/complete`, "POST", { reference: ref });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setNotice(`Refund of ${formatCurrency(completing.amountMinor)} for ${completing.orderNumber} marked refunded (ref ${ref}).`);
    setCompleting(null);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {notice && (
        <AdminAlert tone="success" onDismiss={() => setNotice(null)}>
          {notice}
        </AdminAlert>
      )}

      {refunds.length === 0 ? (
        <AdminEmptyState title="No refunds match" description="Change the status filter or search." />
      ) : (
        <div className={`${adminCardCls} overflow-x-auto`}>
          <table className="w-full text-left text-xs min-w-[860px]">
            <caption className="sr-only">Refunds</caption>
            <thead className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-700">
              <tr>
                <th scope="col" className="px-4 py-3">Order</th>
                <th scope="col" className="px-4 py-3">Package</th>
                <th scope="col" className="px-4 py-3 text-right">Amount</th>
                <th scope="col" className="px-4 py-3">Reason</th>
                <th scope="col" className="px-4 py-3">Created</th>
                <th scope="col" className="px-4 py-3">Status / reference</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {refunds.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    <Link href={buildHref("/admin/orders", { q: r.orderNumber })} className="font-semibold text-brand-300 hover:text-brand-200">
                      {r.orderNumber}
                    </Link>
                    <span className="block text-slate-400 truncate max-w-[200px]">{r.customerEmail}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {r.sellerOrderNumber ? (
                      <>
                        <span className="font-mono text-[11px]">{r.sellerOrderNumber}</span>
                        {r.sellerName && <span className="block text-slate-500">{r.sellerName}</span>}
                      </>
                    ) : (
                      "Whole order"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-white tabular-nums">{formatCurrency(r.amountMinor)}</td>
                  <td className="px-4 py-3 text-slate-300 max-w-[220px]">{r.reason || "—"}</td>
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    <AdminBadge tone={r.status === "SUCCEEDED" ? "success" : r.status === "FAILED" ? "danger" : "warning"}>
                      {r.status === "SUCCEEDED" ? "Refunded" : r.status}
                    </AdminBadge>
                    {r.reference && <span className="block font-mono text-[10px] text-slate-400 mt-1 break-all">{r.reference}</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.status === "PENDING" && (
                      <button
                        type="button"
                        className={adminPrimaryBtn}
                        onClick={() => {
                          setCompleting(r);
                          setReference("");
                          setError(null);
                        }}
                      >
                        <CheckCircle2 size={13} aria-hidden="true" /> Mark refunded
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
        open={completing !== null}
        onClose={() => !saving && setCompleting(null)}
        title={`Mark ${completing ? formatCurrency(completing.amountMinor) : ""} refunded?`}
        description={
          completing
            ? `Order ${completing.orderNumber} · ${completing.customerEmail}. Only confirm after the money has been sent to the customer. This does not send money.`
            : undefined
        }
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div>
            <label htmlFor="refund-complete-ref" className={adminLabelCls}>Transfer reference (required)</label>
            <input
              id="refund-complete-ref"
              required
              minLength={3}
              maxLength={120}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className={`${adminInputCls} font-mono`}
              disabled={saving}
            />
          </div>
          {error && <AdminAlert tone="error">{error}</AdminAlert>}
          <div className="flex justify-end gap-2">
            <button type="button" className={adminSecondaryBtn} onClick={() => setCompleting(null)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className={adminPrimaryBtn} disabled={saving}>
              {saving ? "Saving…" : "Mark refunded"}
            </button>
          </div>
        </form>
      </AdminDialog>
    </div>
  );
}
