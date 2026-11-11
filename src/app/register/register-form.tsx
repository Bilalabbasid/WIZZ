"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPlus, AlertCircle } from "lucide-react";
import { normalizePakistanPhone } from "@/lib/validation";
import { WizzLogo } from "@/components/wizz-logo";

export function RegisterForm({ next }: { next: string | null }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    // Same rules as the server (registrationSchema) so most mistakes are caught instantly.
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = "Enter your first name.";
    if (!lastName.trim()) errs.lastName = "Enter your last name.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = "Enter a valid email address.";
    if (password.length < 10) errs.password = "Password must be at least 10 characters.";
    else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) errs.password = "Password must include letters and numbers.";
    if (phone.trim() && !normalizePakistanPhone(phone)) {
      errs.phone = "Enter a valid Pakistani phone number, e.g. 0300 1234567.";
    }
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      setErrorMessage("Please fix the highlighted fields.");
      return;
    }
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          password,
          phone: phone || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.fieldErrors && typeof data.fieldErrors === "object") setFieldErrors(data.fieldErrors);
        throw new Error(data.error || "Registration failed.");
      }

      window.location.href = next ?? "/account";
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Error creating account");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-[28px] border border-line/90 p-8 space-y-6 ">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <WizzLogo size="lg" />
          </div>
          <h1 className="text-xl font-bold text-ink">Create your account</h1>
          <p className="text-xs text-mute">
            Track orders, save addresses and keep a wishlist
          </p>
        </div>

        {errorMessage && (
          <div role="alert" aria-live="assertive" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="reg-firstName"
              label="First Name"
              autoComplete="given-name"
              error={fieldErrors.firstName}
              required
              placeholder="Jane"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <Input
              id="reg-lastName"
              label="Last Name"
              autoComplete="family-name"
              error={fieldErrors.lastName}
              required
              placeholder="Doe"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>

          <Input
            id="reg-email"
            label="Email Address"
            type="email"
            autoComplete="email"
            error={fieldErrors.email}
            required
            placeholder="jane@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Input
            id="reg-password"
            label="Password"
            type="password"
            autoComplete="new-password"
            error={fieldErrors.password}
            helperText="At least 10 characters, with letters and numbers."
            required
            minLength={10}
            placeholder="At least 10 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Input
            id="reg-phone"
            label="Phone (Optional)"
            type="tel"
            autoComplete="tel"
            error={fieldErrors.phone}
            placeholder="0300 1234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <Button type="submit" size="lg" className="w-full" isLoading={isLoading}>
            <UserPlus size={16} />
            <span>Create Account</span>
          </Button>
        </form>

        <div className="text-center text-xs text-mute pt-2">
          Already have an account?{" "}
          <Link
            href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
            className="font-bold text-brand-700 hover:underline"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
