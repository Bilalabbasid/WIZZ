"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Download, RefreshCw, ShieldAlert, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPkr } from "@/lib/formatters";

type Minor = number | bigint;

interface SettlementLedger {
  sellerOrderId: string;
  sellerOrderNumber: string;
  createdAt: string;
  commissionRatePercent: number;
  totalMinor: Minor;
  platformCommissionMinor: Minor;
  netSellerPayableMinor: Minor;
  settlementStatus: string;
}

interface Balances {
  pendingMinor: number;
  inEscrowMinor: number;
  heldMinor: number;
  availableMinor: number;
  reservedMinor: number;
  paidOutMinor: number;
  reversedPayoutsMinor: number;
}

interface PayoutRow {
  id: string;
  amountMinor: number;
  status: "PROCESSING" | "PAID" | "FAILED";
  requestedAt: string;
  paidAt: string | null;
  reference: string | null;
  bankIbanLast4: string | null;
}

interface SettlementStatement {
  summary: {
    orderCount: number;
    totalGrossGmvMinor: Minor;
    totalPlatformCommissionMinor: Minor;
    totalShippingMinor: Minor;
    totalNetPayableMinor: Minor;
  };
  balances: Balances;
  sellerOrg: {
    commissionRatePercent: number;
    bankName?: string | null;
    bankAccountTitle?: string | null;
    /** Masked ("•••• 1234") */
    bankIban?: string | null;
    payoutHoldUntil?: string | null;
    payoutHoldHours: number;
  };
  ledgers: SettlementLedger[];
  payouts: PayoutRow[];
}

const PAYOUT_BADGE: Record<PayoutRow["status"], { label: string; variant: "success" | "warning" | "danger" }> = {
  PAID: { label: "Paid", variant: "success" },
  PROCESSING: { label: "Being transferred", variant: "warning" },
  FAILED: { label: "Returned by bank", variant: "danger" },
};

function formatWhen(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" });
}

