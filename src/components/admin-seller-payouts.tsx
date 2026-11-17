"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Landmark, ShieldAlert } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { AdminAlert, AdminDialog, adminRequest, rupeesToMinor } from "@/components/admin-dialog";
import { AdminBadge, adminCardCls, adminInputCls, adminLabelCls, adminPrimaryBtn, adminSecondaryBtn, type AdminTone } from "@/components/admin-ui";
import { PayoutRequestActions, PayoutStatusBadge, RevealIbanButton, type AdminPayoutRequestView } from "@/components/admin-payout-actions";

export interface AdminPayoutSummary {
  availableMinor: number;
  reservedMinor: number;
  ledgerBalanceMinor: number;
  eligibleMinor: number;
  inEscrowMinor: number;
  pendingMinor: number;
  heldMinor: number;
  paidOutMinor: number;
  payoutCount: number;
  reversedPayoutsMinor: number;
  sellerStatus: string | null;
  limits: { maxSingleMinor: number; maxApprovedPer24h: number; bankChangeHoldHours: number };
  bank: {
    bankName: string | null;
    bankAccountTitle: string | null;
    bankIbanMasked: string | null;
    bankIbanLast4: string | null;
    bankDetailsChangedAt: string | null;
    payoutHoldUntil: string | null;
  };
  bankChanges: Array<{ id: string; createdAt: string; changedBy: string; bankName: string | null; previousIbanLast4: string | null; newIbanLast4: string | null }>;
  requests: AdminPayoutRequestView[];
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

function newIdempotencyKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16)
      );
}

