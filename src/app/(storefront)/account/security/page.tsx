import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { ChevronLeft, MailCheck } from "lucide-react";
import { getCurrentUser, isPlatformRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/formatters";
import { AccountPasswordForm } from "@/components/account-password-form";
import { AccountSecurityMfa } from "@/components/account-security-mfa";
import { AccountSecuritySignOutAll } from "@/components/account-security-signout-all";
import { AccountSecurityVerifyEmail } from "@/components/account-security-verify-email";
import { recoveryCodesRemaining } from "@/app/api/auth/_lib/mfa";

export const metadata: Metadata = {
  title: "Account security",
  robots: { index: false, follow: false },
};

/**
 * Password, two-factor authentication, sessions and email verification.
 * Deliberately usable from a session without two-factor so staff can enrol here
 * before the admin console lets them in.
 */
export default async function AccountSecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string | string[] }>;
}) {
  await connection();
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/account/security");
  }
  const { setup } = await searchParams;

  const security = await prisma.user.findUnique({
    where: { id: user.id },
    select: { mfaEnabled: true, mfaEnabledAt: true, mfaRecoveryHashesJson: true, passwordChangedAt: true },
  });
  const isStaff = isPlatformRole(user.role);

  return (
    <div className="mx-auto w-full max-w-[860px] px-5 sm:px-10 py-8 sm:py-10 space-y-6">
      <div className="space-y-2">
        <Link
          href={isStaff && user.sessionMfa ? "/admin" : "/account"}
          className="inline-flex items-center gap-1 text-sm text-mute hover:text-ink min-h-[44px]"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          <span>{isStaff && user.sessionMfa ? "Admin console" : "Your account"}</span>
        </Link>
        <h1 className="text-2xl font-semibold text-ink tracking-tight">Account security</h1>
        <p className="text-sm text-mute break-all">{user.email}</p>
      </div>

      <section aria-labelledby="email-heading" className="bg-white rounded-[20px] border border-line p-6 space-y-3">
        <h2 id="email-heading" className="text-base font-bold text-ink">
          Email address
        </h2>
        {user.isEmailVerified ? (
          <p className="text-sm text-emerald-800 flex items-center gap-2">
            <MailCheck size={16} aria-hidden="true" />
            <span>Verified</span>
          </p>
        ) : (
          <AccountSecurityVerifyEmail email={user.email} compact />
        )}
      </section>

      <AccountSecurityMfa
        enabled={Boolean(security?.mfaEnabled)}
        enabledAt={security?.mfaEnabledAt ? formatDateTime(security.mfaEnabledAt) : null}
        recoveryRemaining={recoveryCodesRemaining(security?.mfaRecoveryHashesJson ?? null)}
        isStaff={isStaff}
        setupRequested={setup === "1"}
      />

      <div className="space-y-2">
        <AccountPasswordForm />
        <p className="text-xs text-mute px-1">
          Changing your password signs you out on your other devices.
          {security?.passwordChangedAt ? ` Last changed ${formatDateTime(security.passwordChangedAt)}.` : ""}
        </p>
      </div>

      <AccountSecuritySignOutAll />
    </div>
  );
}
