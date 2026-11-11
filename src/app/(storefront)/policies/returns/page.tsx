import type { Metadata } from "next";
import Link from "next/link";
import { SITE_CONFIG } from "@/lib/config";
import { getCommerceSettings } from "@/lib/commerce-settings";
import { PolicySection, PolicyShell } from "../_components/policy-shell";

export const metadata: Metadata = {
  title: "Returns policy",
  description: "How to return an item bought on WIZZ.PK and how refunds work.",
  alternates: { canonical: `${SITE_CONFIG.canonicalUrl}/policies/returns` },
};

export default async function ReturnsPolicyPage() {
  const { returnWindowDays } = await getCommerceSettings();

  return (
    <PolicyShell
      current="/policies/returns"
      eyebrow="Returns policy"
      title={`Returns within ${returnWindowDays} days.`}
      muted="Request them from your order page."
    >
      <PolicySection number={1} title="Who can return">
        <p>
          You can request a return for a delivered package within {returnWindowDays} days of delivery. Return the item
          unused, with its original packaging and accessories.
        </p>
        <p>
          Reasons you can choose: the item is defective, not as described, the wrong item, or you no longer want it.
        </p>
      </PolicySection>

      <PolicySection number={2} title="How to request a return">
        <ol>
          <li>
            Sign in and open the order in{" "}
            <Link href="/account" className="underline underline-offset-4">
              your account
            </Link>
            .
          </li>
          <li>Choose the delivered item and the quantity you want to return.</li>
          <li>Pick a reason, add any details and submit.</li>
        </ol>
        <p>
          Checked out as a guest? Email us with your order number and we&apos;ll help you start the return.
        </p>
      </PolicySection>

      <PolicySection number={3} title="What happens next">
        <p>
          The seller or WIZZ.PK reviews your request and approves or declines it. After an approved item is received
          back and checked, the refund is recorded on your order with a reference.
        </p>
        <p>You can follow the status of each return on your order page.</p>
      </PolicySection>
    </PolicyShell>
  );
}
