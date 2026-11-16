"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, Undo2, XCircle } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
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

/** A payout request as the admin UI receives it (dates as ISO strings, last 4 IBAN digits only). */
export interface AdminPayoutRequestView {
  id: string;
  sellerOrgId: string;
  sellerName?: string;
  amountMinor: number;
  status: "REQUESTED" | "APPROVED_PAID" | "REJECTED" | "FAILED";
  requestedById: string;
  requestedBy: string;
  decidedBy: string | null;
  bankReference: string | null;
  bankIbanLast4: string | null;
  bankName?: string | null;
  notes: string | null;
  decisionNote: string | null;
  requestedAt: string;
  decidedAt: string | null;
}

const STATUS: Record<AdminPayoutRequestView["status"], { label: string; tone: AdminTone }> = {
  REQUESTED: { label: "Awaiting confirmation", tone: "warning" },
  APPROVED_PAID: { label: "Paid", tone: "success" },
  REJECTED: { label: "Rejected", tone: "neutral" },
  FAILED: { label: "Failed / returned", tone: "danger" },
};

export function PayoutStatusBadge({ status }: { status: AdminPayoutRequestView["status"] }) {
  const s = STATUS[status];
  return <AdminBadge tone={s.tone}>{s.label}</AdminBadge>;
}

/**
 * Reveals the seller's full IBAN (audited server-side as BANK_DETAILS_REVEALED) for the finance
 * admin who makes the transfer. The number is held in memory only and hidden again after 2 minutes.
 */
export function RevealIbanButton({ sellerId }: { sellerId: string }) {
  const [iban, setIban] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!iban) return;
    const t = setTimeout(() => setIban(null), 120_000);
    return () => clearTimeout(t);
  }, [iban]);

  const reveal = async () => {
    setBusy(true);
    setError(null);
    const res = await adminRequest<{ bank: { bankIban: string } }>(`/api/admin/sellers/${sellerId}/bank/reveal`, "POST", {
      reason: "Making the payout transfer",
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setIban(res.data.bank.bankIban);
  };

  return (
    <div className="space-y-1">
      {iban ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-white break-all select-all" aria-label="Full IBAN">{iban}</span>
          <button type="button" className={adminSecondaryBtn} onClick={() => setIban(null)}>
            <EyeOff size={12} aria-hidden="true" /> Hide
          </button>
        </div>
      ) : (
        <button type="button" className={adminSecondaryBtn} onClick={() => void reveal()} disabled={busy}>
          <Eye size={12} aria-hidden="true" /> {busy ? "Revealing…" : "Reveal full IBAN"}
        </button>
      )}
      <p className="text-[10px] text-slate-500">Each reveal is recorded in the audit log.</p>
      {error && <p className="text-[11px] text-rose-300" role="alert">{error}</p>}
    </div>
  );
}

type Mode = "approve" | "reject" | "failed" | null;

/**
 * Actions for one payout request. Confirming is offered only to a finance admin other than the
 * requester (the API enforces this too); the requester can still withdraw (reject) it.
 */
