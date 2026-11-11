import Link from "next/link";
import { SITE_CONFIG } from "@/lib/config";

const POLICY_LINKS = [
  { href: "/policies/shipping", label: "Shipping" },
  { href: "/policies/returns", label: "Returns" },
  { href: "/policies/privacy", label: "Privacy" },
  { href: "/policies/terms", label: "Terms" },
];

/** Shared frame for policy pages: eyebrow, oversized title, side nav and hairline sections. */
export function PolicyShell({
  eyebrow,
  title,
  muted,
  intro,
  current,
  children,
}: {
  eyebrow: string;
  title: string;
  muted?: string;
  intro?: React.ReactNode;
  current: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1360px] px-5 md:px-10 pt-8 md:pt-16 pb-8 flex flex-col gap-10 md:gap-14">
      <header className="flex flex-col gap-6 md:gap-8">
        <p className="font-mono text-[11px] md:text-xs uppercase tracking-[0.08em] text-mute">{eyebrow}</p>
        <h1 className="max-w-[900px] text-[40px] md:text-[clamp(48px,6vw,80px)] font-semibold leading-[0.98] md:leading-[0.95] tracking-[-0.05em] text-ink text-balance">
          {title}
          {muted && <span className="text-mute-2"> {muted}</span>}
        </h1>
        {intro && <div className="max-w-2xl text-base md:text-[17px] leading-relaxed text-mute">{intro}</div>}
      </header>

      <div className="flex flex-col lg:flex-row gap-10 lg:gap-16">
        <nav aria-label="Policies" className="lg:w-[200px] flex-shrink-0">
          <ul className="flex lg:flex-col gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 lg:mx-0 lg:px-0 lg:sticky lg:top-28">
            {POLICY_LINKS.map((l) => {
              const active = l.href === current;
              return (
                <li key={l.href} className="flex-none">
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex items-center h-11 px-[18px] rounded-full border text-sm font-medium transition-colors ${
                      active ? "bg-ink border-ink text-white" : "bg-white border-line text-ink hover:border-ink"
                    }`}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex-1 min-w-0 max-w-[760px] flex flex-col">
          {children}
          <p className="border-t border-line pt-6 mt-2 text-sm text-mute">
            Questions? Email{" "}
            <a
              href={`mailto:${SITE_CONFIG.supportEmail}`}
              className="text-ink underline underline-offset-4 decoration-brand-300 hover:decoration-ink break-all"
            >
              {SITE_CONFIG.supportEmail}
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

/** One numbered policy section separated by hairlines. */
export function PolicySection({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-8 grid gap-4 sm:grid-cols-[56px_minmax(0,1fr)]">
      <span className="font-mono text-[13px] text-mute pt-1.5" aria-hidden="true">
        {String(number).padStart(2, "0")}
      </span>
      <div className="flex flex-col gap-3 min-w-0">
        <h2 className="text-xl md:text-[22px] font-semibold tracking-[-0.02em] text-ink">{title}</h2>
        <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-ink-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1.5 [&_strong]:font-semibold [&_strong]:text-ink">
          {children}
        </div>
      </div>
    </section>
  );
}
