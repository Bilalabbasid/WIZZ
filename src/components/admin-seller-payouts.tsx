"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Landmark, Undo2 } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { AdminAlert, AdminDialog, adminRequest, rupeesToMinor } from "@/components/admin-dialog";
import {
  AdminBadge,
  adminCardCls,
  adminDangerBtn,
  adminInputCls,
  adminLabelCls,
  adminPrimaryBtn,
  adminSecondaryBtn,
  type AdminTone,
} from "@/components/admin-ui";

export interface AdminPayoutSummary {
  eligibleMinor: number;
  inEscrowMinor: number;
  heldMinor: number;
  paidOutMinor: number;
  payoutCount: number;
  reversedPayoutsMinor: number;
  bank: { bankName: string | null; bankAccountTitle: string | null; bankIban: string | null };
  entries: Array<{
    id: string;
    entryType: string;
    amountMinor: number;
    status: string;
    description: string;
    referenceId: string | null;
    holdReason: string | null;
    createdAt: string;
    sellerOrderNumber: string | null;
    isReversed: boolean;
  }>;
}

const STATUS_TONE: Record<string, AdminTone> = {
  ELIGIBLE: "success",
  SETTLED: "neutral",
  IN_ESCROW: "info",
  PENDING: "info",
  HELD: "warning",
  REVERSED: "danger",
};

