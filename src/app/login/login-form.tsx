"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, AlertCircle } from "lucide-react";
import { WizzLogo } from "@/components/wizz-logo";

export function LoginForm({ next }: { next: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Authentication failed.");

      // Full navigation so the header and cart re-render with the new session.
      window.location.href = next ?? (data.user.role !== "CUSTOMER" ? "/admin" : "/account");
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Error signing in");
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
          <h1 className="text-xl font-bold text-ink">Sign in to your account</h1>
          <p className="text-xs text-mute">
            Access your orders, wishlist and saved addresses
          </p>
        </div>

        {errorMessage && (
          <div role="alert" aria-live="assertive" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{errorMessage}</span>
          </div>
        )}

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

          <Button type="submit" size="lg" className="w-full" isLoading={isLoading}>
            <Lock size={16} />
            <span>Sign In</span>
          </Button>
        </form>

        {/* Demo Fast Fill Buttons (Only displayed in development) */}
        {process.env.NODE_ENV !== "production" && (
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

        <div className="text-center text-xs text-mute pt-2">
          Don&apos;t have an account?{" "}
          <Link
            href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"}
            className="font-bold text-brand-700 hover:underline"
          >
            Create an Account
          </Link>
        </div>
      </div>
    </div>
  );
}
