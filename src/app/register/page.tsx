import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { RegisterForm } from "./register-form";
import { safeNextPath } from "../login/safe-next";

export const metadata: Metadata = {
  title: "Create an account",
  robots: { index: false, follow: false },
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next: rawNext } = await searchParams;
  const next = safeNextPath(rawNext, "");
  const user = await getCurrentUser();
  if (user) redirect(next || "/account");
  return <RegisterForm next={next || null} />;
}
