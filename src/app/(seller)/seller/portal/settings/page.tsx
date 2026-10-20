"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Settings, ShieldCheck, Clock, FileText, CheckCircle2, UserCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function SellerSettingsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAudit();
  }, []);

  const loadAudit = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/seller/audit");
      const data = await res.json();
      if (res.ok) {
        setLogs(data.logs || []);
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Settings & Audit History
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable log of merchant operations, administrative actions, catalog modifications, and compliance events.
          </p>
        </div>

        <Button size="sm" variant="ghost" onClick={loadAudit}>
          <RefreshCw size={14} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Quick Settings Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-2">
          <h2 className="text-sm font-bold text-slate-900">Store Profile & Logistics</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Configure warehouse street pickup address, store brand details, and contact lines.
          </p>
          <div className="pt-2">
            <Link
              href="/seller/portal/profile"
              className="text-xs font-bold text-indigo-600 hover:underline"
            >
              Manage Store Profile &rarr;
            </Link>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-2">
          <h2 className="text-sm font-bold text-slate-900">KYC Verification Dossier</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Review legal incorporation documents, tax registrations, and administrative feedback.
          </p>
          <div className="pt-2">
            <Link
              href="/seller/onboarding"
              className="text-xs font-bold text-indigo-600 hover:underline"
            >
              Open Onboarding Workspace &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Audit Trail Log */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900">Organization Audit Trail</h2>
          </div>
          <span className="text-xs text-slate-400">Strictly Scoped & Immutable</span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading audit history...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center space-y-2 text-xs text-slate-400">
            <Clock size={28} className="mx-auto text-slate-300" />
            <span>No logged actions yet.</span>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {logs.map((log) => {
              let details: any = {};
              try {
                details = JSON.parse(log.detailsJson);
              } catch {
                details = { raw: log.detailsJson };
              }

              return (
                <div key={log.id} className="p-5 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                        {log.action}
                      </span>
                      <span className="text-slate-400">&bull;</span>
                      <span className="font-semibold text-slate-700">
                        {log.entityType} #{log.entityId.slice(-8)}
                      </span>
                    </div>

                    <p className="text-slate-500 font-mono text-[11px] truncate max-w-lg">
                      {JSON.stringify(details)}
                    </p>

                    <div className="text-[11px] text-slate-400">
                      Actor:{" "}
                      <strong className="text-slate-600">
                        {log.actorUser ? `${log.actorUser.firstName} (${log.actorUser.email})` : "System"}
                      </strong>
                    </div>
                  </div>

                  <span className="text-[11px] text-slate-400 font-mono whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
