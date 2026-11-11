"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Power } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { AdminAlert, AdminDialog, adminRequest, minorToRupeesInput, rupeesToMinor } from "@/components/admin-dialog";
import {
  AdminBadge,
  AdminEmptyState,
  adminCardCls,
  adminDangerBtn,
  adminInputCls,
  adminLabelCls,
  adminPrimaryBtn,
  adminSecondaryBtn,
  type AdminTone,
} from "@/components/admin-ui";

export interface AdminCouponRow {
  id: string;
  code: string;
  description: string | null;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValueMinor: number;
  minOrderAmountMinor: number;
  maxDiscountMinor: number | null;
  usageLimit: number | null;
  timesUsed: number;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
}

interface FormState {
  code: string;
  description: string;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  value: string; // percent or rupees
  minOrder: string; // rupees
  maxDiscount: string; // rupees
  usageLimit: string;
  startsAt: string; // datetime-local
  expiresAt: string;
  isActive: boolean;
}

const EMPTY: FormState = {
  code: "",
  description: "",
  discountType: "PERCENTAGE",
  value: "",
  minOrder: "0",
  maxDiscount: "",
  usageLimit: "",
  startsAt: "",
  expiresAt: "",
  isActive: true,
};

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function couponState(c: AdminCouponRow, now: Date): { label: string; tone: AdminTone } {
  if (!c.isActive) return { label: "Deactivated", tone: "neutral" };
  if (c.expiresAt && new Date(c.expiresAt) <= now) return { label: "Expired", tone: "danger" };
  if (c.startsAt && new Date(c.startsAt) > now) return { label: "Scheduled", tone: "info" };
  if (c.usageLimit !== null && c.timesUsed >= c.usageLimit) return { label: "Limit reached", tone: "warning" };
  return { label: "Live", tone: "success" };
}

function describeValue(c: AdminCouponRow) {
  return c.discountType === "PERCENTAGE" ? `${c.discountValueMinor}% off` : `${formatCurrency(c.discountValueMinor)} off`;
}

/** Converts the form to the API payload; returns an error string if client-side checks fail. */
function toPayload(f: FormState, isNew: boolean): { payload: Record<string, unknown> } | { error: string } {
  let discountValueMinor: number;
  if (f.discountType === "PERCENTAGE") {
    if (!/^\d{1,2}$/.test(f.value.trim())) return { error: "Percentage must be a whole number from 1 to 90." };
    discountValueMinor = Number(f.value.trim());
    if (discountValueMinor < 1 || discountValueMinor > 90) return { error: "Percentage must be between 1 and 90." };
  } else {
    const minor = rupeesToMinor(f.value);
    if (minor === null || minor <= 0) return { error: "Fixed discount must be an amount greater than Rs 0." };
    discountValueMinor = minor;
  }
  const minOrderAmountMinor = f.minOrder.trim() === "" ? 0 : rupeesToMinor(f.minOrder);
  if (minOrderAmountMinor === null) return { error: "Minimum order must be a valid rupee amount." };
  let maxDiscountMinor: number | null = null;
  if (f.discountType === "PERCENTAGE" && f.maxDiscount.trim()) {
    maxDiscountMinor = rupeesToMinor(f.maxDiscount);
    if (maxDiscountMinor === null || maxDiscountMinor <= 0) return { error: "Maximum discount must be a rupee amount above 0, or empty for no cap." };
  }
  let usageLimit: number | null = null;
  if (f.usageLimit.trim()) {
    if (!/^\d+$/.test(f.usageLimit.trim()) || Number(f.usageLimit) < 1) return { error: "Usage limit must be a whole number of at least 1, or empty for unlimited." };
    usageLimit = Number(f.usageLimit.trim());
  }
  const startsAt = fromLocalInput(f.startsAt);
  const expiresAt = fromLocalInput(f.expiresAt);
  if (startsAt && expiresAt && new Date(expiresAt) <= new Date(startsAt)) return { error: "End date must be after the start date." };

  const payload: Record<string, unknown> = {
    description: f.description.trim() || null,
    discountType: f.discountType,
    discountValueMinor,
    minOrderAmountMinor,
    maxDiscountMinor,
    usageLimit,
    startsAt,
    expiresAt,
    isActive: f.isActive,
  };
  if (isNew) payload.code = f.code.trim().toUpperCase();
  return { payload };
}

function rowToPayload(c: AdminCouponRow, isActive: boolean) {
  return {
    description: c.description,
    discountType: c.discountType,
    discountValueMinor: c.discountValueMinor,
    minOrderAmountMinor: c.minOrderAmountMinor,
    maxDiscountMinor: c.discountType === "PERCENTAGE" ? c.maxDiscountMinor : null,
    usageLimit: c.usageLimit,
    startsAt: c.startsAt,
    expiresAt: c.expiresAt,
    isActive,
  };
}

