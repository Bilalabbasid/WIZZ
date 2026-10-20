"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { DollarSign, TrendingUp, Building2, Download, RefreshCw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPkr } from "@/lib/formatters";

export default function SellerSettlementsPage() {
  const [statement, setStatement] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStatement();
  }, []);

  const loadStatement = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/seller/settlements");
      const data = await res.json();
      if (res.ok) {
        setStatement(data.statement);
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="p-12 text-center text-xs text-slate-400">Loading settlement statements...</div>;
  }

  if (!statement) {
    return (
      <div className="p-8 bg-slate-50 rounded-2xl text-xs text-slate-500 text-center">
        No settlement statement available.
      </div>
    );
  }

  const { summary, sellerOrg, ledgers } = statement;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Commission & Settlement Ledgers
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Transparent breakdown of gross sales, marketplace commission deductions, and net bank payables.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={loadStatement}>
            <RefreshCw size={14} />
            <span>Refresh</span>
          </Button>

          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Download size={14} />
            <span>Export Statement</span>
          </Button>
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
            Total Gross GMV
          </span>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {formatPkr(summary.totalGrossGmvMinor)}
          </div>
          <span className="text-[11px] text-slate-400">{summary.orderCount} fulfilled packages</span>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
            Platform Fee ({sellerOrg.commissionRatePercent}%)
          </span>
          <div className="text-2xl font-black text-rose-600 tracking-tight">
            -{formatPkr(summary.totalPlatformCommissionMinor)}
          </div>
          <span className="text-[11px] text-slate-400">Fixed marketplace commission</span>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
            Shipping Allowance
          </span>
          <div className="text-2xl font-black text-slate-800 tracking-tight">
            {formatPkr(summary.totalShippingMinor)}
          </div>
          <span className="text-[11px] text-slate-400">Remitted delivery allowance</span>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-emerald-200 shadow-sm space-y-2 bg-emerald-50/20">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 block">
            Net Seller Payable
          </span>
          <div className="text-2xl font-black text-emerald-700 tracking-tight">
            {formatPkr(summary.totalNetPayableMinor)}
          </div>
          <span className="text-[11px] text-emerald-600 font-medium">Ready for bank disbursement</span>
        </div>
      </div>

      {/* Settlement Bank Details Notice */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Building2 size={20} />
          </div>
          <div>
            <span className="font-bold text-slate-900 block text-sm">Nominated Settlement Account</span>
            <span className="text-slate-500">
              Bank: <strong>{sellerOrg.bankName || "Not configured"}</strong> &bull; Title:{" "}
              <strong>{sellerOrg.bankAccountTitle || "Not configured"}</strong> &bull; IBAN:{" "}
              <strong className="font-mono">{sellerOrg.bankIban || "Pending in Settings"}</strong>
            </span>
          </div>
        </div>

        <Link
          href="/seller/portal/profile"
          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline self-start sm:self-auto"
        >
          Update Bank Details
        </Link>
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
              {ledgers.map((l: any) => (
                <div key={l.sellerOrderId} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-xs text-slate-900 block">{l.sellerOrderNumber}</span>
                      <span className="text-[11px] text-slate-400">{new Date(l.createdAt).toLocaleDateString()}</span>
                    </div>
                    <Badge
                      variant={
                        l.settlementStatus === "ELIGIBLE_FOR_PAYOUT"
                          ? "success"
                          : l.settlementStatus === "CANCELLED"
                          ? "danger"
                          : "warning"
                      }
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
                    <span className="font-black text-emerald-700 text-sm">{formatPkr(l.netSellerPayableMinor)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table (Viewports >= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-6">Seller Order #</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Gross Total</th>
                    <th className="py-3 px-4">Fee Rate</th>
                    <th className="py-3 px-4">Commission</th>
                    <th className="py-3 px-4">Net Payable</th>
                    <th className="py-3 px-6 text-right">Settlement State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {ledgers.map((l: any) => (
                    <tr key={l.sellerOrderId} className="hover:bg-slate-50/50 transition">
                      <td className="py-4 px-6 font-mono font-bold text-slate-900">
                        {l.sellerOrderNumber}
                      </td>
                      <td className="py-4 px-4 text-slate-500">
                        {new Date(l.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-4 font-bold text-slate-900">
                        {formatPkr(l.totalMinor)}
                      </td>
                      <td className="py-4 px-4 font-medium text-slate-600">
                        {l.commissionRatePercent}%
                      </td>
                      <td className="py-4 px-4 font-bold text-rose-600">
                        -{formatPkr(l.platformCommissionMinor)}
                      </td>
                      <td className="py-4 px-4 font-black text-emerald-700">
                        {formatPkr(l.netSellerPayableMinor)}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <Badge
                          variant={
                            l.settlementStatus === "ELIGIBLE_FOR_PAYOUT"
                              ? "success"
                              : l.settlementStatus === "CANCELLED"
                              ? "danger"
                              : "warning"
                          }
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
