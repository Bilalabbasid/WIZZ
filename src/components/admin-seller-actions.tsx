"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, RotateCcw, Percent } from "lucide-react";
import { AdminAlert, AdminDialog, adminRequest } from "@/components/admin-dialog";
import { adminDangerBtn, adminInputCls, adminLabelCls, adminPrimaryBtn, adminSecondaryBtn } from "@/components/admin-ui";

export function AdminSellerStatusActions({
  sellerId,
  sellerName,
  status,
  isFirstParty,
  canChange,
}: {
  sellerId: string;
  sellerName: string;
  status: string;
  isFirstParty: boolean;
  canChange: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"suspend" | "reactivate" | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (isFirstParty) {
    return <p className="text-xs text-slate-400">WIZZ.PK Direct is the first-party store and cannot be suspended.</p>;
  }
  if (!canChange) {
    return <p className="text-xs text-slate-400">Your role can view sellers but not change their status (super or catalog admin required).</p>;
  }

  const submit = async () => {
    if (!mode) return;
    setSaving(true);
    setError(null);
    const res = await adminRequest(`/api/admin/sellers/${sellerId}/status`, "POST", {
      action: mode,
      ...(mode === "suspend" ? { reason } : {}),
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setMode(null);
    setReason("");
    setSuccess(mode === "suspend" ? "Seller suspended. Members have been notified." : "Seller reactivated. Members have been notified.");
    router.refresh();
  };

  return (
    <div className="space-y-3">
      {success && <AdminAlert tone="success" onDismiss={() => setSuccess(null)}>{success}</AdminAlert>}
      <div className="flex flex-wrap gap-2">
        {status === "ACTIVE" && (
          <button type="button" className={adminDangerBtn} onClick={() => { setMode("suspend"); setError(null); }}>
            <Ban size={14} aria-hidden="true" /> Suspend seller
          </button>
        )}
        {status === "SUSPENDED" && (
          <button type="button" className={adminPrimaryBtn} onClick={() => { setMode("reactivate"); setError(null); }}>
            <RotateCcw size={14} aria-hidden="true" /> Reactivate seller
          </button>
        )}
        {status !== "ACTIVE" && status !== "SUSPENDED" && (
          <p className="text-xs text-slate-400">Status changes are available for ACTIVE or SUSPENDED sellers only (current: {status}).</p>
        )}
      </div>

      <AdminDialog
        open={mode !== null}
        onClose={() => !saving && setMode(null)}
        title={mode === "suspend" ? `Suspend ${sellerName}?` : `Reactivate ${sellerName}?`}
        description={
          mode === "suspend"
            ? "The seller's members are notified with your reason. Suspension is recorded in the audit log."
            : "The seller returns to ACTIVE status and members are notified."
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="space-y-4"
        >
          {mode === "suspend" && (
            <div>
              <label htmlFor="suspend-reason" className={adminLabelCls}>
                Reason (required, shared with the seller)
              </label>
              <textarea
                id="suspend-reason"
                required
                minLength={10}
                maxLength={500}
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={adminInputCls}
                disabled={saving}
              />
              <p className="text-[11px] text-slate-500 mt-1">{reason.trim().length}/500 · minimum 10 characters</p>
            </div>
          )}
          {error && <AdminAlert tone="error">{error}</AdminAlert>}
          <div className="flex justify-end gap-2">
            <button type="button" className={adminSecondaryBtn} onClick={() => setMode(null)} disabled={saving}>
              Cancel
            </button>
            <button
              type="submit"
              className={mode === "suspend" ? adminDangerBtn : adminPrimaryBtn}
              disabled={saving || (mode === "suspend" && reason.trim().length < 10)}
            >
              {saving ? "Saving…" : mode === "suspend" ? "Suspend seller" : "Reactivate seller"}
            </button>
          </div>
        </form>
      </AdminDialog>
    </div>
  );
}

export function AdminSellerCommissionForm({
  sellerId,
  currentRate,
  canEdit,
}: {
  sellerId: string;
  currentRate: number;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(String(currentRate));
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const parsed = /^\d{1,2}$/.test(value.trim()) ? Number(value.trim()) : NaN;
  const valid = Number.isInteger(parsed) && parsed >= 0 && parsed <= 50;
  const changed = valid && parsed !== currentRate;

  if (!canEdit) {
    return (
      <p className="text-xs text-slate-400">
        Current rate <strong className="text-white">{currentRate}%</strong>. Only a super admin can change commission rates.
      </p>
    );
  }

  const save = async () => {
    setSaving(true);
    setError(null);
    const res = await adminRequest(`/api/admin/sellers/${sellerId}/commission`, "PATCH", {
      commissionRatePercent: parsed,
      ...(note.trim() ? { note: note.trim() } : {}),
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      setConfirming(false);
      return;
    }
    setConfirming(false);
    setNote("");
    setSuccess(`Commission updated to ${parsed}% for future orders.`);
    router.refresh();
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (changed) setConfirming(true);
      }}
    >
      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <div className="sm:w-32">
          <label htmlFor="commission" className={adminLabelCls}>
            Commission %
          </label>
          <div className="relative">
            <input
              id="commission"
              inputMode="numeric"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className={`${adminInputCls} pr-8`}
              aria-invalid={!valid}
              aria-describedby="commission-help"
              disabled={saving}
            />
            <Percent size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          </div>
        </div>
        <div className="flex-1">
          <label htmlFor="commission-note" className={adminLabelCls}>
            Internal note (optional)
          </label>
          <input id="commission-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={adminInputCls} disabled={saving} />
        </div>
        <button type="submit" className={adminPrimaryBtn} disabled={!changed || saving}>
          Update rate
        </button>
      </div>
      <p id="commission-help" className={`text-[11px] ${valid ? "text-slate-500" : "text-rose-300"}`} aria-live="polite">
        {valid
          ? "Whole number from 0 to 50. Applies to orders placed after the change; past order lines keep their commission snapshot."
          : "Enter a whole number from 0 to 50."}
      </p>
      {error && <AdminAlert tone="error" onDismiss={() => setError(null)}>{error}</AdminAlert>}
      {success && <AdminAlert tone="success" onDismiss={() => setSuccess(null)}>{success}</AdminAlert>}

      <AdminDialog
        open={confirming}
        onClose={() => !saving && setConfirming(false)}
        title="Change commission rate?"
        description={`From ${currentRate}% to ${valid ? parsed : "?"}%. Existing orders are not recalculated.`}
      >
        <div className="flex justify-end gap-2">
          <button type="button" className={adminSecondaryBtn} onClick={() => setConfirming(false)} disabled={saving}>
            Cancel
          </button>
          <button type="button" className={adminPrimaryBtn} onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Confirm change"}
          </button>
        </div>
      </AdminDialog>
    </form>
  );
}