export function AdminSellerPayouts({
  sellerId,
  sellerName,
  summary,
  isFirstParty,
  currentUserId,
}: {
  sellerId: string;
  sellerName: string;
  summary: AdminPayoutSummary;
  isFirstParty: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  // One key per intended payout: a retried or double-submitted request returns the same row
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const bankComplete = Boolean(summary.bank.bankAccountTitle && summary.bank.bankIbanLast4 && summary.bank.bankName);
  const holdUntil = summary.bank.payoutHoldUntil;
  const openRequest = summary.requests.find((r) => r.status === "REQUESTED");
  const sellerActive = summary.sellerStatus === "ACTIVE";
  const amountMinor = rupeesToMinor(amount);
  const blockedReason = !sellerActive
    ? `Payouts are made only to ACTIVE sellers (this seller is ${summary.sellerStatus ?? "unknown"}).`
    : !bankComplete
      ? "The seller has no complete bank account on file. Ask them to add it in their portal."
      : holdUntil
        ? `The bank account changed recently; payouts resume at ${formatDateTime(holdUntil)}.`
        : openRequest
          ? "A payout is already waiting for confirmation below. Confirm or reject it first."
          : summary.availableMinor <= 0
            ? "No available balance to pay out."
            : null;

  const review = () => {
    setFormError(null);
    if (amountMinor === null || amountMinor <= 0) return setFormError("Enter an amount in rupees greater than 0 (up to 2 decimals).");
    if (amountMinor > summary.availableMinor) return setFormError(`Amount exceeds the available balance of ${formatCurrency(summary.availableMinor)}.`);
    if (amountMinor > summary.limits.maxSingleMinor) {
      return setFormError(`A single payout can be at most ${formatCurrency(summary.limits.maxSingleMinor)}. Split it or contact a super admin.`);
    }
    setConfirming(true);
  };

  const submit = async () => {
    if (amountMinor === null) return;
    setSaving(true);
    const res = await adminRequest<{ replayed?: boolean }>(`/api/admin/sellers/${sellerId}/payouts`, "POST", {
      amountMinor,
      idempotencyKey,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });
    setSaving(false);
    setConfirming(false);
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    setNotice({
      tone: "success",
      text: `Payout of ${formatCurrency(amountMinor)} requested. A different finance admin must now make the transfer and confirm it.`,
    });
    setAmount("");
    setNotes("");
    setIdempotencyKey(newIdempotencyKey());
    router.refresh();
  };

  const cards: Array<{ label: string; value: number; tone?: string; note?: string }> = [
    { label: "Available to pay", value: summary.availableMinor, tone: "text-emerald-400", note: summary.availableMinor < 0 ? "Negative: refunds exceed credits." : undefined },
    { label: "Awaiting confirmation", value: summary.reservedMinor },
    { label: "In escrow / pending", value: summary.inEscrowMinor + summary.pendingMinor },
    { label: "Held", value: summary.heldMinor },
    {
      label: `Paid out (${summary.payoutCount})`,
      value: summary.paidOutMinor,
      note: summary.reversedPayoutsMinor > 0 ? `${formatCurrency(summary.reversedPayoutsMinor)} of this bounced and was restored.` : undefined,
    },
  ];

  return (
    <section aria-labelledby="payouts-h" className={`${adminCardCls} p-5 space-y-5`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="payouts-h" className="font-bold text-sm text-white flex items-center gap-2">
          <Landmark size={15} className="text-brand-400" aria-hidden="true" /> Settlements & payouts
        </h2>
        <Link href="/admin/payouts" className="text-[11px] font-semibold text-brand-300 hover:text-brand-200">
          Payout queue (all sellers) →
        </Link>
      </div>
      <p className="text-[11px] text-slate-400">
        Payouts are bank transfers made outside WIZZ.PK. One finance admin requests a payout; a different finance admin makes the
        transfer and confirms it with the bank reference. Only confirmed payouts reduce the seller&apos;s balance.
      </p>

      {notice && (
        <AdminAlert tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </AdminAlert>
      )}

      <dl className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <dt className={`text-[11px] font-semibold ${c.tone ?? "text-slate-400"}`}>{c.label}</dt>
            <dd className={`text-lg font-semibold tabular-nums ${c.value < 0 ? "text-rose-300" : "text-white"}`}>{formatCurrency(c.value)}</dd>
            {c.note && <dd className="text-[10px] text-amber-300">{c.note}</dd>}
          </div>
        ))}
      </dl>

      {isFirstParty ? (
        <p className="text-xs text-slate-400">WIZZ.PK Direct is the first-party store and does not receive seller payouts.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              review();
            }}
          >
            <h3 className="text-xs font-bold text-slate-300">Request a payout</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="payout-amount" className={adminLabelCls}>Amount (Rs)</label>
                <input id="payout-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={adminInputCls} disabled={saving || Boolean(blockedReason)} />
              </div>
              <div>
                <label htmlFor="payout-notes" className={adminLabelCls}>Notes (optional)</label>
                <input id="payout-notes" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} className={adminInputCls} disabled={saving || Boolean(blockedReason)} />
              </div>
            </div>
            {formError && <AdminAlert tone="error" onDismiss={() => setFormError(null)}>{formError}</AdminAlert>}
            <button type="submit" className={adminPrimaryBtn} disabled={saving || Boolean(blockedReason)}>
              Request payout
            </button>
            {blockedReason && <p className="text-[11px] text-amber-300">{blockedReason}</p>}
            <p className="text-[10px] text-slate-500">
              Limits: {formatCurrency(summary.limits.maxSingleMinor)} per payout, {summary.limits.maxApprovedPer24h} payouts per seller per 24 hours,
              no payouts for {summary.limits.bankChangeHoldHours} hours after a bank account change.
            </p>
          </form>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2 h-fit">
            <p className="text-[10px] uppercase font-bold text-slate-500">Pay to (seller&apos;s account on file)</p>
            <p className="text-slate-200">{summary.bank.bankName || "Bank not set"}</p>
            <p className="text-slate-200">{summary.bank.bankAccountTitle || "Account title not set"}</p>
            <p className="font-mono text-white">{summary.bank.bankIbanMasked || "IBAN not set"}</p>
            {summary.bank.bankIbanLast4 && <RevealIbanButton sellerId={sellerId} />}
            {holdUntil && (
              <p className="flex gap-1.5 text-amber-300 text-[11px]">
                <ShieldAlert size={13} aria-hidden="true" className="shrink-0 mt-0.5" />
                Changed {summary.bank.bankDetailsChangedAt ? formatDateTime(summary.bank.bankDetailsChangedAt) : "recently"}; payouts paused until {formatDateTime(holdUntil)}.
              </p>
            )}
            {summary.bankChanges.length > 0 && (
              <div className="pt-1 border-t border-slate-800">
                <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">Account changes</p>
                <ul className="space-y-0.5 text-[11px] text-slate-400">
                  {summary.bankChanges.map((c) => (
                    <li key={c.id}>
                      {formatDateTime(c.createdAt)}: •••• {c.previousIbanLast4 ?? "none"} → •••• {c.newIbanLast4 ?? "none"} ({c.changedBy})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-xs font-bold text-slate-300">Payout requests</h3>
        {summary.requests.length === 0 ? (
          <p className="text-xs text-slate-400">No payout requests yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs min-w-[760px]">
              <caption className="sr-only">Payout requests for {sellerName}</caption>
              <thead className="text-[10px] uppercase font-bold text-slate-500 border-b border-slate-800">
                <tr>
                  <th scope="col" className="px-3 py-2">Requested</th>
                  <th scope="col" className="px-3 py-2 text-right">Amount</th>
                  <th scope="col" className="px-3 py-2">Status</th>
                  <th scope="col" className="px-3 py-2">Account</th>
                  <th scope="col" className="px-3 py-2">Bank ref / note</th>
                  <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {summary.requests.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 text-slate-400">
                      <span className="block whitespace-nowrap">{formatDateTime(r.requestedAt)}</span>
                      <span className="block text-[10px] text-slate-500 truncate max-w-[180px]">{r.requestedBy}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-white">{formatCurrency(r.amountMinor)}</td>
                    <td className="px-3 py-2">
                      <PayoutStatusBadge status={r.status} />
                      {r.decidedBy && <span className="block text-[10px] text-slate-500 mt-0.5 truncate max-w-[180px]">by {r.decidedBy}</span>}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-300">•••• {r.bankIbanLast4 ?? "????"}</td>
                    <td className="px-3 py-2 text-slate-300">
                      {r.bankReference && <span className="block font-mono break-all">{r.bankReference}</span>}
                      {r.notes && <span className="block text-[10px] text-slate-500">{r.notes}</span>}
                      {r.decisionNote && <span className="block text-[10px] text-amber-300">{r.decisionNote}</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {!isFirstParty && (
                        <PayoutRequestActions
                          request={{ ...r, sellerName, bankName: summary.bank.bankName }}
                          currentUserId={currentUserId}
                          onDone={(text) => setNotice({ tone: "success", text })}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-bold text-slate-300">Latest ledger entries</h3>
        {summary.entries.length === 0 ? (
          <p className="text-xs text-slate-400">No settlement entries yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs min-w-[640px]">
              <caption className="sr-only">Settlement ledger</caption>
              <thead className="text-[10px] uppercase font-bold text-slate-500 border-b border-slate-800">
                <tr>
                  <th scope="col" className="px-3 py-2">Date</th>
                  <th scope="col" className="px-3 py-2">Type</th>
                  <th scope="col" className="px-3 py-2">Description</th>
                  <th scope="col" className="px-3 py-2 text-right">Amount</th>
                  <th scope="col" className="px-3 py-2">Status</th>
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
        title="Request this payout?"
        description="The amount is reserved now. Nothing is paid until a different finance admin makes the transfer and confirms it."
      >
        <dl className="text-xs grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-slate-400">Seller</dt><dd className="text-white">{sellerName}</dd>
          <dt className="text-slate-400">Amount</dt><dd className="text-white font-bold">{amountMinor !== null ? formatCurrency(amountMinor) : "—"}</dd>
          <dt className="text-slate-400">Account</dt>
          <dd className="text-white">{summary.bank.bankAccountTitle} · <span className="font-mono">{summary.bank.bankIbanMasked}</span></dd>
        </dl>
        <div className="flex justify-end gap-2">
          <button type="button" className={adminSecondaryBtn} onClick={() => setConfirming(false)} disabled={saving}>Cancel</button>
          <button type="button" className={adminPrimaryBtn} onClick={() => void submit()} disabled={saving}>{saving ? "Requesting…" : "Request payout"}</button>
        </div>
      </AdminDialog>
    </section>
  );
}
