"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, PackageCheck, ReceiptText, ChevronRight } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { AdminAlert, AdminDialog, adminRequest } from "@/components/admin-dialog";
import {
  AdminBadge,
  AdminEmptyState,
  adminCardCls,
  adminDangerBtn,
  adminInputCls,
  adminLabelCls,
  adminPrimaryBtn,
  adminSecondaryBtn,
  buildHref,
  type AdminTone,
} from "@/components/admin-ui";

export interface AdminReturnRow {
  id: string;
  status: "SUBMITTED" | "APPROVED" | "REJECTED" | "RECEIVED" | "REFUNDED";
  reasonCode: string;
  explanation: string;
  requestedAt: string;
  resolvedAt: string | null;
  orderId: string;
  orderNumber: string;
  orderPaymentStatus: string;
  sellerOrderNumber: string;
  sellerName: string;
  customerName: string | null;
  customerEmail: string;
  customerId: string | null;
  valueMinor: number;
  items: Array<{
    id: string;
    title: string;
    variant: string;
    sku: string;
    quantity: number;
    orderedQuantity: number;
    unitPriceMinor: number;
    discountMinor: number;
    inspectionResult: string | null;
  }>;
  refunds: Array<{
    id: string;
    amountMinor: number;
    status: string;
    reason: string | null;
    externalRefundRef: string | null;
    createdAt: string;
  }>;
}

type ResolveAction = "APPROVE" | "REJECT" | "MARK_RECEIVED" | "RECORD_REFUND";

const STATUS_TONE: Record<AdminReturnRow["status"], AdminTone> = {
  SUBMITTED: "warning",
  APPROVED: "info",
  RECEIVED: "accent",
  REJECTED: "danger",
  REFUNDED: "success",
};

const ACTION_COPY: Record<ResolveAction, { title: string; body: string; button: string; danger?: boolean }> = {
  APPROVE: {
    title: "Approve return",
    body: "The customer will be asked to send the items back. No stock or money moves yet.",
    button: "Approve return",
  },
  REJECT: {
    title: "Reject return",
    body: "The request is closed without a refund. Explain the decision in the note.",
    button: "Reject return",
    danger: true,
  },
  MARK_RECEIVED: {
    title: "Mark items received",
    body: "Confirms the returned goods have arrived. This restocks the returned quantities into inventory.",
    button: "Mark received & restock",
  },
  RECORD_REFUND: {
    title: "Record refund paid",
    body: "Record the refund the finance team has ALREADY paid (bank transfer or courier reversal). This does not send money.",
    button: "Record refund",
  },
};

function lineValue(it: AdminReturnRow["items"][number]) {
  const share = it.orderedQuantity > 0 ? Math.round((it.discountMinor * it.quantity) / it.orderedQuantity) : 0;
  return it.unitPriceMinor * it.quantity - share;
}

