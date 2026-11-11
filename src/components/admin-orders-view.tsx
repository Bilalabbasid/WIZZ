"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { Truck, Package, Banknote, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { AdminAlert, AdminDialog, adminRequest } from "@/components/admin-dialog";
import {
  AdminBadge,
  adminDangerBtn,
  adminInputCls,
  adminLabelCls,
  adminPrimaryBtn,
  adminSecondaryBtn,
  type AdminTone,
} from "@/components/admin-ui";

export interface AdminOrderItem {
  id: string;
  orderNumber: string;
  customerEmail: string;
  customerPhone?: string | null;
  status: string;
  paymentStatus: string;
  totalMinor: number;
  notes?: string | null;
  createdAt: Date | string;
  paymentAttempts?: Array<{ provider: string }>;
  sellerOrders: Array<{
    id: string;
    sellerOrderNumber: string;
    sellerOrg: { name: string };
    status: string;
    items: Array<{
      id: string;
      productTitleSnapshot: string;
      variantNameSnapshot: string;
      quantity: number;
      unitPriceMinor: number;
    }>;
    shipments: Array<{
      id: string;
      carrierName: string;
      trackingNumber: string;
      trackingUrl?: string | null;
      status: string;
    }>;
  }>;
}

export interface AdminOrdersPermissions {
  canFulfil: boolean; // SUPER_ADMIN, SUPPORT: dispatch / mark delivered / cancel package
  canReconcileCod: boolean; // SUPER_ADMIN, FINANCE_ADMIN
}

const PAKISTAN_CARRIERS = [
  "TCS Express",
  "Leopards Courier",
  "M&P Logistics",
  "Trax Logistics",
  "PostEx",
  "Call Courier",
  "Pakistan Post (EMS)",
];

const TRACKING_RE = /^[A-Za-z0-9-]{4,40}$/;

function packageTone(status: string): AdminTone {
  if (status === "DELIVERED") return "success";
  if (status === "CANCELLED") return "danger";
  if (status === "DISPATCHED") return "info";
  if (status === "PENDING_PAYMENT") return "warning";
  return "accent";
}

function orderTone(status: string): AdminTone {
  if (status === "DELIVERED") return "success";
  if (status === "CANCELLED" || status === "REFUNDED") return "danger";
  if (status === "PENDING_PAYMENT") return "warning";
  if (status === "SHIPPED" || status === "PARTIALLY_SHIPPED") return "info";
  return "accent";
}

function isCodOrder(o: AdminOrderItem) {
  if (o.paymentAttempts?.some((p) => p.provider === "COD")) return true;
  try {
    const parsed = o.notes ? (JSON.parse(o.notes) as Record<string, unknown>) : {};
    return parsed.paymentMethod === "CASH_ON_DELIVERY";
  } catch {
    return false;
  }
}

type PackageAction =
  | { kind: "dispatch"; orderId: string; sellerOrderId: string; label: string }
  | { kind: "deliver"; orderId: string; sellerOrderId: string; label: string }
  | { kind: "cancel"; orderId: string; sellerOrderId: string; label: string; paid: boolean }
  | { kind: "cod"; orderId: string; label: string };

/**
 * Order operations. Parent order status is derived on the server from package statuses,
 * so there is intentionally no control to edit it directly. Only actions valid for a
 * package's current status (and the viewer's role) are shown; the API re-validates both.
 */
