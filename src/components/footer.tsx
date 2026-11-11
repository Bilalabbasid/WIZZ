import Link from "next/link";
import { SITE_CONFIG } from "@/lib/config";
import { getCommerceSettings } from "@/lib/commerce-settings";
import { formatCurrency } from "@/lib/formatters";
import { getCategories } from "@/modules/catalog/services";
import { WizzDot } from "./wizz-logo";

const eyebrowClass = "font-mono text-[11px] uppercase tracking-[0.08em] text-mute";
const linkClass = "text-ink hover:text-ink-2 hover:underline underline-offset-4 decoration-brand-300";

function FooterColumn({ title, links }: { title: string; links: Array<{ href: string; label: string }> }) {
  return (
    <nav aria-label={title} className="flex flex-col gap-2.5 min-w-[140px]">
      <h2 className={eyebrowClass}>{title}</h2>
      <ul className="flex flex-col gap-2.5">
        {links.map((l) => (
          <li key={l.href + l.label}>
            <Link href={l.href} className={linkClass}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export async function Footer() {
  const [categories, { freeShippingThresholdMinor, returnWindowDays }] = await Promise.all([
    getCategories(),
    getCommerceSettings(),
  ]);
  const topCategories = categories.filter((c) => c._count.products > 0).slice(0, 6);
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 md:mt-24 border-t border-line">
      <div className="mx-auto max-w-[1360px] px-5 md:px-10 pt-14 md:pt-[72px] pb-10 flex flex-col gap-12">
        <div className="flex flex-wrap justify-between gap-x-10 gap-y-10 text-sm">
          <FooterColumn
            title="Shop"
            links={[
              { href: "/products", label: "All products" },
              { href: "/products?deals=true", label: "Deals" },
              { href: "/products?sort=newest", label: "New arrivals" },
            ]}
          />
          {topCategories.length > 0 && (
            <FooterColumn
              title="Categories"
              links={topCategories.map((c) => ({ href: `/categories/${c.slug}`, label: c.name }))}
            />
          )}
          <FooterColumn
            title="Help"
            links={[
              { href: "/policies/shipping", label: "Shipping policy" },
              { href: "/policies/returns", label: "Returns" },
              { href: "/contact", label: "Contact" },
            ]}
          />
          <FooterColumn
            title="Sell"
            links={[
              { href: "/sell", label: "Sell on WIZZ.PK" },
              { href: "/login?next=/seller/portal", label: "Seller Center login" },
            ]}
          />
          <FooterColumn
            title="Legal"
            links={[
              { href: "/policies/privacy", label: "Privacy" },
              { href: "/policies/terms", label: "Terms" },
            ]}
          />
          <div className="flex flex-col gap-2.5 min-w-0 basis-full sm:basis-auto">
            <h2 className={eyebrowClass}>Support</h2>
            <a href={`mailto:${SITE_CONFIG.supportEmail}`} className={`${linkClass} break-all`}>
              {SITE_CONFIG.supportEmail}
            </a>
          </div>
        </div>

        <ul className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs text-mute">
          <li>Cash on delivery across Pakistan</li>
          <li>Free standard delivery over {formatCurrency(freeShippingThresholdMinor)} per seller</li>
          <li>Returns within {returnWindowDays} days of delivery</li>
        </ul>

        <div
          aria-hidden="true"
          className="overflow-hidden font-bold leading-[0.8] tracking-[-0.07em] text-ink text-[clamp(80px,17vw,260px)] whitespace-nowrap select-none"
        >
          wizz
          <WizzDot sizeClass="size-[0.17em] mx-[0.05em]" ringClass="ring-[3px] ring-ink" />
          pk
        </div>

        <div className="flex flex-wrap justify-between gap-4 border-t border-line pt-5 text-[13px] text-mute">
          <span>© {year} WIZZ.PK</span>
          <span className="flex gap-5">
            <Link href="/policies/privacy" className="hover:text-ink">
              Privacy
            </Link>
            <Link href="/policies/terms" className="hover:text-ink">
              Terms
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
