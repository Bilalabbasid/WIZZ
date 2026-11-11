"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { AdminAlert, adminRequest, minorToRupeesInput, rupeesToMinor } from "@/components/admin-dialog";
import { AdminBadge, adminCardCls, adminInputCls, adminLabelCls, adminPrimaryBtn } from "@/components/admin-ui";

export interface AdminSettingRow {
  key: string;
  label: string;
  description: string;
  category: string;
  isPublic: boolean;
  kind: "money" | "percent" | "integer" | "email" | "text";
  wired: boolean;
  effectiveSource: string;
  effectiveValue: string | number | null;
  storedValue: unknown;
  updatedAt: string | null;
}

function display(kind: AdminSettingRow["kind"], v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (kind === "money" && typeof v === "number") return formatCurrency(v);
  if (kind === "percent" && typeof v === "number") return `${v}%`;
  return String(v);
}

function initialInput(s: AdminSettingRow): string {
  if (s.storedValue === null || s.storedValue === undefined) return "";
  if (s.kind === "money" && typeof s.storedValue === "number") return minorToRupeesInput(s.storedValue);
  return String(s.storedValue);
}

function SettingRow({ setting }: { setting: AdminSettingRow }) {
  const router = useRouter();
  const [value, setValue] = useState(initialInput(setting));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const inputId = `setting-${setting.key}`;

  const toPayloadValue = (): { ok: true; value: string | number } | { ok: false; error: string } => {
    const v = value.trim();
    if (setting.kind === "money") {
      const minor = rupeesToMinor(v);
      return minor === null ? { ok: false, error: "Enter a rupee amount, e.g. 3000 or 249.50." } : { ok: true, value: minor };
    }
    if (setting.kind === "percent" || setting.kind === "integer") {
      return /^\d+$/.test(v) ? { ok: true, value: Number(v) } : { ok: false, error: "Enter a whole number." };
    }
    return { ok: true, value: v };
  };

  const save = async () => {
    const parsed = toPayloadValue();
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(null);
    const res = await adminRequest("/api/admin/settings", "PUT", { key: setting.key, value: parsed.value });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSaved(setting.wired ? "Saved. In force from the next checkout or request." : "Saved. Stored only — the site uses the environment variable, not this value.");
    router.refresh();
  };

  return (
    <li className={`${adminCardCls} p-4 sm:p-5`}>
      <form
        className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="space-y-2 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-white">{setting.label}</h3>
            {setting.wired ? <AdminBadge tone="success">Applied</AdminBadge> : <AdminBadge tone="warning">Stored only — not used by the site</AdminBadge>}
            <AdminBadge tone="neutral">{setting.category}</AdminBadge>
          </div>
          <p className="text-xs text-slate-400">{setting.description}</p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
              <dt className="text-[10px] uppercase font-bold text-emerald-400">In effect now</dt>
              <dd className="text-white font-semibold">{display(setting.kind, setting.effectiveValue)}</dd>
              <dd className="text-[10px] text-slate-500 break-words">{setting.effectiveSource}</dd>
            </div>
            <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
              <dt className="text-[10px] uppercase font-bold text-slate-400">Stored value</dt>
              <dd className="text-white font-semibold">{display(setting.kind, setting.storedValue)}</dd>
              <dd className="text-[10px] text-slate-500 font-mono">
                {setting.key}
                {setting.updatedAt ? ` · updated ${formatDateTime(setting.updatedAt)}` : " · not set"}
              </dd>
            </div>
          </dl>
        </div>
        <div className="lg:w-64 space-y-2 self-end">
          <label htmlFor={inputId} className={adminLabelCls}>
            {setting.label}: {setting.kind === "money" ? "new value (Rs)" : setting.kind === "percent" ? "new value (%)" : "new value"}
          </label>
          <input
            id={inputId}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode={setting.kind === "money" ? "decimal" : setting.kind === "percent" || setting.kind === "integer" ? "numeric" : undefined}
            type={setting.kind === "email" ? "email" : "text"}
            className={adminInputCls}
            disabled={saving}
          />
          <button type="submit" className={`${adminPrimaryBtn} w-full`} disabled={saving || value.trim() === initialInput(setting)}>
            {saving ? "Saving…" : setting.wired ? "Save" : "Save (stored only)"}
          </button>
        </div>
        {(error || saved) && (
          <div className="lg:col-span-2">
            {error && <AdminAlert tone="error" onDismiss={() => setError(null)}>{error}</AdminAlert>}
            {saved && <AdminAlert tone={setting.wired ? "success" : "info"} onDismiss={() => setSaved(null)}>{saved}</AdminAlert>}
          </div>
        )}
      </form>
    </li>
  );
}

export function AdminSettingsEditor({ settings }: { settings: AdminSettingRow[] }) {
  return (
    <ul className="space-y-3">
      {settings.map((s) => (
        <SettingRow key={s.key} setting={s} />
      ))}
    </ul>
  );
}
