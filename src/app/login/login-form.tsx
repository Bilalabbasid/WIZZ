"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, AlertCircle, ShieldCheck, Info } from "lucide-react";
import { WizzLogo } from "@/components/wizz-logo";

type Step = "password" | "mfa";

function landingFor(role: string, next: string | null, mfaSetupRequired?: boolean) {
  if (mfaSetupRequired) return "/account/security?setup=1";
  return next ?? (role !== "CUSTOMER" ? "/admin" : "/account");
}

export function LoginForm({
  next,
  notice = null,
  defaultEmail = "",
}: {
  next: string | null;
  notice?: string | null;
  defaultEmail?: string;
}) {
  const [step, setStep] = useState<Step>("password");
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Authentication failed.");

      if (data.mfaRequired) {
        setPassword("");
        setStep("mfa");
        setIsLoading(false);
        return;
      }

      // Full navigation so the header and cart re-render with the new session.
      window.location.href = landingFor(data.user.role, next, data.mfaSetupRequired);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Error signing in");
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(useRecovery ? { recoveryCode: code } : { code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.restart) {
          setStep("password");
          setCode("");
        }
        throw new Error(data.error || "That code didn't work.");
      }
      window.location.href = landingFor(data.user.role, next);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "That code didn't work.");
      setIsLoading(false);
    }
  };

  const fillDemo = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-[28px] border border-line/90 p-8 space-y-6 ">
        {/* Brand */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <WizzLogo size="lg" />
          </div>
          <h1 className="text-xl font-bold text-ink">
            {step === "password" ? "Sign in to your account" : "Enter your authenticator code"}
          </h1>
          <p className="text-xs text-mute">
            {step === "password"
              ? "Access your orders, wishlist and saved addresses"
              : useRecovery
                ? "Enter one of the recovery codes you saved when you set up two-factor authentication."
                : "Open your authenticator app and enter the 6-digit code for WIZZ.PK."}
          </p>
        </div>

        {notice && step === "password" && (
          <div role="status" className="p-3 rounded-xl bg-brand-50 border border-brand-200 text-ink-2 text-xs flex items-start gap-2">
            <Info size={15} className="shrink-0 mt-0.5" aria-hidden="true" />
            <span>{notice}</span>
          </div>
        )}

        {errorMessage && (
          <div role="alert" aria-live="assertive" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle size={15} aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        {step === "password" ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              id="login-email"
              label="Email Address"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <div>
              <Input
                id="login-password"
                label="Password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div className="mt-2 text-right">
                <Link href="/forgot-password" className="text-xs font-semibold text-brand-700 hover:underline">
                  Forgot password?
                </Link>
              </div>
            </div>

            <Button type="submit" size="lg" className="w-full" isLoading={isLoading}>
              <Lock size={16} aria-hidden="true" />
              <span>Sign In</span>
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <Input
              key={useRecovery ? "recovery" : "totp"}
              id="login-mfa-code"
              label={useRecovery ? "Recovery code" : "6-digit code"}
              type="text"
              inputMode={useRecovery ? "text" : "numeric"}
              autoComplete="one-time-code"
              autoFocus
              required
              maxLength={useRecovery ? 20 : 6}
              placeholder={useRecovery ? "xxxx-xxxx-xxxx" : "123456"}
              value={code}
              onChange={(e) => setCode(useRecovery ? e.target.value : e.target.value.replace(/\D/g, ""))}
            />
            <Button type="submit" size="lg" className="w-full" isLoading={isLoading}>
              <ShieldCheck size={16} aria-hidden="true" />
              <span>Verify and sign in</span>
            </Button>
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                className="font-semibold text-brand-700 hover:underline min-h-[44px]"
                onClick={() => {
                  setUseRecovery((v) => !v);
                  setCode("");
                  setErrorMessage(null);
                }}
              >
                {useRecovery ? "Use authenticator code" : "Use a recovery code"}
              </button>
              <button
                type="button"
                className="text-mute hover:underline min-h-[44px]"
                onClick={() => {
                  setStep("password");
                  setCode("");
                  setErrorMessage(null);
                }}
              >
                Start over
              </button>
            </div>
          </form>
        )}

        {/* Demo Fast Fill Buttons (Only displayed in development) */}
        {process.env.NODE_ENV !== "production" && step === "password" && (
          <div className="pt-4 border-t border-line-soft space-y-2">
            <span className="block text-[11px] font-bold text-mute-2 tracking-normal text-center">
              Development Quick Fill
            </span>
            <div className="grid grid-cols-3 gap-2 text-[10px]">
              <button
                type="button"
                onClick={() => fillDemo("admin@wizz.pk", "Admin@Wizz2026!")}
                className="p-2 rounded-xl bg-canvas hover:bg-slate-200 font-semibold text-ink-2"
              >
                Super Admin
              </button>
              <button
                type="button"
                onClick={() => fillDemo("customer@wizz.pk", "Customer@Wizz2026!")}
                className="p-2 rounded-xl bg-canvas hover:bg-slate-200 font-semibold text-ink-2"
              >
                Customer
              </button>
              <button
                type="button"
                onClick={() => fillDemo("applicant@craftgear.com", "Seller@Wizz2026!")}
                className="p-2 rounded-xl bg-canvas hover:bg-slate-200 font-semibold text-ink-2"
              >
                Applicant
              </button>
            </div>
          </div>
        )}

        {step === "password" && (
          <div className="text-center text-xs text-mute pt-2">
            Don&apos;t have an account?{" "}
            <Link
              href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"}
              className="font-bold text-brand-700 hover:underline"
            >
              Create an Account
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
