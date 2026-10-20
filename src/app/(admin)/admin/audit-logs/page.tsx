import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";
import { History, ShieldCheck } from "lucide-react";

export default async function AdminAuditLogsPage() {
  const auditLogs = await prisma.auditEvent.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
    include: {
      actorUser: { select: { email: true, firstName: true, lastName: true } },
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
          Compliance & Security
        </span>
        <h1 className="text-3xl font-black tracking-tight text-white mt-1">
          Platform Audit Trails
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Immutable ledger recording administrative status changes, inventory adjustments, and decisions.
        </p>
      </div>

      <div className="bg-slate-800/80 rounded-3xl border border-slate-700/80 p-6 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-700">
          <History size={16} className="text-indigo-400" />
          <h3 className="font-bold text-sm text-white">Latest Event Records ({auditLogs.length})</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-700">
              <tr>
                <th className="pb-3">Timestamp</th>
                <th className="pb-3">Actor</th>
                <th className="pb-3">Target Entity</th>
                <th className="pb-3">Action</th>
                <th className="pb-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td className="py-3 text-slate-400 whitespace-nowrap">
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td className="py-3 font-semibold text-white">
                    {log.actorUser ? `${log.actorUser.firstName} (${log.actorUser.email})` : "System / Automated"}
                  </td>
                  <td className="py-3 text-slate-300">
                    <span className="font-mono text-[11px]">{log.entityType}</span>: {log.entityId}
                  </td>
                  <td className="py-3">
                    <Badge variant="neutral" size="sm">
                      {log.action}
                    </Badge>
                  </td>
                  <td className="py-3 text-slate-400 font-mono text-[11px] max-w-sm truncate">
                    {log.detailsJson}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