export function AdminSellerPayouts({
  sellerId,
  summary,
  isFirstParty,
}: {
  sellerId: string;
  summary: AdminPayoutSummary;
  isFirstParty: boolean;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [failing, setFailing] = useState<AdminPayoutSummary["entries"][number] | null>(null);
  const [failureReason, setFailureReason] = useState("");
  const [failError, setFailError] = useState<string | null>(null);

  const bankComplete = Boolean(summary.bank.bankAccountTitle && summary.bank.bankIban);
  const amountMinor = rupeesToMinor(amount);

  const review = () => {
    setFormError(null);
    if (amountMinor === null || amountMinor <= 0) return setFormError("Enter an amount in rupees greater than 0 (up to 2 decimals).");
    if (amountMinor > summary.eligibleMinor) return setFormError(`Amount exceeds the eligible balance of ${formatCurrency(summary.eligibleMinor)}.`);
    if (reference.trim().length < 3) return setFormError("Enter the bank transfer reference (at least 3 characters).");
    setConfirming(true);
  };

  const submit = async () => {
    if (amountMinor === null) return;
    setSaving(true);
    const res = await adminRequest(`/api/admin/sellers/${sellerId}/payouts`, "POST", {
      payoutAmountMinor: amountMinor,
      bankTransactionRef: reference.trim(),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });
    setSaving(false);
    setConfirming(false);
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    setNotice({ tone: "success", text: `Payout of ${formatCurrency(amountMinor)} recorded (ref ${reference.trim()}).` });
    setAmount("");
    setReference("");
    setNotes("");
    router.refresh();
  };

  const submitFailed = async () => {
    if (!failing?.referenceId) return;
    if (failureReason.trim().length < 5) {
      setFailError("Describe why the payout failed (at least 5 characters).");
      return;
    }
    setSaving(true);
    setFailError(null);
    const res = await adminRequest(`/api/admin/sellers/${sellerId}/payouts/failed`, "POST", {
      payoutReferenceId: failing.referenceId,
      failureReason: failureReason.trim(),
    });
    setSaving(false);
    if (!res.ok) {
      setFailError(res.error);
      return;
    }
    setNotice({ tone: "success", text: `Payout ${failing.referenceId} marked failed; ${formatCurrency(Math.abs(failing.amountMinor))} returned to the eligible balance.` });
    setFailing(null);
    setFailureReason("");
    router.refresh();
  };

  return (
    <section aria-labelledby="payouts-h" className={`${adminCardCls} p-5 space-y-5`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="payouts-h" className="font-bold text-sm text-white flex items-center gap-2">
          <Landmark size={15} className="text-brand-400" aria-hidden="true" /> Settlements & payouts
        </h2>
        <span className="text-[11px] text-slate-500">Payouts are bank transfers made outside WIZZ.PK, then recorded here.</span>
      </div>

      {notice && (
        <AdminAlert tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </AdminAlert>
      )}

      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
          <dt className="text-[11px] font-semibold text-emerald-400">Eligible to pay</dt>
          <dd className={`text-lg font-black tabular-nums ${summary.eligibleMinor < 0 ? "text-rose-300" : "text-white"}`}>{formatCurrency(summary.eligibleMinor)}</dd>
          {summary.eligibleMinor < 0 && <dd className="text-[10px] text-rose-300">Negative: refunds exceed eligible credits.</dd>}
        </div>
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
          <dt className="text-[11px] font-semibold text-slate-400">In escrow / pending</dt>
          <dd className="text-lg font-black text-white tabular-nums">{formatCurrency(summary.inEscrowMinor)}</dd>
        </div>
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
          <dt className="text-[11px] font-semibold text-slate-400">Held</dt>
          <dd className="text-lg font-black text-white tabular-nums">{formatCurrency(summary.heldMinor)}</dd>
        </div>
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
          <dt className="text-[11px] font-semibold text-slate-400">Paid out ({summary.payoutCount})</dt>
          <dd className="text-lg font-black text-white tabular-nums">{formatCurrency(summary.paidOutMinor)}</dd>
          {summary.reversedPayoutsMinor > 0 && (
            <dd className="text-[10px] text-amber-300">{formatCurrency(summary.reversedPayoutsMinor)} of this bounced and was restored.</dd>
          )}
        </div>
      </dl>

      {isFirstParty ? (
        <p className="text-xs text-slate-400">WIZZ.PK Direct is the first-party store and does not receive seller payouts.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              review();
            }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="payout-amount" className={adminLabelCls}>Amount paid (Rs)</label>
                <input id="payout-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={adminInputCls} disabled={saving} />
              </div>
              <div>
                <label htmlFor="payout-ref" className={adminLabelCls}>Bank transfer reference (required)</label>
                <input id="payout-ref" maxLength={120} value={reference} onChange={(e) => setReference(e.target.value)} className={`${adminInputCls} font-mono`} disabled={saving} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="payout-notes" className={adminLabelCls}>Notes (optional)</label>
                <input id="payout-notes" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} className={adminInputCls} disabled={saving} />
              </div>
            </div>
            {formError && <AdminAlert tone="error" onDismiss={() => setFormError(null)}>{formError}</AdminAlert>}
            <button type="submit" className={adminPrimaryBtn} disabled={saving || summary.eligibleMinor <= 0 || !bankComplete}>
              Record payout
            </button>
            {summary.eligibleMinor <= 0 && <p className="text-[11px] text-slate-500">No eligible balance to pay out.</p>}
            {!bankComplete && <p className="text-[11px] text-amber-300">The seller has no complete bank account on file. Ask them to add it in their portal before paying.</p>}
          </form>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1 h-fit">
            <p className="text-[10px] uppercase font-bold text-slate-500">Pay to (seller&apos;s account on file)</p>
            <p className="text-slate-200">{summary.bank.bankName || "Bank not set"}</p>
            <p className="text-slate-200">{summary.bank.bankAccountTitle || "Account title not set"}</p>
            <p className="font-mono text-white break-all">{summary.bank.bankIban || "IBAN not set"}</p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-xs font-bold text-slate-300">Latest ledger entries</h3>
        {summary.entries.length === 0 ? (
          <p className="text-xs text-slate-400">No settlement entries yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs min-w-[720px]">
              <caption className="sr-only">Settlement ledger</caption>
              <thead className="text-[10px] uppercase font-bold text-slate-500 border-b border-slate-800">
                <tr>
                  <th scope="col" className="px-3 py-2">Date</th>
                  <th scope="col" className="px-3 py-2">Type</th>
                  <th scope="col" className="px-3 py-2">Description</th>
                  <th scope="col" className="px-3 py-2 text-right">Amount</th>
                  <th scope="col" className="px-3 py-2">Status</th>
                  <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {summary.entries.map((e) => (
                  <tr key={e.id}>
                    <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{formatDateTime(e.createdAt)}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-slate-300">{e.entryType}</td>
                    <td className="px-3 py-2 text-slate-300">
                      <span className="block max-w-[320px] truncate" title={e.description}>{e.description}</span>
                      {e.sellerOrderNumber && <span className="block text-[10px] text-slate-500 font-mono">{e.sellerOrderNumber}</span>}
                      {e.holdReason && <span className="block text-[10px] text-amber-300">Hold: {e.holdReason}</span>}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums font-semibold ${e.amountMinor < 0 ? "text-rose-300" : "text-emerald-300"}`}>
                      {formatCurrency(e.amountMinor)}
                    </td>
                    <td className="px-3 py-2"><AdminBadge tone={STATUS_TONE[e.status] ?? "neutral"}>{e.status}</AdminBadge></td>
                    <td className="px-3 py-2 text-right">
                      {e.entryType === "MANUAL_PAYOUT" && e.referenceId && !isFirstParty && (
                        e.isReversed ? (
                          <AdminBadge tone="warning">Marked failed</AdminBadge>
                        ) : (
                          <button
                            type="button"
                            className={adminSecondaryBtn}
                            onClick={() => {
                              setFailing(e);
                              setFailureReason("");
                              setFailError(null);
                            }}
                          >
                            <Undo2 size={12} aria-hidden="true" /> Mark failed
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AdminDialog
        open={confirming}
        onClose={() => !saving && setConfirming(false)}
        title="Record this payout?"
        description="Only record a transfer that has already been sent from the WIZZ.PK bank account."
      >
        <dl className="text-xs grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-slate-400">Amount</dt><dd className="text-white font-bold">{amountMinor !== null ? formatCurrency(amountMinor) : "—"}</dd>
          <dt className="text-slate-400">Reference</dt><dd className="text-white font-mono break-all">{reference.trim()}</dd>
          <dt className="text-slate-400">Account</dt><dd className="text-white">{summary.bank.bankAccountTitle} · <span className="font-mono">{summary.bank.bankIban}</span></dd>
        </dl>
        <div className="flex justify-end gap-2">
          <button type="button" className={adminSecondaryBtn} onClick={() => setConfirming(false)} disabled={saving}>Cancel</button>
          <button type="button" className={adminPrimaryBtn} onClick={() => void submit()} disabled={saving}>{saving ? "Recording…" : "Record payout"}</button>
        </div>
      </AdminDialog>

      <AdminDialog
        open={failing !== null}
        onClose={() => !saving && setFailing(null)}
        title={`Mark payout ${failing?.referenceId ?? ""} as failed?`}
        description={failing ? `${formatCurrency(Math.abs(failing.amountMinor))} goes back to the seller's eligible balance. Use this only when the bank returned or rejected the transfer.` : undefined}
      >
        <form
          className="space-y-3"
          onSubmit={(ev) => {
            ev.preventDefault();
            void submitFailed();
          }}
        >
          <div>
            <label htmlFor="fail-reason" className={adminLabelCls}>Failure reason (required)</label>
            <textarea id="fail-reason" rows={3} maxLength={500} value={failureReason} onChange={(ev) => setFailureReason(ev.target.value)} className={adminInputCls} disabled={saving} />
          </div>
          {failError && <AdminAlert tone="error">{failError}</AdminAlert>}
          <div className="flex justify-end gap-2">
            <button type="button" className={adminSecondaryBtn} onClick={() => setFailing(null)} disabled={saving}>Cancel</button>
            <button type="submit" className={adminDangerBtn} disabled={saving}>{saving ? "Saving…" : "Mark failed"}</button>
          </div>
        </form>
      </AdminDialog>
    </section>
  );
}