export function AdminReturnsView({
  returns,
  permissions,
}: {
  returns: AdminReturnRow[];
  permissions: { canReview: boolean; canRefund: boolean; canViewCustomers: boolean };
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState<ResolveAction | null>(null);
  const [note, setNote] = useState("");
  const [refundReference, setRefundReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selected = returns.find((r) => r.id === selectedId) ?? null;

  const availableActions = (r: AdminReturnRow): Array<{ action: ResolveAction; allowed: boolean; why?: string }> => {
    if (r.status === "SUBMITTED")
      return [
        { action: "APPROVE", allowed: permissions.canReview, why: "Super admin or support only." },
        { action: "REJECT", allowed: permissions.canReview, why: "Super admin or support only." },
      ];
    if (r.status === "APPROVED") return [{ action: "MARK_RECEIVED", allowed: permissions.canReview, why: "Super admin or support only." }];
    if (r.status === "RECEIVED") return [{ action: "RECORD_REFUND", allowed: permissions.canRefund, why: "Super admin or finance admin only." }];
    return [];
  };

  const startAction = (a: ResolveAction) => {
    setPending(a);
    setNote("");
    setRefundReference("");
    setError(null);
  };

  const submit = async () => {
    if (!selected || !pending) return;
    if (pending === "REJECT" && note.trim().length < 3) {
      setError("Add a short note explaining the rejection.");
      return;
    }
    if (pending === "RECORD_REFUND" && refundReference.trim().length < 3) {
      setError("Enter the bank transfer or courier reversal reference used to pay the refund.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await adminRequest(`/api/admin/returns/${selected.id}/resolve`, "POST", {
      action: pending,
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(pending === "RECORD_REFUND" ? { refundReference: refundReference.trim() } : {}),
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setNotice(`${ACTION_COPY[pending].title} — done for ${selected.sellerOrderNumber}.`);
    setPending(null);
    setSelectedId(null);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {notice && (
        <AdminAlert tone="success" onDismiss={() => setNotice(null)}>
          {notice}
        </AdminAlert>
      )}

      {returns.length === 0 ? (
        <AdminEmptyState title="No return requests match" description="Change the status filter or search." />
      ) : (
        <div className={`${adminCardCls} overflow-x-auto`}>
          <table className="w-full text-left text-xs min-w-[900px]">
            <caption className="sr-only">Return requests</caption>
            <thead className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-700">
              <tr>
                <th scope="col" className="px-4 py-3">Order / package</th>
                <th scope="col" className="px-4 py-3">Seller</th>
                <th scope="col" className="px-4 py-3">Customer</th>
                <th scope="col" className="px-4 py-3">Items</th>
                <th scope="col" className="px-4 py-3">Reason</th>
                <th scope="col" className="px-4 py-3 text-right">Refund value</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {returns.map((r) => (
                <tr key={r.id} className="hover:bg-slate-800">
                  <td className="px-4 py-3">
                    <span className="font-semibold text-white">{r.orderNumber}</span>
                    <span className="block font-mono text-[10px] text-slate-400">{r.sellerOrderNumber}</span>
                    <span className="block text-[10px] text-slate-500">{formatDateTime(r.requestedAt)}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{r.sellerName}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {r.customerName && <span className="block text-slate-200">{r.customerName}</span>}
                    <span className="block truncate max-w-[180px]">{r.customerEmail}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {r.items.map((it) => (
                      <span key={it.id} className="block truncate max-w-[200px]">
                        {it.quantity}× {it.title}
                      </span>
                    ))}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    <span className="font-semibold">{r.reasonCode.replace(/_/g, " ")}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-white tabular-nums">{formatCurrency(r.valueMinor)}</td>
                  <td className="px-4 py-3"><AdminBadge tone={STATUS_TONE[r.status]}>{r.status}</AdminBadge></td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className={adminSecondaryBtn}
                      onClick={() => {
                        setSelectedId(r.id);
                        setPending(null);
                        setError(null);
                      }}
                      aria-label={`Open return for ${r.sellerOrderNumber}`}
                    >
                      Details <ChevronRight size={13} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminDialog
        open={selected !== null}
        onClose={() => !saving && setSelectedId(null)}
        title={selected ? `Return · ${selected.sellerOrderNumber}` : ""}
        description={selected ? `Order ${selected.orderNumber} · ${selected.sellerName} · requested ${formatDateTime(selected.requestedAt)}` : undefined}
        wide
      >
        {selected && (
          <div className="space-y-4 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <AdminBadge tone={STATUS_TONE[selected.status]}>{selected.status}</AdminBadge>
              <span className="text-slate-400">Order payment: {selected.orderPaymentStatus}</span>
              {selected.resolvedAt && <span className="text-slate-400">· last decision {formatDateTime(selected.resolvedAt)}</span>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <p className="text-[10px] uppercase font-bold text-slate-500">Customer</p>
                <p className="text-slate-200 mt-1">{selected.customerName ?? "—"}</p>
                <p className="text-slate-400 break-all">{selected.customerEmail}</p>
                {selected.customerId && permissions.canViewCustomers && (
                  <Link href={`/admin/customers/${selected.customerId}`} className="text-brand-300 hover:text-brand-200 font-semibold">
                    View customer
                  </Link>
                )}
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <p className="text-[10px] uppercase font-bold text-slate-500">Reason</p>
                <p className="text-slate-200 mt-1 font-semibold">{selected.reasonCode.replace(/_/g, " ")}</p>
                <p className="text-slate-300 whitespace-pre-wrap">{selected.explanation || "No explanation given."}</p>
                <Link href={buildHref("/admin/orders", { q: selected.orderNumber })} className="text-brand-300 hover:text-brand-200 font-semibold">
                  Open order
                </Link>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 overflow-x-auto">
              <table className="w-full text-left min-w-[480px]">
                <caption className="sr-only">Returned items</caption>
                <thead className="text-[10px] uppercase font-bold text-slate-500 border-b border-slate-800">
                  <tr>
                    <th scope="col" className="px-3 py-2">Item</th>
                    <th scope="col" className="px-3 py-2 text-right">Qty returned</th>
                    <th scope="col" className="px-3 py-2 text-right">Refund value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {selected.items.map((it) => (
                    <tr key={it.id}>
                      <td className="px-3 py-2">
                        <span className="text-slate-200">{it.title}</span>
                        <span className="block text-[10px] text-slate-500">
                          {it.variant} · {it.sku} · {formatCurrency(it.unitPriceMinor)} each, {it.orderedQuantity} ordered
                        </span>
                        {it.inspectionResult && <span className="block text-[10px] text-slate-400">Inspection: {it.inspectionResult}</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-200">{it.quantity}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-white font-semibold">{formatCurrency(lineValue(it))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-800">
                    <td className="px-3 py-2 font-bold text-slate-300" colSpan={2}>Total (line price × qty minus discount share)</td>
                    <td className="px-3 py-2 text-right font-black text-white tabular-nums">{formatCurrency(selected.valueMinor)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {selected.refunds.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-slate-500">Refund records for this package</p>
                {selected.refunds.map((f) => (
                  <p key={f.id} className="flex flex-wrap items-center gap-2 text-slate-300">
                    <ReceiptText size={12} className="text-slate-500" aria-hidden="true" />
                    {formatCurrency(f.amountMinor)}
                    <AdminBadge tone={f.status === "SUCCEEDED" ? "success" : f.status === "FAILED" ? "danger" : "warning"}>{f.status}</AdminBadge>
                    {f.externalRefundRef && <span className="font-mono text-[10px]">ref {f.externalRefundRef}</span>}
                    <span className="text-slate-500">{formatDateTime(f.createdAt)}</span>
                  </p>
                ))}
              </div>
            )}

            {pending ? (
              <form
                className="space-y-3 p-4 rounded-xl border border-brand-500/40 bg-slate-950"
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit();
                }}
              >
                <p className="font-bold text-white">{ACTION_COPY[pending].title}</p>
                <p className="text-slate-300">{ACTION_COPY[pending].body}</p>
                {pending === "RECORD_REFUND" && (
                  <>
                    <p className="text-slate-200">
                      Amount to be recorded (computed by the server): <strong className="text-white">{formatCurrency(selected.valueMinor)}</strong>
                    </p>
                    <div>
                      <label htmlFor="refund-ref" className={adminLabelCls}>Refund payment reference (required)</label>
                      <input
                        id="refund-ref"
                        required
                        minLength={3}
                        maxLength={120}
                        value={refundReference}
                        onChange={(e) => setRefundReference(e.target.value)}
                        className={`${adminInputCls} font-mono`}
                        disabled={saving}
                      />
                    </div>
                  </>
                )}
                <div>
                  <label htmlFor="resolve-note" className={adminLabelCls}>
                    Note {pending === "REJECT" ? "(required)" : "(optional)"}
                  </label>
                  <textarea id="resolve-note" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} className={adminInputCls} disabled={saving} />
                </div>
                {error && <AdminAlert tone="error">{error}</AdminAlert>}
                <div className="flex justify-end gap-2">
                  <button type="button" className={adminSecondaryBtn} onClick={() => setPending(null)} disabled={saving}>
                    Back
                  </button>
                  <button type="submit" className={ACTION_COPY[pending].danger ? adminDangerBtn : adminPrimaryBtn} disabled={saving}>
                    {saving ? "Saving…" : ACTION_COPY[pending].button}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                {availableActions(selected).length === 0 && <p className="text-slate-400">This return is closed ({selected.status}). No further actions.</p>}
                {availableActions(selected).map(({ action, allowed, why }) => {
                  const Icon = action === "APPROVE" ? CheckCircle2 : action === "REJECT" ? XCircle : action === "MARK_RECEIVED" ? PackageCheck : ReceiptText;
                  return (
                    <div key={action} className="flex flex-col gap-1">
                      <button
                        type="button"
                        className={action === "REJECT" ? adminDangerBtn : adminPrimaryBtn}
                        onClick={() => startAction(action)}
                        disabled={!allowed}
                        aria-describedby={!allowed ? `why-${action}` : undefined}
                      >
                        <Icon size={13} aria-hidden="true" /> {ACTION_COPY[action].button}
                      </button>
                      {!allowed && (
                        <span id={`why-${action}`} className="text-[10px] text-slate-500">
                          {why}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </AdminDialog>
    </div>
  );
}