export function PayoutRequestActions({
  request,
  currentUserId,
  onDone,
}: {
  request: AdminPayoutRequestView;
  currentUserId: string;
  onDone?: (message: string) => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMaker = request.requestedById === currentUserId;

  const open = (m: Mode) => {
    setMode(m);
    setReference("");
    setNote("");
    setError(null);
  };

  const submit = async () => {
    if (!mode) return;
    let url = "";
    let body: Record<string, unknown> = {};
    if (mode === "approve") {
      if (reference.trim().length < 3) return setError("Enter the bank transfer reference (at least 3 characters).");
      url = `/api/admin/payouts/${request.id}/approve`;
      body = { bankReference: reference.trim(), sellerOrgId: request.sellerOrgId };
    } else if (mode === "reject") {
      if (note.trim().length < 3) return setError("Say why the payout is rejected (at least 3 characters).");
      url = `/api/admin/payouts/${request.id}/reject`;
      body = { note: note.trim(), sellerOrgId: request.sellerOrgId };
    } else {
      if (note.trim().length < 5) return setError("Describe why the transfer failed (at least 5 characters).");
      url = `/api/admin/payouts/${request.id}/failed`;
      body = { reason: note.trim(), sellerOrgId: request.sellerOrgId };
    }
    setSaving(true);
    setError(null);
    const res = await adminRequest(url, "POST", body);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    const amount = formatCurrency(request.amountMinor);
    const message =
      mode === "approve"
        ? `Payout of ${amount} confirmed (bank ref ${reference.trim()}).`
        : mode === "reject"
          ? `Payout request of ${amount} rejected; the amount is available again.`
          : `Payout of ${amount} marked failed; the amount is back in the seller's balance.`;
    setMode(null);
    onDone?.(message);
    router.refresh();
  };

  return (
    <>
      <div className="flex flex-wrap justify-end gap-1.5">
        {request.status === "REQUESTED" && (
          <>
            {isMaker ? (
              <span className="text-[10px] text-slate-400 self-center">Needs a second finance admin</span>
            ) : (
              <button type="button" className={adminPrimaryBtn} onClick={() => open("approve")}>
                <CheckCircle2 size={12} aria-hidden="true" /> Confirm transfer
              </button>
            )}
            <button type="button" className={adminSecondaryBtn} onClick={() => open("reject")}>
              <XCircle size={12} aria-hidden="true" /> {isMaker ? "Withdraw" : "Reject"}
            </button>
          </>
        )}
        {request.status === "APPROVED_PAID" && (
          <button type="button" className={adminSecondaryBtn} onClick={() => open("failed")}>
            <Undo2 size={12} aria-hidden="true" /> Mark failed
          </button>
        )}
      </div>

      <AdminDialog
        open={mode !== null}
        onClose={() => !saving && setMode(null)}
        title={
          mode === "approve"
            ? "Confirm the bank transfer"
            : mode === "reject"
              ? "Reject this payout request?"
              : "Mark this payout as failed?"
        }
        description={
          mode === "approve"
            ? "Send the transfer from the WIZZ.PK bank account first, then enter its reference. This records the payout in the seller's ledger."
            : mode === "reject"
              ? "The reserved amount becomes available again. Nothing is recorded as paid."
              : "Use this only when the bank returned or rejected the transfer. The amount goes back to the seller's balance."
        }
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <dl className="text-xs grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            {request.sellerName && (
              <>
                <dt className="text-slate-400">Seller</dt>
                <dd className="text-white">{request.sellerName}</dd>
              </>
            )}
            <dt className="text-slate-400">Amount</dt>
            <dd className="text-white font-bold">{formatCurrency(request.amountMinor)}</dd>
            <dt className="text-slate-400">Account</dt>
            <dd className="text-white">
              {request.bankName ? `${request.bankName} · ` : ""}
              <span className="font-mono">•••• {request.bankIbanLast4 ?? "????"}</span>
            </dd>
            <dt className="text-slate-400">Requested</dt>
            <dd className="text-slate-200">{request.requestedBy} · {formatDateTime(request.requestedAt)}</dd>
            {request.bankReference && (
              <>
                <dt className="text-slate-400">Bank ref</dt>
                <dd className="text-white font-mono break-all">{request.bankReference}</dd>
              </>
            )}
          </dl>

          {mode === "approve" && (
            <>
              <RevealIbanButton sellerId={request.sellerOrgId} />
              <div>
                <label htmlFor={`ref-${request.id}`} className={adminLabelCls}>Bank transfer reference (required)</label>
                <input
                  id={`ref-${request.id}`}
                  maxLength={120}
                  autoComplete="off"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className={`${adminInputCls} font-mono`}
                  disabled={saving}
                />
              </div>
            </>
          )}
          {(mode === "reject" || mode === "failed") && (
            <div>
              <label htmlFor={`note-${request.id}`} className={adminLabelCls}>{mode === "reject" ? "Reason (required)" : "Failure reason (required)"}</label>
              <textarea
                id={`note-${request.id}`}
                rows={3}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={adminInputCls}
                disabled={saving}
              />
            </div>
          )}

          {error && <AdminAlert tone="error">{error}</AdminAlert>}
          <div className="flex justify-end gap-2">
            <button type="button" className={adminSecondaryBtn} onClick={() => setMode(null)} disabled={saving}>Cancel</button>
            <button type="submit" className={mode === "approve" ? adminPrimaryBtn : adminDangerBtn} disabled={saving}>
              {saving ? "Saving…" : mode === "approve" ? "Confirm payout" : mode === "reject" ? "Reject request" : "Mark failed"}
            </button>
          </div>
        </form>
      </AdminDialog>
    </>
  );
}
