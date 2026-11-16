import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser, isPlatformRole } from "@/lib/auth";
import { LoginForm } from "./login-form";
import { safeNextPath } from "./safe-next";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; mfa?: string | string[]; reset?: string | string[] }>;
}) {
  const { next: rawNext, mfa, reset } = await searchParams;
  const next = safeNextPath(rawNext, "");
  const user = await getCurrentUser();

  // Staff with two-factor on whose session skipped the code must sign in again here
  // (redirecting them away would loop back from the admin console).
  const needsStepUp = Boolean(user && isPlatformRole(user.role) && user.mfaEnabled && !user.sessionMfa);
  if (user && !needsStepUp) redirect(next || (user.role !== "CUSTOMER" ? "/admin" : "/account"));

  let notice: string | null = null;
  if (needsStepUp || mfa === "1") {
    notice = "For your security, sign in again with your password and authenticator code to open the admin console.";
  } else if (reset === "1") {
    notice = "Your password has been changed. Sign in with your new password.";
  }

  return <LoginForm next={next || null} notice={notice} defaultEmail={needsStepUp ? user!.email : ""} />;
}
