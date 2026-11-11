import Link from "next/link";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getSellerInvitation } from "@/modules/sellers/services";
import { AcceptInviteButton } from "./accept-invite-button";

export const metadata: Metadata = {
  title: "Join a seller team",
  robots: { index: false, follow: false },
};

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin (full store access)",
  CATALOG_MANAGER: "Catalog manager (products, prices, stock)",
  FULFILLMENT_MANAGER: "Fulfillment manager (orders, shipping, returns)",
};

export default async function SellerInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [invitation, user] = await Promise.all([getSellerInvitation(token), getCurrentUser()]);
  const here = `/seller/invite/${encodeURIComponent(token)}`;

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-5 text-sm">
        <Link href="/" className="text-xs font-semibold text-slate-500 hover:text-slate-900">
          WIZZ.PK
        </Link>

        {!invitation ? (
          <>
            <h1 className="text-xl font-black text-slate-900">Invitation not available</h1>
            <p className="text-slate-600">
              This invitation link is invalid, was revoked, or has expired. Ask the store owner to send a new one.
            </p>
            <Link href="/" className="inline-block font-bold text-brand-700 hover:underline">
              Go to the store
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-xl font-black text-slate-900">Join {invitation.sellerOrg.name}</h1>
            <p className="text-slate-600">
              You have been invited to the <strong>{invitation.sellerOrg.name}</strong> seller team as{" "}
              <strong>{ROLE_LABELS[invitation.role] || invitation.role}</strong>.
            </p>
            <p className="text-xs text-slate-500">
              Invited email: <span className="font-mono">{invitation.email}</span> · Expires{" "}
              {invitation.expiresAt.toLocaleDateString("en-PK")}
            </p>

            {!user ? (
              <div className="space-y-2">
                <p className="text-slate-600">Sign in or create an account with that email to accept.</p>
                <div className="flex gap-2">
                  <Link
                    href={`/login?next=${encodeURIComponent(here)}`}
                    className="flex-1 text-center rounded-xl bg-brand-700 px-4 py-2.5 font-bold text-white hover:bg-brand-800"
                  >
                    Sign in
                  </Link>
                  <Link
                    href={`/register?next=${encodeURIComponent(here)}`}
                    className="flex-1 text-center rounded-xl border border-slate-300 px-4 py-2.5 font-bold text-slate-800 hover:bg-slate-50"
                  >
                    Create account
                  </Link>
                </div>
              </div>
            ) : user.email.toLowerCase() !== invitation.email.toLowerCase() ? (
              <p className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-amber-900">
                You are signed in as <strong>{user.email}</strong>, but this invitation is for{" "}
                <strong>{invitation.email}</strong>. Sign out and sign in with the invited email.
              </p>
            ) : (
              <AcceptInviteButton token={token} />
            )}
          </>
        )}
      </div>
    </main>
  );
}
