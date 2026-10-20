"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, Lock, AlertCircle, ArrowRight } from "lucide-react";
import { WizzLogo } from "@/components/wizz-logo";

export default function LoginPage() {
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

      if (data.user.role !== "CUSTOMER") {
        window.location.href = "/admin";
      } else {
        window.location.href = "/account";
      }
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200/90 p-8 space-y-6 shadow-xl">
        {/* Brand */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <WizzLogo size="lg" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Sign in to your account</h1>
          <p className="text-xs text-slate-500">
            Access orders, customer wishlist, or platform administration
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
            label="Email Address"
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Input
            label="Password"
            type="password"
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
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">
              Development Quick Fill
            </span>
            <div className="grid grid-cols-3 gap-2 text-[10px]">
              <button
                type="button"
                onClick={() => fillDemo("admin@wizz.pk", "Admin@Wizz2026!")}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-semibold text-slate-700"
              >
                Super Admin
              </button>
              <button
                type="button"
                onClick={() => fillDemo("customer@wizz.pk", "Customer@Wizz2026!")}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-semibold text-slate-700"
              >
                Customer
              </button>
              <button
                type="button"
                onClick={() => fillDemo("applicant@craftgear.com", "Seller@Wizz2026!")}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-semibold text-slate-700"
              >
                Applicant
              </button>
            </div>
          </div>
        )}

        <div className="text-center text-xs text-slate-500 pt-2">
          Don't have an account?{" "}
          <Link href="/register" className="font-bold text-indigo-600 hover:underline">
            Create an Account
          </Link>
        </div>
      </div>
    </div>
  );
}
