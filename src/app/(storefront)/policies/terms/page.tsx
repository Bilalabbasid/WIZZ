import type { Metadata } from "next";
import Link from "next/link";
import { SITE_CONFIG } from "@/lib/config";
import { getCommerceSettings } from "@/lib/commerce-settings";
import { formatCurrency } from "@/lib/formatters";
import { PolicySection, PolicyShell } from "../_components/policy-shell";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The terms for shopping and selling on WIZZ.PK.",
  alternates: { canonical: `${SITE_CONFIG.canonicalUrl}/policies/terms` },
};

export default async function TermsPage() {
  const { codMaxOrderMinor, returnWindowDays } = await getCommerceSettings();

  return (
    <PolicyShell
      current="/policies/terms"
      eyebrow="Terms of service"
      title="The terms for using WIZZ.PK."
      intro={<p>By using WIZZ.PK, shopping or applying to sell, you agree to these terms. They are pending legal review.</p>}
    >
      <PolicySection number={1} title="The marketplace">
        <p>
          WIZZ.PK sells new products from approved sellers, including its own store, WIZZ.PK Direct. Each product page
          shows who sells it.
        </p>
      </PolicySection>

      <PolicySection number={2} title="Prices, stock and checkout">
        <p>
          Prices are in Pakistani rupees. Totals, discounts and delivery fees are calculated when you check out. Stock is
          held for {SITE_CONFIG.reservationExpiryMinutes} minutes while you complete checkout, then released.
        </p>
        <p>Cash on delivery is available for orders up to {formatCurrency(codMaxOrderMinor)}.</p>
      </PolicySection>

      <PolicySection number={3} title="Cancellations and returns">
        <p>
          You can cancel until a package has shipped. Delivered items can be returned within {returnWindowDays} days, as
          described in the{" "}
          <Link href="/policies/returns" className="underline underline-offset-4">
            returns policy
          </Link>
          .
        </p>
      </PolicySection>

      <PolicySection number={4} title="Your account">
        <p>Keep your sign-in details private. You are responsible for orders placed from your account.</p>
      </PolicySection>

      <PolicySection number={5} title="Sellers">
        <p>
          Sellers must apply and be approved before listing, and each product is reviewed before it goes live. WIZZ.PK
          can suspend a seller that doesn&apos;t fulfil orders accurately or breaks these terms.
        </p>
      </PolicySection>
    </PolicyShell>
  );
}
