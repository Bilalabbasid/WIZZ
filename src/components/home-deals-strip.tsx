import Link from "next/link";
import { ArrowRight, Package, Zap } from "lucide-react";
import { TilePrice, type HomeTileProduct } from "./home-product-tile";
import { HomeDealCountdown } from "./home-deal-countdown";

/**
 * Deals strip: only products with a real markdown. Called "Flash deals" with a countdown only
 * when at least one shown deal is a scheduled deal that is live now (soonestEndsAt set).
 */
export function HomeDealsStrip({
  products,
  soonestEndsAt,
}: {
  products: HomeTileProduct[];
  soonestEndsAt: string | null;
}) {
  if (products.length === 0) return null;
  const title = soonestEndsAt ? "Flash deals" : "Deals";

  return (
    <section aria-labelledby="home-deals-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <h2
            id="home-deals-heading"
            className="flex items-center gap-2 text-[22px] md:text-2xl font-semibold leading-tight tracking-[-0.03em] text-ink"
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-volt" aria-hidden="true">
              <Zap size={15} strokeWidth={2} className="fill-ink" />
            </span>
            {title}
          </h2>
          {soonestEndsAt && <HomeDealCountdown endsAt={soonestEndsAt} />}
        </div>
        <Link
          href="/products?deals=true"
          className="inline-flex items-center gap-1.5 min-h-[44px] text-sm font-medium text-ink underline underline-offset-4 decoration-brand-300 hover:decoration-ink"
        >
          All deals
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>

      <ul className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-5 px-5 md:mx-0 md:px-0 pb-1 scroll-px-5 md:scroll-px-0">
        {products.map((p) => {
          const lowStock = p.sellable > 0 && p.sellable <= p.lowStockThreshold;
          return (
            <li key={p.id} className="w-[156px] md:w-[180px] flex-none snap-start">
              <Link
                href={`/products/${p.slug}`}
                className="group flex h-full flex-col gap-2 rounded-[20px] border border-line-soft bg-white p-2 hover:border-line transition-colors"
              >
                <span className="relative block aspect-square overflow-hidden rounded-[14px] bg-sand">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- product photos come from arbitrary seller upload hosts
                    <img
                      src={p.imageUrl}
                      alt=""
                      width={180}
                      height={180}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-mute-2">
                      <Package size={28} strokeWidth={1.25} aria-hidden="true" />
                    </span>
                  )}
                  <span className="absolute left-2 top-2 rounded-full bg-[#C93519] px-2 py-1 font-mono text-[11px] leading-none text-white">
                    −{p.discountPercent}%
                  </span>
                </span>
                <span className="flex flex-1 flex-col gap-1 px-1 pb-1">
                  <span className="text-[13px] leading-snug text-ink line-clamp-2 min-h-[2.6em]">{p.title}</span>
                  <TilePrice product={p} size="sm" />
                  {lowStock && <span className="font-mono text-[11px] text-[#C2410C]">Only {p.sellable} left</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
