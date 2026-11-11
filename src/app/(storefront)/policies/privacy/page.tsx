import type { Metadata } from "next";
import { SITE_CONFIG } from "@/lib/config";
import { PolicySection, PolicyShell } from "../_components/policy-shell";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What information WIZZ.PK collects, why, and who can see it.",
  alternates: { canonical: `${SITE_CONFIG.canonicalUrl}/policies/privacy` },
};

export default function PrivacyPolicyPage() {
  return (
    <PolicyShell
      current="/policies/privacy"
      eyebrow="Privacy policy"
      title="Your information."
      muted="What we collect and who sees it."
      intro={<p>This summary describes how WIZZ.PK handles personal information today. It is pending legal review.</p>}
    >
      <PolicySection number={1} title="What we collect">
        <ul>
          <li>Your name, email address, phone number and delivery addresses.</li>
          <li>Your orders, returns and saved items.</li>
          <li>Your password, stored only as a secure hash.</li>
          <li>
            For seller applicants: business details such as registration and tax numbers, pickup address and the
            documents you upload.
          </li>
        </ul>
      </PolicySection>

      <PolicySection number={2} title="How we use it">
        <p>
          To take and deliver your orders, handle returns and refunds, answer your questions, keep your account secure
          and review seller applications.
        </p>
      </PolicySection>

      <PolicySection number={3} title="Who can see it">
        <p>
          A seller sees only what it needs to fulfil its part of your order, such as your name, phone number and
          delivery address. Sellers can&apos;t see your other orders or orders from other sellers.
        </p>
        <p>Couriers receive the delivery details for the packages they carry.</p>
        <p>Seller documents are stored privately and are visible only to that seller&apos;s team and WIZZ.PK staff.</p>
      </PolicySection>

      <PolicySection number={4} title="Payments and cookies">
        <p>Orders are paid by cash on delivery, so we don&apos;t collect card details.</p>
        <p>We use cookies to keep you signed in and to remember your cart.</p>
      </PolicySection>

      <PolicySection number={5} title="Your choices">
        <p>
          You can update your profile and addresses in your account. To ask for a copy of your data or to close your
          account, email us.
        </p>
      </PolicySection>
    </PolicyShell>
  );
}
