import type { Metadata } from "next";
import { SITE_CONFIG } from "@/lib/config";
import { getCommerceSettings } from "@/lib/commerce-settings";
import { formatCurrency } from "@/lib/formatters";
import { PolicySection, PolicyShell } from "../_components/policy-shell";

export const metadata: Metadata = {
  title: "Shipping policy",
  description: "Delivery fees, cash on delivery and how orders ship on WIZZ.PK.",
  alternates: { canonical: `${SITE_CONFIG.canonicalUrl}/policies/shipping` },
};

export default async function ShippingPolicyPage() {
  const { freeShippingThresholdMinor, standardShippingMinor, expressShippingMinor, codMaxOrderMinor } =
    await getCommerceSettings();

  return (
    <PolicyShell
      current="/policies/shipping"
      eyebrow="Shipping policy"
      title="Delivery across Pakistan."
      muted="Pay cash when it arrives."
      intro={<p>Fees are calculated at checkout from the rates below. You see the total before you place the order.</p>}
    >
      <PolicySection number={1} title="Delivery fees">
        <p>Each seller ships its own package, so fees apply per seller in your order.</p>
        <ul>
          <li>
            <strong>Standard delivery:</strong> {formatCurrency(standardShippingMinor)} per seller package. Free when
            your items from that seller total {formatCurrency(freeShippingThresholdMinor)} or more.
          </li>
          <li>
            <strong>Express delivery:</strong> {formatCurrency(expressShippingMinor)} per seller package, where offered
            at checkout.
          </li>
        </ul>
      </PolicySection>

      <PolicySection number={2} title="Cash on delivery">
        <p>
          Pay the courier in cash when your package arrives. Cash on delivery is available for orders up to{" "}
          {formatCurrency(codMaxOrderMinor)}.
        </p>
      </PolicySection>

      <PolicySection number={3} title="How your order ships">
        <p>
          The seller packs your items and hands them to a courier. When a package ships, its courier and tracking number
          are added to your order, so you can follow it from your account.
        </p>
        <p>Delivery times depend on the seller, the courier and your city.</p>
      </PolicySection>

      <PolicySection number={4} title="Cancelling an order">
        <p>You can cancel an order from your order page until a package has shipped.</p>
      </PolicySection>
    </PolicyShell>
  );
}
