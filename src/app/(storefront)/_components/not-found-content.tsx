import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";

/** Shared 404 body for the root and storefront not-found pages. */
export function NotFoundContent() {
  return (
    <div className="mx-auto max-w-[1360px] px-5 md:px-10 py-16 md:py-24">
      <div className="max-w-2xl flex flex-col gap-8">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-mute">Error 404</p>
        <h1 className="text-[40px] md:text-[64px] font-semibold leading-[0.95] tracking-[-0.05em] text-ink">
          We couldn&apos;t find that page. <span className="text-mute-2">Try a search instead.</span>
        </h1>
        <p className="text-[15px] leading-relaxed text-mute max-w-lg">
          The link may be broken, or the product may no longer be listed.
        </p>
        <form action="/search" method="GET" role="search" className="flex flex-col gap-3 max-w-xl">
          <label htmlFor="nf-search" className="text-[13px] font-medium text-mute">
            What are you looking for?
          </label>
          <div className="flex items-center gap-2 rounded-full border border-line bg-white pl-5 pr-1.5 py-1.5 focus-within:border-ink">
            <Search size={18} strokeWidth={1.7} className="text-ink flex-shrink-0" aria-hidden="true" />
            <input
              id="nf-search"
              name="q"
              type="search"
              placeholder="Search products and brands"
              className="flex-1 min-w-0 h-11 bg-transparent text-base text-ink placeholder:text-mute focus:outline-none"
            />
            <button
              type="submit"
              className="h-11 px-5 rounded-full bg-ink text-white text-sm font-medium hover:bg-ink-2 flex-shrink-0"
            >
              Search
            </button>
          </div>
        </form>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex items-center min-h-[44px] px-5 rounded-full bg-ink text-white text-sm font-medium hover:bg-ink-2"
          >
            Go to the homepage
          </Link>
          <Link
            href="/products"
            className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-full border border-ink text-ink text-sm font-medium hover:bg-white"
          >
            Browse all products
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
