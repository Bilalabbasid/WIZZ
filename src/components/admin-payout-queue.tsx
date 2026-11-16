"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { AdminAlert } from "@/components/admin-dialog";
import { AdminEmptyState } from "@/components/admin-ui";
import { PayoutRequestActions, PayoutStatusBadge, type AdminPayoutRequestView } from "@/components/admin-payout-actions";

/** Cross-seller payout queue: unconfirmed requests first, then history. */
export function AdminPayoutQueue({ requests, currentUserId }: { requests: AdminPayoutRequestView[]; currentUserId: string }) {
  const [notice, setNotice] = useState<string | null>(null);

  if (requests.length === 0) {
    return <AdminEmptyState title="No payout requests" description="Request payouts from a seller's page (Sellers → seller → Settlements & payouts)." />;
  }

  return (
    <div className="space-y-3">
      {notice && <AdminAlert tone="success" onDismiss={() => setNotice(null)}>{notice}</AdminAlert>}

      {/* Cards on small screens */}
      <ul className="md:hidden space-y-3">
        {requests.map((r) => (
          <li key={r.id} className="p-4 rounded-2xl border border-slate-700/80 bg-slate-800/80 space-y-2 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/admin/sellers/${r.sellerOrgId}`} className="font-semibold text-white hover:text-brand-300 truncate block">{r.sellerName}</Link>
                <span className="text-slate-400">{formatDateTime(r.requestedAt)} · {r.requestedBy}</span>
              </div>
              <PayoutStatusBadge status={r.status} />
            </div>
            <p className="text-lg font-black text-white tabular-nums">{formatCurrency(r.amountMinor)}</p>
            <p className="text-slate-300">{r.bankName ?? "Bank"} · <span className="font-mono">•••• {r.bankIbanLast4 ?? "????"}</span></p>
            {r.bankReference && <p className="font-mono text-slate-300 break-all">Ref {r.bankReference}</p>}
            {r.decisionNote && <p className="text-amber-300">{r.decisionNote}</p>}
            <PayoutRequestActions request={r} currentUserId={currentUserId} onDone={setNotice} />
          </li>
        ))}
      </ul>

      {/* Table on md+ */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-700/80 bg-slate-800/80">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">Seller payout requests</caption>
          <thead className="text-[10px] uppercase font-bold text-slate-500 border-b border-slate-700">
            <tr>
              <th scope="col" className="px-4 py-3">Seller</th>
              <th scope="col" className="px-4 py-3 text-right">Amount</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3">Account</th>
              <th scope="col" className="px-4 py-3">Requested</th>
              <th scope="col" className="px-4 py-3">Bank ref / note</th>
              <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/60">
            {requests.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3">
                  <Link href={`/admin/sellers/${r.sellerOrgId}`} className="font-semibold text-white hover:text-brand-300">{r.sellerName}</Link>
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-bold text-white">{formatCurrency(r.amountMinor)}</td>
                <td className="px-4 py-3">
                  <PayoutStatusBadge status={r.status} />
                  {r.decidedBy && <span className="block text-[10px] text-slate-500 mt-0.5">by {r.decidedBy}</span>}
                </td>
                <td className="px-4 py-3 text-slate-300">{r.bankName ?? "—"} · <span className="font-mono">•••• {r.bankIbanLast4 ?? "????"}</span></td>
                <td className="px-4 py-3 text-slate-400">
                  <span className="block whitespace-nowrap">{formatDateTime(r.requestedAt)}</span>
                  <span className="block text-[10px] text-slate-500">{r.requestedBy}</span>
                </td>
                <td className="px-4 py-3 text-slate-300">
                  {r.bankReference && <span className="block font-mono break-all">{r.bankReference}</span>}
                  {r.notes && <span className="block text-[10px] text-slate-500">{r.notes}</span>}
                  {r.decisionNote && <span className="block text-[10px] text-amber-300">{r.decisionNote}</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <PayoutRequestActions request={r} currentUserId={currentUserId} onDone={setNotice} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
