import Link from "next/link";
import { ArrowRight, Package, Search } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { HomeTileProduct } from "./home-product-tile";

export interface HeroCategoryCard {
  id: string;
  slug: string;
  name: string;
  productCount: number;
  imageUrl: string | null;
}

/**
 * Hero row: ink card (eyebrow, headline, big search, CTA, real product photo) and two
 * stacked white cards for the top categories.
 */
export function HomeHero({
  product,
  topCategories,
  popularCategories,
  hasDeals,
}: {
  product: HomeTileProduct | null;
  topCategories: HeroCategoryCard[];
  popularCategories: Array<{ id: string; slug: string; name: string }>;
  hasDeals: boolean;
}) {
  return (
    <section
      aria-label="Welcome"
      className={`grid gap-3 ${topCategories.length > 0 ? "lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]" : ""}`}
    >
      <div
        className={`grid gap-8 overflow-hidden rounded-[28px] bg-ink p-6 text-white md:p-10 ${
          product ? "md:grid-cols-[minmax(0,1fr)_minmax(220px,36%)]" : ""
        }`}
      >
        <div className="flex min-w-0 flex-col justify-between gap-7">
          <div className="flex flex-col gap-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-volt">
              Cash on delivery · Verified sellers · Delivery across Pakistan
            </p>
            <h1 className="text-[36px] md:text-[clamp(40px,4.4vw,68px)] font-semibold leading-[0.98] tracking-[-0.05em] text-balance">
              Shop everything you need. <span className="text-[#8F8F88]">Pay when it arrives.</span>
            </h1>
          </div>

          <form action="/search" method="GET" role="search" className="flex flex-col gap-2.5 max-w-[560px]">
            <label htmlFor="home-q" className="sr-only md:not-sr-only text-[13px] font-medium text-[#B4B4AD]">
              What are you looking for?
            </label>
            <div className="flex items-center gap-2 rounded-full bg-white py-1.5 pl-[18px] pr-1.5 text-ink focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-volt">
              <Search size={19} strokeWidth={1.7} className="flex-shrink-0" aria-hidden="true" />
              <input
                id="home-q"
                name="q"
                type="search"
                autoComplete="off"
                enterKeyHint="search"
                placeholder="Search products, brands and categories"
                className="h-10 md:h-11 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-mute focus:outline-none"
              />
              <button
                type="submit"
                className="flex h-10 md:h-11 min-w-10 flex-shrink-0 items-center justify-center rounded-full bg-ink px-3 md:px-5 text-sm font-medium text-white hover:bg-ink-2"
              >
                <Search size={17} className="md:hidden" aria-hidden="true" />
                <span className="sr-only md:not-sr-only">Search</span>
              </button>
            </div>
            {popularCategories.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-[#B4B4AD]">
                <span>Popular:</span>
                {popularCategories.map((c) => (
                  <Link
                    key={c.id}
                    href={`/categories/${c.slug}`}
                    className="inline-flex min-h-[32px] items-center text-white underline decoration-white/30 underline-offset-[3px] hover:decoration-white focus-visible:outline-volt"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            )}
          </form>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link
              href={hasDeals ? "/products?deals=true" : "/products"}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-volt px-5 text-sm font-semibold text-ink hover:brightness-95 focus-visible:outline-volt"
            >
              {hasDeals ? "Shop deals" : "Shop all products"}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link
              href="/sell"
              className="inline-flex min-h-[44px] items-center text-sm font-medium text-white underline decoration-white/30 underline-offset-4 hover:decoration-white focus-visible:outline-volt"
            >
              Sell on WIZZ.PK
            </Link>
          </div>
        </div>

        {product && (
          <Link
            href={`/products/${product.slug}`}
            className="group relative hidden min-h-[300px] overflow-hidden rounded-[22px] bg-sand md:block focus-visible:outline-volt"
          >
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- product photos come from arbitrary seller upload hosts (same approach as ProductCard)
              <img
                src={product.imageUrl}
                alt={product.imageAlt}
                width={420}
                height={480}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
              />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-mute-2">
                <Package size={40} strokeWidth={1.25} aria-hidden="true" />
              </span>
            )}
            {product.badge && (
              <span className="absolute left-3 top-3 rounded-full bg-volt px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.06em] text-ink">
                {product.badge === "deal" ? `Deal −${product.discountPercent}%` : "Featured"}
              </span>
            )}
            <span className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-3 rounded-2xl bg-white/95 px-3.5 py-2.5 text-ink">
              <span className="min-w-0 text-[13px] font-medium leading-snug line-clamp-2">{product.title}</span>
              {product.priceMinor !== null && (
                <span className="flex-shrink-0 font-mono text-[13px] font-semibold">
                  {formatCurrency(product.priceMinor)}
                </span>
              )}
            </span>
          </Link>
        )}
      </div>

      {topCategories.length > 0 && (
        <div className="hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-1">
          {topCategories.map((c) => (
            <Link
              key={c.id}
              href={`/categories/${c.slug}`}
              className="group flex min-h-[140px] items-center justify-between gap-4 rounded-[24px] border border-line-soft bg-white p-4 md:p-5 hover:border-line transition-colors"
            >
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-[17px] font-semibold leading-tight tracking-[-0.02em] text-ink">{c.name}</span>
                <span className="font-mono text-[12px] text-mute">
                  {c.productCount} {c.productCount === 1 ? "product" : "products"}
                </span>
                <span className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-ink">
                  Shop now
                  <ArrowRight size={14} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                </span>
              </span>
              <span className="relative size-24 md:size-28 flex-none overflow-hidden rounded-2xl bg-sand">
                {c.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- category cover from arbitrary upload hosts
                  <img
                    src={c.imageUrl}
                    alt=""
                    width={112}
                    height={112}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-mute-2">
                    <Package size={28} strokeWidth={1.25} aria-hidden="true" />
                  </span>
                )}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
