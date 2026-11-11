import { requireAdminPage } from "@/modules/admin/access";
import { getSettingsForAdmin } from "@/modules/admin/settings";
import { AdminPageHeader } from "@/components/admin-ui";
import { AdminSettingsEditor } from "@/components/admin-settings-editor";

export default async function AdminSettingsPage() {
  await requireAdminPage("settings", "/admin/settings");
  const data = await getSettingsForAdmin();
  const wiredCount = data.known.filter((k) => k.wired).length;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Platform"
        title="Marketplace Settings"
        description="Stored platform settings, validated per key. Each row shows what actually controls the behaviour today."
      />

      <div role="note" className="p-4 rounded-xl border border-sky-500/40 bg-sky-950/50 text-sky-100 text-sm space-y-1">
        <p className="font-bold">
          {wiredCount} of {data.known.length} settings are applied by the running store.
        </p>
        <p className="text-xs text-sky-200/90">
          Shipping fees, the free-shipping threshold and the COD limit apply to new checkouts immediately; the return window applies to
          new return requests; the default commission applies to sellers approved or registered after the change (existing sellers keep
          their own rate, editable on each seller&apos;s page). Orders already placed are never repriced. Values marked &ldquo;Stored only&rdquo;
          (support email and phone) are governed by environment variables and saving them has no effect on the site.
        </p>
      </div>

      <AdminSettingsEditor settings={data.known} />

      {data.other.length > 0 && (
        <section aria-labelledby="other-h" className="space-y-2">
          <h2 id="other-h" className="text-sm font-bold text-white">Other stored keys (read-only, no editor)</h2>
          <div className="bg-slate-800/80 rounded-2xl border border-slate-700/80 overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[560px]">
              <thead className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-700">
                <tr>
                  <th scope="col" className="px-4 py-3">Key</th>
                  <th scope="col" className="px-4 py-3">Category</th>
                  <th scope="col" className="px-4 py-3">Value (JSON)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {data.other.map((o) => (
                  <tr key={o.key}>
                    <td className="px-4 py-3 font-mono text-slate-200">{o.key}</td>
                    <td className="px-4 py-3 text-slate-400">{o.category}</td>
                    <td className="px-4 py-3 font-mono text-slate-300 break-all">{o.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