export function AdminOrdersView({ orders, permissions }: { orders: AdminOrderItem[]; permissions: AdminOrdersPermissions }) {
  const router = useRouter();
  const [action, setAction] = useState<PackageAction | null>(null);
  const [carrierName, setCarrierName] = useState(PAKISTAN_CARRIERS[0]);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [reason, setReason] = useState("");
  const [remittanceRef, setRemittanceRef] = useState("");
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const open = (a: PackageAction) => {
    setAction(a);
    setDialogError(null);
    setTrackingNumber("");
    setTrackingUrl("");
    setReason("");
    setRemittanceRef("");
  };

  const validate = (): string | null => {
    if (!action) return null;
    if (action.kind === "dispatch") {
      if (!TRACKING_RE.test(trackingNumber.trim())) return "Tracking number must be 4–40 characters: letters, digits or hyphens.";
      if (trackingUrl.trim() && !trackingUrl.trim().startsWith("https://")) return "Tracking URL must start with https://";
    }
    if (action.kind === "cancel" && reason.trim().length < 3) return "Enter a cancellation reason (at least 3 characters).";
    if (action.kind === "cod" && !remittanceRef.trim()) return "Enter the courier remittance reference.";
    return null;
  };

  const submit = async () => {
    if (!action) return;
    const invalid = validate();
    if (invalid) {
      setDialogError(invalid);
      return;
    }
    setSaving(true);
    setDialogError(null);
    let res;
    let success = "";
    if (action.kind === "dispatch") {
      res = await adminRequest(`/api/admin/orders/${action.orderId}/shipment`, "POST", {
        sellerOrderId: action.sellerOrderId,
        carrierName,
        trackingNumber: trackingNumber.trim(),
        trackingUrl: trackingUrl.trim() || undefined,
      });
      success = `Package ${action.label} dispatched via ${carrierName}.`;
    } else if (action.kind === "deliver") {
      res = await adminRequest(`/api/admin/orders/${action.orderId}/packages/${action.sellerOrderId}`, "POST", { action: "MARK_DELIVERED" });
      success = `Package ${action.label} marked delivered.`;
    } else if (action.kind === "cancel") {
      res = await adminRequest(`/api/admin/orders/${action.orderId}/packages/${action.sellerOrderId}`, "POST", {
        action: "CANCEL",
        reason: reason.trim(),
      });
      success = action.paid
        ? `Package ${action.label} cancelled. A pending refund was recorded and must be paid out manually.`
        : `Package ${action.label} cancelled and stock released.`;
    } else {
      res = await adminRequest(`/api/admin/orders/${action.orderId}/cod-reconcile`, "POST", { remittanceRef: remittanceRef.trim() });
      success = `COD remittance recorded for ${action.label}.`;
    }
    setSaving(false);
    if (!res.ok) {
      setDialogError(res.error);
      return;
    }
    setAction(null);
    setNotice(success);
    router.refresh();
  };

  const dialogTitle =
    action?.kind === "dispatch"
      ? `Dispatch package ${action.label}`
      : action?.kind === "deliver"
        ? `Mark package ${action.label} delivered?`
        : action?.kind === "cancel"
          ? `Cancel package ${action.label}?`
          : action?.kind === "cod"
            ? `Reconcile COD remittance for ${action.label}`
            : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold text-sm text-slate-300">Orders on this page ({orders.length})</h2>
        <span className="text-xs text-slate-400">Order status updates automatically from its packages.</span>
      </div>

      {notice && (
        <AdminAlert tone="success" onDismiss={() => setNotice(null)}>
          {notice}
        </AdminAlert>
      )}

      <div className="space-y-4">
        {orders.map((o) => {
          const isCod = isCodOrder(o);
          const paid = o.paymentStatus === "PAID";
          const activePackages = o.sellerOrders.filter((so) => so.status !== "CANCELLED");
          const codReady =
            activePackages.length > 0 && activePackages.every((so) => so.status === "DISPATCHED" || so.status === "DELIVERED");
          return (
            <article key={o.id} className="bg-slate-800/80 rounded-2xl border border-slate-700/80 p-4 sm:p-6 space-y-5" aria-label={`Order ${o.orderNumber}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-700">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-white text-base">{o.orderNumber}</span>
                    {isCod && (
                      <AdminBadge tone="warning">
                        <Banknote size={11} aria-hidden="true" /> Cash on delivery
                      </AdminBadge>
                    )}
                  </div>
                  <p className="text-slate-400 text-xs mt-0.5 break-all">
                    {o.customerEmail}
                    {o.customerPhone ? ` · ${o.customerPhone}` : ""} · {formatDateTime(o.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <AdminBadge tone={paid ? "success" : o.paymentStatus === "REFUNDED" ? "neutral" : "warning"}>Payment: {o.paymentStatus}</AdminBadge>
                  <AdminBadge tone={orderTone(o.status)}>{o.status.replace(/_/g, " ")}</AdminBadge>
                  <span className="font-black text-white text-sm tabular-nums">{formatCurrency(o.totalMinor)}</span>
                </div>
              </div>

              {isCod && !paid && o.status !== "CANCELLED" && (
                <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="text-amber-200">
                    <p className="font-bold flex items-center gap-1.5">
                      <Banknote size={14} className="text-amber-400" aria-hidden="true" />
                      COD cash not yet remitted
                    </p>
                    <p className="text-[11px] text-amber-300/80 mt-0.5">
                      {codReady
                        ? "All active packages are dispatched or delivered. Reconcile once the courier remits the cash."
                        : "Reconciliation becomes available once every active package is dispatched or delivered."}
                    </p>
                  </div>
                  {permissions.canReconcileCod ? (
                    <button
                      type="button"
                      className={adminPrimaryBtn}
                      disabled={!codReady}
                      onClick={() => open({ kind: "cod", orderId: o.id, label: o.orderNumber })}
                    >
                      Reconcile COD remittance
                    </button>
                  ) : (
                    <span className="text-[11px] text-amber-300/80">Finance or super admin records remittances.</span>
                  )}
                </div>
              )}

              <div className="space-y-3">
                {o.sellerOrders.map((so) => {
                  const shipment = so.shipments[0];
                  const canDispatch = so.status === "CONFIRMED" || so.status === "PACKING";
                  const canDeliver = so.status === "DISPATCHED";
                  const canCancel = so.status === "PENDING_PAYMENT" || so.status === "CONFIRMED" || so.status === "PACKING";
                  return (
                    <div key={so.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-white flex items-center gap-1.5 min-w-0">
                          <Package size={14} className="text-emerald-400 shrink-0" aria-hidden="true" />
                          <span className="truncate">{so.sellerOrg.name}</span>
                          <span className="font-mono text-slate-400 font-normal">{so.sellerOrderNumber}</span>
                        </span>
                        <AdminBadge tone={packageTone(so.status)}>{so.status.replace(/_/g, " ")}</AdminBadge>
                      </div>

                      <ul className="space-y-1 text-slate-300 pl-5">
                        {so.items.map((item) => (
                          <li key={item.id}>
                            {item.quantity}× {item.productTitleSnapshot} ({item.variantNameSnapshot}) —{" "}
                            <strong className="text-white">{formatCurrency(item.unitPriceMinor * item.quantity)}</strong>
                          </li>
                        ))}
                      </ul>

                      <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        {shipment ? (
                          <span className="flex flex-wrap items-center gap-1.5 text-emerald-300 font-semibold">
                            <Truck size={14} aria-hidden="true" />
                            {shipment.carrierName} · <span className="font-mono">{shipment.trackingNumber}</span>
                            {shipment.trackingUrl && (
                              <a href={shipment.trackingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-brand-300 hover:text-brand-200">
                                Track <ExternalLink size={11} aria-hidden="true" />
                              </a>
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">
                            {so.status === "CANCELLED" ? "Package cancelled" : so.status === "PENDING_PAYMENT" ? "Awaiting payment before dispatch" : "No waybill yet"}
                          </span>
                        )}

                        {permissions.canFulfil && (canDispatch || canDeliver || canCancel) && (
                          <div className="flex flex-wrap gap-2">
                            {canDispatch && (
                              <button type="button" className={adminPrimaryBtn} onClick={() => open({ kind: "dispatch", orderId: o.id, sellerOrderId: so.id, label: so.sellerOrderNumber })}>
                                <Truck size={13} aria-hidden="true" /> Dispatch
                              </button>
                            )}
                            {canDeliver && (
                              <button type="button" className={adminPrimaryBtn} onClick={() => open({ kind: "deliver", orderId: o.id, sellerOrderId: so.id, label: so.sellerOrderNumber })}>
                                <CheckCircle2 size={13} aria-hidden="true" /> Mark delivered
                              </button>
                            )}
                            {canCancel && (
                              <button
                                type="button"
                                className={adminSecondaryBtn}
                                onClick={() => open({ kind: "cancel", orderId: o.id, sellerOrderId: so.id, label: so.sellerOrderNumber, paid })}
                              >
                                <XCircle size={13} aria-hidden="true" /> Cancel package
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>

      <AdminDialog open={action !== null} onClose={() => !saving && setAction(null)} title={dialogTitle} wide={action?.kind === "dispatch"}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {action?.kind === "dispatch" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="ship-carrier" className={adminLabelCls}>Carrier</label>
                <select id="ship-carrier" value={carrierName} onChange={(e) => setCarrierName(e.target.value)} className={adminInputCls} disabled={saving}>
                  {PAKISTAN_CARRIERS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="ship-tracking" className={adminLabelCls}>Tracking / consignment #</label>
                <input
                  id="ship-tracking"
                  required
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  maxLength={40}
                  pattern="[A-Za-z0-9\-]{4,40}"
                  className={`${adminInputCls} font-mono`}
                  disabled={saving}
                  aria-describedby="ship-tracking-help"
                />
                <p id="ship-tracking-help" className="text-[10px] text-slate-500 mt-1">From the courier booking. 4–40 letters, digits or hyphens.</p>
              </div>
              <div>
                <label htmlFor="ship-url" className={adminLabelCls}>Tracking URL (optional)</label>
                <input id="ship-url" type="url" placeholder="https://" value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} className={adminInputCls} disabled={saving} />
              </div>
            </div>
          )}
          {action?.kind === "deliver" && (
            <p className="text-xs text-slate-300">Confirm the courier has delivered this package. This cannot be undone from the admin console.</p>
          )}
          {action?.kind === "cancel" && (
            <>
              <p className="text-xs text-slate-300">
                Cancelling releases the stock and reverses the seller credit.
                {action.paid ? " The order was paid, so a PENDING refund is recorded — it must be paid out manually." : ""}
              </p>
              <div>
                <label htmlFor="cancel-reason" className={adminLabelCls}>Reason (required)</label>
                <textarea id="cancel-reason" required minLength={3} maxLength={500} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={adminInputCls} disabled={saving} />
              </div>
            </>
          )}
          {action?.kind === "cod" && (
            <div>
              <label htmlFor="cod-ref" className={adminLabelCls}>Courier remittance reference</label>
              <input id="cod-ref" required maxLength={100} value={remittanceRef} onChange={(e) => setRemittanceRef(e.target.value)} className={adminInputCls} disabled={saving} />
              <p className="text-[10px] text-slate-500 mt-1">Use the reference on the courier&apos;s remittance statement. This marks the order paid.</p>
            </div>
          )}
          {dialogError && <AdminAlert tone="error">{dialogError}</AdminAlert>}
          <div className="flex justify-end gap-2">
            <button type="button" className={adminSecondaryBtn} onClick={() => setAction(null)} disabled={saving}>
              Close
            </button>
            <button type="submit" className={action?.kind === "cancel" ? adminDangerBtn : adminPrimaryBtn} disabled={saving}>
              {saving
                ? "Saving…"
                : action?.kind === "dispatch"
                  ? "Save waybill & dispatch"
                  : action?.kind === "deliver"
                    ? "Mark delivered"
                    : action?.kind === "cancel"
                      ? "Cancel package"
                      : "Confirm remittance"}
            </button>
          </div>
        </form>
      </AdminDialog>
    </div>
  );
}