export function AdminCouponsManager({ coupons, nowIso }: { coupons: AdminCouponRow[]; nowIso: string }) {
  const router = useRouter();
  const now = new Date(nowIso);
  const [editing, setEditing] = useState<AdminCouponRow | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<AdminCouponRow | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const openNew = () => {
    setForm(EMPTY);
    setFormError(null);
    setEditing("new");
  };
  const openEdit = (c: AdminCouponRow) => {
    setForm({
      code: c.code,
      description: c.description ?? "",
      discountType: c.discountType,
      value: c.discountType === "PERCENTAGE" ? String(c.discountValueMinor) : minorToRupeesInput(c.discountValueMinor),
      minOrder: minorToRupeesInput(c.minOrderAmountMinor),
      maxDiscount: minorToRupeesInput(c.maxDiscountMinor),
      usageLimit: c.usageLimit === null ? "" : String(c.usageLimit),
      startsAt: toLocalInput(c.startsAt),
      expiresAt: toLocalInput(c.expiresAt),
      isActive: c.isActive,
    });
    setFormError(null);
    setEditing(c);
  };

  const save = async () => {
    const isNew = editing === "new";
    const built = toPayload(form, isNew);
    if ("error" in built) {
      setFormError(built.error);
      return;
    }
    setSaving(true);
    setFormError(null);
    const res = isNew
      ? await adminRequest("/api/admin/coupons", "POST", built.payload)
      : await adminRequest(`/api/admin/coupons/${(editing as AdminCouponRow).id}`, "PATCH", built.payload);
    setSaving(false);
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    setNotice({ tone: "success", text: isNew ? `Coupon ${form.code.trim().toUpperCase()} created.` : `Coupon ${form.code} saved.` });
    setEditing(null);
    router.refresh();
  };

  const confirmToggle = async () => {
    if (!toggling) return;
    setSaving(true);
    const res = await adminRequest(`/api/admin/coupons/${toggling.id}`, "PATCH", rowToPayload(toggling, !toggling.isActive));
    setSaving(false);
    if (!res.ok) {
      setNotice({ tone: "error", text: res.error });
    } else {
      setNotice({ tone: "success", text: `Coupon ${toggling.code} ${toggling.isActive ? "deactivated" : "reactivated"}.` });
      router.refresh();
    }
    setToggling(null);
  };

  const isPercent = form.discountType === "PERCENTAGE";

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" className={adminPrimaryBtn} onClick={openNew}>
          <Plus size={14} aria-hidden="true" /> New coupon
        </button>
      </div>

      {notice && (
        <AdminAlert tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </AdminAlert>
      )}

      {coupons.length === 0 ? (
        <AdminEmptyState title="No coupons match" description="Create a coupon or change the filter." />
      ) : (
        <div className={`${adminCardCls} overflow-x-auto`}>
          <table className="w-full text-left text-xs min-w-[900px]">
            <caption className="sr-only">Coupons</caption>
            <thead className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-700">
              <tr>
                <th scope="col" className="px-4 py-3">Code</th>
                <th scope="col" className="px-4 py-3">Discount</th>
                <th scope="col" className="px-4 py-3 text-right">Min order</th>
                <th scope="col" className="px-4 py-3 text-right">Max discount</th>
                <th scope="col" className="px-4 py-3 text-right">Used / limit</th>
                <th scope="col" className="px-4 py-3">Valid</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {coupons.map((c) => {
                const st = couponState(c, now);
                return (
                  <tr key={c.id}>
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-white">{c.code}</span>
                      {c.description && <span className="block text-slate-400 truncate max-w-[200px]">{c.description}</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-200">{describeValue(c)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-300">{c.minOrderAmountMinor ? formatCurrency(c.minOrderAmountMinor) : "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-300">
                      {c.discountType === "PERCENTAGE" && c.maxDiscountMinor ? formatCurrency(c.maxDiscountMinor) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-200">
                      {c.timesUsed} / {c.usageLimit ?? "∞"}
                    </td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                      <span className="block">{c.startsAt ? `From ${formatDateTime(c.startsAt)}` : "From creation"}</span>
                      <span className="block text-slate-400">{c.expiresAt ? `Until ${formatDateTime(c.expiresAt)}` : "No end date"}</span>
                    </td>
                    <td className="px-4 py-3"><AdminBadge tone={st.tone}>{st.label}</AdminBadge></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button type="button" className={adminSecondaryBtn} onClick={() => openEdit(c)} aria-label={`Edit ${c.code}`}>
                          <Pencil size={13} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className={adminSecondaryBtn}
                          onClick={() => setToggling(c)}
                          aria-label={c.isActive ? `Deactivate ${c.code}` : `Reactivate ${c.code}`}
                          title={c.isActive ? "Deactivate" : "Reactivate"}
                        >
                          <Power size={13} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AdminDialog
        open={editing !== null}
        onClose={() => !saving && setEditing(null)}
        title={editing === "new" ? "New coupon" : `Edit ${form.code}`}
        description={editing !== "new" && editing ? `Used ${editing.timesUsed} time(s). The code itself cannot be changed.` : undefined}
        wide
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="cp-code" className={adminLabelCls}>Code</label>
              <input
                id="cp-code"
                required
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                pattern="[A-Za-z0-9][A-Za-z0-9_\-]{2,31}"
                maxLength={32}
                className={`${adminInputCls} font-mono uppercase`}
                disabled={saving || editing !== "new"}
              />
            </div>
            <div>
              <label htmlFor="cp-type" className={adminLabelCls}>Discount type</label>
              <select
                id="cp-type"
                value={form.discountType}
                onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value as FormState["discountType"], value: "", maxDiscount: "" }))}
                className={adminInputCls}
                disabled={saving}
              >
                <option value="PERCENTAGE">Percentage of subtotal</option>
                <option value="FIXED_AMOUNT">Fixed amount (PKR)</option>
              </select>
            </div>
            <div>
              <label htmlFor="cp-value" className={adminLabelCls}>{isPercent ? "Percent off (1–90)" : "Amount off (Rs)"}</label>
              <input id="cp-value" required inputMode="decimal" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} className={adminInputCls} disabled={saving} />
            </div>
            <div>
              <label htmlFor="cp-min" className={adminLabelCls}>Minimum subtotal (Rs)</label>
              <input id="cp-min" inputMode="decimal" value={form.minOrder} onChange={(e) => setForm((f) => ({ ...f, minOrder: e.target.value }))} className={adminInputCls} disabled={saving} />
            </div>
            <div>
              <label htmlFor="cp-max" className={adminLabelCls}>Maximum discount (Rs, percentage only)</label>
              <input
                id="cp-max"
                inputMode="decimal"
                placeholder={isPercent ? "No cap" : "Not used for fixed amounts"}
                value={form.maxDiscount}
                onChange={(e) => setForm((f) => ({ ...f, maxDiscount: e.target.value }))}
                className={adminInputCls}
                disabled={saving || !isPercent}
              />
            </div>
            <div>
              <label htmlFor="cp-limit" className={adminLabelCls}>Total usage limit</label>
              <input id="cp-limit" inputMode="numeric" placeholder="Unlimited" value={form.usageLimit} onChange={(e) => setForm((f) => ({ ...f, usageLimit: e.target.value }))} className={adminInputCls} disabled={saving} />
            </div>
            <div>
              <label htmlFor="cp-start" className={adminLabelCls}>Starts (optional)</label>
              <input id="cp-start" type="datetime-local" value={form.startsAt} onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))} className={adminInputCls} disabled={saving} />
            </div>
            <div>
              <label htmlFor="cp-end" className={adminLabelCls}>Ends (optional)</label>
              <input id="cp-end" type="datetime-local" value={form.expiresAt} onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))} className={adminInputCls} disabled={saving} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="cp-desc" className={adminLabelCls}>Internal description (optional)</label>
              <input id="cp-desc" maxLength={200} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={adminInputCls} disabled={saving} />
            </div>
            <label className="sm:col-span-2 flex items-center gap-2 text-xs text-slate-200">
              <input type="checkbox" className="w-4 h-4 accent-brand-500" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} disabled={saving} />
              Active
            </label>
          </div>
          <p className="text-[11px] text-slate-500">Times are in your browser&apos;s local time zone. The discount never exceeds the order subtotal.</p>
          {formError && <AdminAlert tone="error">{formError}</AdminAlert>}
          <div className="flex justify-end gap-2">
            <button type="button" className={adminSecondaryBtn} onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className={adminPrimaryBtn} disabled={saving}>
              {saving ? "Saving…" : editing === "new" ? "Create coupon" : "Save changes"}
            </button>
          </div>
        </form>
      </AdminDialog>

      <AdminDialog
        open={toggling !== null}
        onClose={() => !saving && setToggling(null)}
        title={toggling?.isActive ? `Deactivate ${toggling.code}?` : `Reactivate ${toggling?.code ?? ""}?`}
        description={toggling?.isActive ? "Customers will no longer be able to apply this code. Past orders are unaffected." : "Customers can apply this code again, subject to its dates and limits."}
      >
        <div className="flex justify-end gap-2">
          <button type="button" className={adminSecondaryBtn} onClick={() => setToggling(null)} disabled={saving}>
            Cancel
          </button>
          <button type="button" className={toggling?.isActive ? adminDangerBtn : adminPrimaryBtn} onClick={() => void confirmToggle()} disabled={saving}>
            {saving ? "Saving…" : toggling?.isActive ? "Deactivate" : "Reactivate"}
          </button>
        </div>
      </AdminDialog>
    </div>
  );
}