export default function SellerSettlementsPage() {
  const [statement, setStatement] = useState<SettlementStatement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStatement = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/seller/settlements", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load your statement.");
      setStatement(data.statement);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load your statement.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(loadStatement);
  }, []);

  if (isLoading) {
    return <div className="p-12 text-center text-xs text-slate-400" role="status">Loading settlement statements...</div>;
  }

  if (!statement) {
    return (
      <div className="p-8 bg-slate-50 rounded-2xl text-xs text-slate-500 text-center space-y-3" role={error ? "alert" : undefined}>
        <p>{error || "No settlement statement available."}</p>
        <Button size="sm" variant="outline" onClick={loadStatement}>Try again</Button>
      </div>
    );
  }

  const { summary, sellerOrg, ledgers, balances, payouts } = statement;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            Commission & Settlement Ledgers
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Your balance, payouts from WIZZ.PK, and the per-order breakdown of sales and commission.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={loadStatement}>
            <RefreshCw size={14} aria-hidden="true" />
            <span>Refresh</span>
          </Button>

          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Download size={14} aria-hidden="true" />
            <span>Export Statement</span>
          </Button>
        </div>
      </div>

      {/* Balance overview (same figures WIZZ.PK finance sees) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-emerald-200 shadow-sm space-y-1 bg-emerald-50/20">
          <span className="text-[11px] font-bold font-mono uppercase tracking-[0.06em] text-emerald-800 block">Available balance</span>
          <div className={`text-2xl font-semibold tracking-tight ${balances.availableMinor < 0 ? "text-rose-600" : "text-emerald-700"}`}>
            {formatPkr(balances.availableMinor)}
          </div>
          <span className="text-[11px] text-emerald-700">
            {balances.availableMinor < 0 ? "Refunds exceed credits; deducted from future sales" : "Delivered orders, after refunds"}
          </span>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-1">
          <span className="text-[11px] font-bold font-mono uppercase tracking-[0.06em] text-slate-500 block">Being transferred</span>
          <div className="text-2xl font-semibold text-slate-900 tracking-tight">{formatPkr(balances.reservedMinor)}</div>
          <span className="text-[11px] text-slate-400">Scheduled payouts</span>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-1">
          <span className="text-[11px] font-bold font-mono uppercase tracking-[0.06em] text-slate-500 block">In escrow</span>
          <div className="text-2xl font-semibold text-slate-900 tracking-tight">{formatPkr(balances.inEscrowMinor + balances.pendingMinor)}</div>
          <span className="text-[11px] text-slate-400">
            Paid, not yet delivered{balances.heldMinor ? ` · ${formatPkr(balances.heldMinor)} on hold` : ""}
          </span>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-1">
          <span className="text-[11px] font-bold font-mono uppercase tracking-[0.06em] text-slate-500 block">Paid to you</span>
          <div className="text-2xl font-semibold text-slate-900 tracking-tight">{formatPkr(balances.paidOutMinor - balances.reversedPayoutsMinor)}</div>
          <span className="text-[11px] text-slate-400">All-time bank transfers</span>
        </div>
      </div>

      {/* Settlement bank account */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-3 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
              <Building2 size={20} aria-hidden="true" />
            </div>
            <div>
              <span className="font-bold text-slate-900 block text-sm">Payout account</span>
              <span className="text-slate-500">
                Bank: <strong>{sellerOrg.bankName || "Not configured"}</strong> &bull; Title:{" "}
                <strong>{sellerOrg.bankAccountTitle || "Not configured"}</strong> &bull; IBAN:{" "}
                <strong className="font-mono">{sellerOrg.bankIban || "Not configured"}</strong>
              </span>
            </div>
          </div>
          <Link
            href="/seller/portal/profile"
            className="text-xs font-bold text-brand-600 hover:text-brand-800 underline self-start sm:self-auto"
          >
            Change bank account
          </Link>
        </div>
        {sellerOrg.payoutHoldUntil && (
          <p className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2">
            <ShieldAlert size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
            <span>Your payout account was changed recently. Payouts are paused until <strong>{formatWhen(sellerOrg.payoutHoldUntil)}</strong>.</span>
          </p>
        )}
        <p className="flex items-start gap-2 text-slate-500">
          <Info size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            WIZZ.PK finance pays your available balance by bank transfer; there is no withdrawal button. Each payout is checked by two
            finance staff. Payouts pause for {sellerOrg.payoutHoldHours} hours after the payout account changes.
          </span>
        </p>
      </div>

      {/* Payout history */}
      <section aria-labelledby="payouts-h" className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 id="payouts-h" className="text-sm font-bold text-slate-900">Payout history</h2>
          <p className="text-xs text-slate-500 mt-0.5">Bank transfers from WIZZ.PK to your account</p>
        </div>
        {payouts.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400">No payouts yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[560px]">
              <caption className="sr-only">Payout history</caption>
              <thead className="bg-slate-50 text-slate-500 font-bold font-mono uppercase tracking-[0.06em]">
                <tr>
                  <th scope="col" className="py-3 px-6">Date</th>
                  <th scope="col" className="py-3 px-4">Amount</th>
                  <th scope="col" className="py-3 px-4">Account</th>
                  <th scope="col" className="py-3 px-4">Bank reference</th>
                  <th scope="col" className="py-3 px-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {payouts.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 px-6 whitespace-nowrap">{formatWhen(p.paidAt ?? p.requestedAt)}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{formatPkr(p.amountMinor)}</td>
                    <td className="py-3 px-4 font-mono">{p.bankIbanLast4 ? `•••• ${p.bankIbanLast4}` : "—"}</td>
                    <td className="py-3 px-4 font-mono break-all">{p.reference || "—"}</td>
                    <td className="py-3 px-6 text-right">
                      <Badge variant={PAYOUT_BADGE[p.status].variant} size="sm">{PAYOUT_BADGE[p.status].label}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Sales totals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-2">
          <span className="text-xs font-bold font-mono uppercase tracking-[0.06em] text-slate-500 block">Total Gross GMV</span>
          <div className="text-2xl font-semibold text-slate-900 tracking-tight">{formatPkr(summary.totalGrossGmvMinor)}</div>
          <span className="text-[11px] text-slate-400">{summary.orderCount} packages</span>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-2">
          <span className="text-xs font-bold font-mono uppercase tracking-[0.06em] text-slate-500 block">Platform Fee ({sellerOrg.commissionRatePercent}%)</span>
          <div className="text-2xl font-semibold text-rose-600 tracking-tight">-{formatPkr(summary.totalPlatformCommissionMinor)}</div>
          <span className="text-[11px] text-slate-400">Marketplace commission</span>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-2">
          <span className="text-xs font-bold font-mono uppercase tracking-[0.06em] text-slate-500 block">Shipping Allowance</span>
          <div className="text-2xl font-semibold text-slate-800 tracking-tight">{formatPkr(summary.totalShippingMinor)}</div>
          <span className="text-[11px] text-slate-400">Delivery charges collected</span>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-2">
          <span className="text-xs font-bold font-mono uppercase tracking-[0.06em] text-slate-500 block">Net Seller Earnings</span>
          <div className="text-2xl font-semibold text-slate-900 tracking-tight">{formatPkr(summary.totalNetPayableMinor)}</div>
          <span className="text-[11px] text-slate-400">All non-cancelled packages, before refunds</span>
        </div>
      </div>

      {/* Ledgers Breakdown Table */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Per-Order Settlement Statement</h2>
            <p className="text-xs text-slate-500 mt-0.5">Itemized calculations and escrow status</p>
          </div>
          <span className="text-xs text-slate-400 font-mono">Currency: PKR</span>
        </div>

        {ledgers.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">No transactions recorded yet.</div>
        ) : (
          <div>
            {/* Mobile Cards (Viewports < md) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {ledgers.map((l) => (
                <div key={l.sellerOrderId} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-xs text-slate-900 block">{l.sellerOrderNumber}</span>
                      <span className="text-[11px] text-slate-400">{new Date(l.createdAt).toLocaleDateString()}</span>
                    </div>
                    <Badge
                      variant={l.settlementStatus === "ELIGIBLE_FOR_PAYOUT" ? "success" : l.settlementStatus === "CANCELLED" ? "danger" : "warning"}
                      size="sm"
                    >
                      {l.settlementStatus.replace(/_/g, " ")}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase font-bold">Gross Total</span>
                      <span className="font-bold text-slate-900">{formatPkr(l.totalMinor)}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase font-bold">Commission ({l.commissionRatePercent}%)</span>
                      <span className="font-bold text-rose-600">-{formatPkr(l.platformCommissionMinor)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                    <span className="font-bold text-slate-600">Net Seller Payout:</span>
                    <span className="font-semibold text-emerald-700 text-sm">{formatPkr(l.netSellerPayableMinor)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table (Viewports >= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <caption className="sr-only">Per-order settlement statement</caption>
                <thead className="bg-slate-50 text-slate-500 font-bold font-mono uppercase tracking-[0.06em]">
                  <tr>
                    <th scope="col" className="py-3 px-6">Seller Order #</th>
                    <th scope="col" className="py-3 px-4">Date</th>
                    <th scope="col" className="py-3 px-4">Gross Total</th>
                    <th scope="col" className="py-3 px-4">Fee Rate</th>
                    <th scope="col" className="py-3 px-4">Commission</th>
                    <th scope="col" className="py-3 px-4">Net Payable</th>
                    <th scope="col" className="py-3 px-6 text-right">Settlement State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {ledgers.map((l) => (
                    <tr key={l.sellerOrderId} className="hover:bg-slate-50/50 transition">
                      <td className="py-4 px-6 font-mono font-bold text-slate-900">{l.sellerOrderNumber}</td>
                      <td className="py-4 px-4 text-slate-500">{new Date(l.createdAt).toLocaleDateString()}</td>
                      <td className="py-4 px-4 font-bold text-slate-900">{formatPkr(l.totalMinor)}</td>
                      <td className="py-4 px-4 font-medium text-slate-600">{l.commissionRatePercent}%</td>
                      <td className="py-4 px-4 font-bold text-rose-600">-{formatPkr(l.platformCommissionMinor)}</td>
                      <td className="py-4 px-4 font-semibold text-emerald-700">{formatPkr(l.netSellerPayableMinor)}</td>
                      <td className="py-4 px-6 text-right">
                        <Badge
                          variant={l.settlementStatus === "ELIGIBLE_FOR_PAYOUT" ? "success" : l.settlementStatus === "CANCELLED" ? "danger" : "warning"}
                          size="sm"
                        >
                          {l.settlementStatus.replace(/_/g, " ")}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
