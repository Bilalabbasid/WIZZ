import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { SITE_CONFIG } from "@/lib/config";
import { isSellerPortalActive } from "@/lib/flags";

export const metadata: Metadata = {
  title: { absolute: "Sell on WIZZ.PK" },
  description:
    "Apply to sell new products on WIZZ.PK. Shoppers across Pakistan pay cash on delivery; you ship with your courier and get paid after delivery.",
  alternates: {
    canonical: `${SITE_CONFIG.canonicalUrl}/sell`,
  },
  openGraph: {
    title: "Sell on WIZZ.PK",
    description: "Apply to sell new products to shoppers across Pakistan.",
    url: `${SITE_CONFIG.canonicalUrl}/sell`,
  },
};

const APPLY_STEPS = [
  {
    title: "Create an account",
    body: "Register and open your seller application.",
  },
  {
    title: "Add your business details",
    body: "Enter your business registration, tax number and pickup address, and upload the documents we ask for.",
  },
  {
    title: "We review your application",
    body: "WIZZ.PK checks your details. If something needs changing, you get a note in your application and can resubmit.",
  },
  {
    title: "Start listing",
    body: "Once approved, your seller account opens with owner access. Each product is reviewed before it goes live.",
  },
];

const AFTER_STEPS = [
  {
    title: "Take orders",
    body: "Orders for your products appear in Seller Center with the delivery address and items to pack.",
  },
  {
    title: "Ship with your courier",
    body: "Pack each order, hand it to your courier and add the tracking number so the shopper can follow it.",
  },
  {
    title: "Get paid after delivery",
    body: "Shoppers pay cash on delivery. Payouts are settled after the courier remits the cash, minus WIZZ.PK's commission.",
  },
];

export default async function SellLandingPage() {
  const user = await getCurrentUser();
  const portalOpen = isSellerPortalActive();
  const applyHref = user ? "/seller/onboarding" : "/seller/register";

  return (
    <div className="pb-8">
      {/* Hero */}
      <section className="mx-auto max-w-[1360px] px-5 md:px-10 pt-8 md:pt-16 pb-14 md:pb-20 flex flex-col gap-8 md:gap-10">
        <p className="font-mono text-[11px] md:text-xs uppercase tracking-[0.08em] text-mute">Sell on WIZZ.PK</p>
        <h1 className="max-w-[1000px] text-[40px] md:text-[clamp(48px,6.5vw,96px)] font-semibold leading-[0.98] md:leading-[0.95] tracking-[-0.05em] text-ink text-balance">
          Sell to shoppers across Pakistan. <span className="text-mute-2">We handle checkout and payments.</span>
        </h1>
        <p className="max-w-xl text-base md:text-[17px] leading-relaxed text-mute">
          WIZZ.PK is a marketplace for new products. Approved sellers list their products, ship orders with their own
          courier and get paid after delivery.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href={applyHref}
            className="inline-flex items-center gap-2.5 h-12 px-6 rounded-full bg-ink text-white text-sm font-medium hover:bg-ink-2"
          >
            {user ? "Continue your application" : "Apply to sell"}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          {!user && (
            <Link
              href="/login?next=/seller/portal"
              className="inline-flex items-center h-12 px-6 rounded-full border border-ink text-ink text-sm font-medium hover:bg-white"
            >
              Seller Center login
            </Link>
          )}
        </div>
        {!portalOpen && (
          <p className="max-w-xl rounded-[20px] border border-line-soft bg-white px-5 py-4 text-sm text-mute">
            Seller Center is opening in stages. You can apply now and your application will be reviewed; listing opens
            to approved sellers as Seller Center becomes available.
          </p>
        )}
      </section>

      {/* How applying works */}
      <section
        aria-labelledby="sell-apply-heading"
        className="mx-auto max-w-[1360px] px-5 md:px-10 pb-16 md:pb-24 flex flex-col gap-8"
      >
        <div className="border-t border-line pt-8">
          <h2
            id="sell-apply-heading"
            className="text-[28px] md:text-[40px] font-semibold leading-none tracking-[-0.04em] text-ink"
          >
            How applying works
          </h2>
        </div>
        <ol className="grid gap-px sm:grid-cols-2 lg:grid-cols-4 rounded-[24px] border border-line-soft bg-line-soft overflow-hidden">
          {APPLY_STEPS.map((step, i) => (
            <li key={step.title} className="bg-white p-6 md:p-8 flex flex-col gap-8">
              <span className="font-mono text-[13px] text-mute" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex flex-col gap-2">
                <h3 className="text-xl font-semibold tracking-[-0.02em] text-ink">{step.title}</h3>
                <p className="text-[15px] leading-relaxed text-mute">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* After approval: dark band */}
      <section aria-labelledby="sell-after-heading" className="bg-ink text-canvas">
        <div className="mx-auto max-w-[1360px] px-5 md:px-10 py-16 md:py-24 flex flex-col gap-10 md:gap-14">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h2
              id="sell-after-heading"
              className="max-w-[720px] text-[32px] md:text-[clamp(36px,4.5vw,64px)] font-semibold leading-none tracking-[-0.045em]"
            >
              After you&apos;re approved. <span className="text-[#8F8F88]">Orders, shipping and payouts.</span>
            </h2>
            <Link
              href={applyHref}
              className="inline-flex items-center h-12 px-6 rounded-full bg-volt text-ink text-sm font-semibold hover:brightness-95 focus-visible:outline-volt"
            >
              {user ? "Continue your application" : "Start selling"}
            </Link>
          </div>
          <ol className="grid gap-px md:grid-cols-3 rounded-[24px] border border-[#2A2A27] bg-[#2A2A27] overflow-hidden">
            {AFTER_STEPS.map((step, i) => (
              <li key={step.title} className="bg-ink p-6 md:p-8 flex flex-col gap-8 md:gap-10 md:min-h-[200px]">
                <span className="font-mono text-[13px] text-[#A3A39C]" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex flex-col gap-2.5">
                  <h3 className="text-xl md:text-[22px] font-semibold tracking-[-0.02em]">{step.title}</h3>
                  <p className="text-[15px] leading-relaxed text-[#B4B4AD]">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="text-sm text-[#B4B4AD]">
            Questions about selling? Email{" "}
            <a href={`mailto:${SITE_CONFIG.supportEmail}`} className="text-canvas underline underline-offset-4">
              {SITE_CONFIG.supportEmail}
            </a>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
