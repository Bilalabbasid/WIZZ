import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { SITE_CONFIG } from "@/lib/config";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get help with an order, a return or selling on WIZZ.PK.",
  alternates: { canonical: `${SITE_CONFIG.canonicalUrl}/contact` },
};

const HELP_LINKS = [
  { href: "/account", label: "Track an order", body: "See order status and tracking in your account." },
  { href: "/policies/returns", label: "Return an item", body: "How returns and refunds work." },
  { href: "/policies/shipping", label: "Delivery and fees", body: "Delivery fees and how orders ship." },
  { href: "/sell", label: "Sell on WIZZ.PK", body: "How to apply as a seller." },
];

export default function ContactPage() {
  const phone = SITE_CONFIG.supportPhone;

  return (
    <div className="mx-auto max-w-[1360px] px-5 md:px-10 pt-8 md:pt-16 pb-8 flex flex-col gap-12 md:gap-16">
      <header className="flex flex-col gap-6 md:gap-8">
        <p className="font-mono text-[11px] md:text-xs uppercase tracking-[0.08em] text-mute">Contact</p>
        <h1 className="max-w-[900px] text-[40px] md:text-[clamp(48px,6vw,88px)] font-semibold leading-[0.98] md:leading-[0.95] tracking-[-0.05em] text-ink text-balance">
          How can we help? <span className="text-mute-2">Email us and include your order number.</span>
        </h1>
      </header>

      <section aria-labelledby="contact-channels" className="flex flex-col gap-6">
        <h2 id="contact-channels" className="sr-only">
          Ways to reach us
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[24px] border border-line-soft bg-white p-6 md:p-8 flex flex-col gap-4 min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-mute">Email</p>
            <a
              href={`mailto:${SITE_CONFIG.supportEmail}`}
              className="text-xl md:text-2xl font-semibold tracking-[-0.02em] text-ink underline underline-offset-4 decoration-brand-300 hover:decoration-ink break-all"
            >
              {SITE_CONFIG.supportEmail}
            </a>
            <p className="text-[15px] leading-relaxed text-mute">
              For orders, returns, delivery questions and seller applications. Adding your order number helps us find it
              quickly.
            </p>
          </div>
          {phone && (
            <div className="rounded-[24px] border border-line-soft bg-white p-6 md:p-8 flex flex-col gap-4 min-w-0">
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-mute">Phone</p>
              <a
                href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                className="font-mono text-xl md:text-2xl text-ink underline underline-offset-4 decoration-brand-300 hover:decoration-ink"
              >
                {phone}
              </a>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="contact-self-serve" className="flex flex-col gap-6 border-t border-line pt-8">
        <h2 id="contact-self-serve" className="text-[28px] md:text-[40px] font-semibold leading-none tracking-[-0.04em] text-ink">
          Find it yourself
        </h2>
        <ul className="grid gap-px sm:grid-cols-2 lg:grid-cols-4 rounded-[24px] border border-line-soft bg-line-soft overflow-hidden">
          {HELP_LINKS.map((l) => (
            <li key={l.href} className="bg-white">
              <Link href={l.href} className="group flex h-full flex-col gap-2 p-6 hover:bg-canvas transition-colors">
                <span className="flex items-center justify-between gap-3 text-[17px] font-semibold tracking-[-0.02em] text-ink">
                  {l.label}
                  <ArrowRight size={16} className="text-mute group-hover:text-ink flex-shrink-0" aria-hidden="true" />
                </span>
                <span className="text-sm text-mute">{l.body}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
