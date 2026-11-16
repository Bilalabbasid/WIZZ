import Link from "next/link";
import { connection } from "next/server";
import { SITE_CONFIG } from "@/lib/config";
import { getCommerceSettings } from "@/lib/commerce-settings";
import { formatCurrency } from "@/lib/formatters";
import { getCategories } from "@/modules/catalog/services";
import { WizzLogo } from "./wizz-logo";

const eyebrowClass = "font-mono text-[11px] uppercase tracking-[0.08em] text-white/45";
const linkClass =
  "text-white/85 hover:text-white hover:underline underline-offset-4 decoration-white/30 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

function FooterColumn({ title, links }: { title: string; links: Array<{ href: string; label: string }> }) {
  return (
    <nav aria-label={title} className="flex flex-col gap-3 min-w-[120px]">
      <h2 className={eyebrowClass}>{title}</h2>
      <ul className="flex flex-col gap-2 text-[13px]">
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
  // Render per request: never query the database while `next build` prerenders
  await connection();
  const [categories, { freeShippingThresholdMinor, returnWindowDays }] = await Promise.all([
    getCategories(),
    getCommerceSettings(),
  ]);
  const topCategories = categories.filter((c) => c._count.products > 0).slice(0, 5);
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 md:mt-24 bg-ink text-white">
      <div className="mx-auto max-w-[1360px] px-5 md:px-10 pt-12 md:pt-14 pb-8 flex flex-col gap-10">
        <div className="flex flex-col lg:flex-row lg:justify-between gap-10">
          {/* Brand */}
          <div className="flex flex-col gap-4 max-w-sm">
            <WizzLogo size="md" theme="light" />
            <p className="text-[13px] leading-relaxed text-white/70">
              Shop everything you need. Pay when it arrives.
              <br />
              Products from WIZZ.PK and approved sellers across Pakistan.
            </p>
            <ul className="flex flex-col gap-1 font-mono text-[11px] text-white/45">
              <li>Cash on delivery across Pakistan</li>
              <li>Free standard delivery over {formatCurrency(freeShippingThresholdMinor)} per seller</li>
              <li>Returns within {returnWindowDays} days of delivery</li>
            </ul>
          </div>

          {/* Link columns */}
          <div className="flex flex-wrap gap-x-12 gap-y-8">
            {topCategories.length > 0 && (
              <FooterColumn
                title="Popular"
                links={[
                  ...topCategories.map((c) => ({ href: `/categories/${c.slug}`, label: c.name })),
                  { href: "/products?deals=true", label: "Deals" },
                ]}
              />
            )}
            <FooterColumn
              title="Help"
              links={[
                { href: "/policies/shipping", label: "Shipping" },
                { href: "/policies/returns", label: "Returns" },
                { href: "/account", label: "Your orders" },
                { href: "/contact", label: "Contact" },
              ]}
            />
            <FooterColumn
              title="Wizz"
              links={[
                { href: "/sell", label: "Sell on WIZZ.PK" },
                { href: "/login?next=/seller/portal", label: "Seller Center" },
                { href: "/products", label: "All products" },
              ]}
            />
            <div className="flex flex-col gap-3 min-w-0">
              <h2 className={eyebrowClass}>Support</h2>
              <a href={`mailto:${SITE_CONFIG.supportEmail}`} className={`${linkClass} text-[13px] break-all`}>
                {SITE_CONFIG.supportEmail}
              </a>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-between gap-4 border-t border-white/10 pt-5 text-[12px] text-white/50">
          <span>© {year} wizz.pk</span>
          <span className="flex gap-5">
            <Link href="/policies/privacy" className="hover:text-white">
              Privacy
            </Link>
            <Link href="/policies/terms" className="hover:text-white">
              Terms
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
