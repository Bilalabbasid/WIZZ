"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Copy, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Setup = { otpauthUri: string; secret: string; qrDataUrl: string };

type Phase =
  | { name: "off" }
  | { name: "setup"; setup: Setup }
  | { name: "codes"; codes: string[] }
  | { name: "on" };

function formatSecret(secret: string) {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

/**
 * Two-factor authentication card: enrol with an authenticator app (QR or manual key),
 * show recovery codes once, and turn it off (customers/sellers only).
 */
export function AccountSecurityMfa({
  enabled,
  enabledAt,
  recoveryRemaining,
  isStaff,
  setupRequested,
}: {
  enabled: boolean;
  enabledAt: string | null;
  recoveryRemaining: number;
  isStaff: boolean;
  setupRequested: boolean;
}) {
  const [phase, setPhase] = useState<Phase>(enabled ? { name: "on" } : { name: "off" });
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Disable form
  const [showDisable, setShowDisable] = useState(false);
  const [password, setPassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [disabledMessage, setDisabledMessage] = useState<string | null>(null);

  const post = async (url: string, body?: unknown) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
    return data;
  };

  const startSetup = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await post("/api/auth/mfa/setup");
      setCode("");
      setPhase({ name: "setup", setup: { otpauthUri: data.otpauthUri, secret: data.secret, qrDataUrl: data.qrDataUrl } });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not start set-up.");
    } finally {
      setBusy(false);
    }
  };

  const confirmSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code shown in your authenticator app.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await post("/api/auth/mfa/enable", { code });
      setPhase({ name: "codes", codes: data.recoveryCodes as string[] });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "That code didn't match.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const trimmed = disableCode.trim();
      const isTotp = /^\d{6}$/.test(trimmed);
      await post("/api/auth/mfa/disable", isTotp ? { password, code: trimmed } : { password, recoveryCode: trimmed });
      setPassword("");
      setDisableCode("");
      setShowDisable(false);
      setDisabledMessage("Two-factor authentication is off.");
      setPhase({ name: "off" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not turn off two-factor authentication.");
    } finally {
      setBusy(false);
    }
  };

  const copyCodes = async (codes: string[]) => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section aria-labelledby="mfa-heading" className="bg-white rounded-[20px] border border-line p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="mfa-heading" className="text-base font-bold text-ink flex items-center gap-2">
            <ShieldCheck size={18} className="text-brand-600" aria-hidden="true" />
            <span>Two-factor authentication</span>
          </h2>
          <p className="text-sm text-mute mt-1">
            Sign in with your password and a 6-digit code from an authenticator app (Google Authenticator, Microsoft
            Authenticator, 1Password and similar).
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
            phase.name === "on" || phase.name === "codes" ? "bg-emerald-50 text-emerald-800" : "bg-canvas text-ink-2"
          }`}
        >
          {phase.name === "on" || phase.name === "codes" ? "On" : "Off"}
        </span>
      </div>

      {isStaff && phase.name === "off" && (
        <div role="status" className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
          {setupRequested
            ? "Staff accounts must use two-factor authentication before opening the admin console. Set it up below."
            : "Staff accounts must use two-factor authentication."}
        </div>
      )}

      {disabledMessage && phase.name === "off" && (
        <p role="status" className="text-sm text-emerald-800">
          {disabledMessage}
        </p>
      )}

      {error && (
        <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle size={15} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {phase.name === "off" && (
        <Button type="button" onClick={startSetup} isLoading={busy}>
          {!busy && <ShieldCheck size={15} aria-hidden="true" />}
          <span>Set up two-factor authentication</span>
        </Button>
      )}

      {phase.name === "setup" && (
        <div className="space-y-4">
          <ol className="list-decimal pl-5 text-sm text-ink-2 space-y-1">
            <li>Open your authenticator app and add an account.</li>
            <li>Scan this QR code, or type the key below.</li>
            <li>Enter the 6-digit code the app shows.</li>
          </ol>
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {/* eslint-disable-next-line @next/next/no-img-element -- data: URL generated by our server */}
            <img
              src={phase.setup.qrDataUrl}
              alt="QR code for your authenticator app"
              width={180}
              height={180}
              className="rounded-lg border border-line bg-white"
            />
            <div className="space-y-2 min-w-0">
              <p className="text-xs text-mute">Can&apos;t scan? Enter this key (time-based):</p>
              <code className="block break-all rounded-lg bg-canvas px-3 py-2 text-sm font-mono text-ink select-all">
                {formatSecret(phase.setup.secret)}
              </code>
              <a href={phase.setup.otpauthUri} className="text-xs font-semibold text-brand-700 hover:underline">
                Open in an authenticator app on this device
              </a>
            </div>
          </div>
          <form onSubmit={confirmSetup} className="space-y-3 max-w-xs">
            <Input
              id="mfa-setup-code"
              label="6-digit code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" isLoading={busy}>
                Turn on
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPhase({ name: "off" });
                  setError(null);
                }}
                disabled={busy}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {phase.name === "codes" && (
        <div className="space-y-3">
          <p className="text-sm text-emerald-800 flex items-center gap-2" role="status">
            <CheckCircle2 size={16} aria-hidden="true" />
            <span>Two-factor authentication is on.</span>
          </p>
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 space-y-3">
            <p className="text-sm text-amber-900 font-semibold">
              Save these recovery codes now. They won&apos;t be shown again.
            </p>
            <p className="text-xs text-amber-900">
              Each code works once if you lose your phone. Keep them somewhere safe, like a password manager.
            </p>
            <ul className="grid grid-cols-2 gap-2 font-mono text-sm text-ink">
              {phase.codes.map((c) => (
                <li key={c} className="rounded-md bg-white px-2 py-1 border border-amber-100">
                  {c}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => copyCodes(phase.codes)}>
                <Copy size={14} aria-hidden="true" />
                <span>{copied ? "Copied" : "Copy codes"}</span>
              </Button>
              <Button type="button" size="sm" onClick={() => window.location.reload()}>
                I&apos;ve saved them
              </Button>
            </div>
          </div>
          {isStaff && (
            <Link href="/admin" className="inline-block text-sm font-semibold text-brand-700 hover:underline">
              Continue to the admin console
            </Link>
          )}
        </div>
      )}

      {phase.name === "on" && (
        <div className="space-y-3">
          <dl className="text-sm text-ink-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            {enabledAt && (
              <>
                <dt className="text-mute">Turned on</dt>
                <dd>{enabledAt}</dd>
              </>
            )}
            <dt className="text-mute">Recovery codes left</dt>
            <dd>
              {recoveryRemaining}
              {recoveryRemaining <= 2 && (
                <span className="text-amber-800">
                  {" "}
                  (running low{isStaff ? "; ask a super admin to reset your two-factor set-up" : "; turn two-factor off and on to get new codes"})
                </span>
              )}
            </dd>
          </dl>

          {isStaff ? (
            <p className="text-xs text-mute">
              Required for staff accounts. If you lose your authenticator and recovery codes, a super admin can reset it
              using the server reset procedure.
            </p>
          ) : showDisable ? (
            <form onSubmit={disable} className="space-y-3 max-w-sm">
              <Input
                id="mfa-disable-password"
                label="Your password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Input
                id="mfa-disable-code"
                label="Authenticator code or recovery code"
                autoComplete="one-time-code"
                required
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="danger" isLoading={busy}>
                  {!busy && <ShieldOff size={15} aria-hidden="true" />}
                  <span>Turn off</span>
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowDisable(false)} disabled={busy}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <Button type="button" variant="outline" onClick={() => setShowDisable(true)}>
              <ShieldOff size={15} aria-hidden="true" />
              <span>Turn off two-factor authentication</span>
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
