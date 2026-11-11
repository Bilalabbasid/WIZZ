import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";
import { safeNextPath } from "./safe-next";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next: rawNext } = await searchParams;
  const next = safeNextPath(rawNext, "");
  const user = await getCurrentUser();
  if (user) redirect(next || (user.role !== "CUSTOMER" ? "/admin" : "/account"));
  return <LoginForm next={next || null} />;
}
