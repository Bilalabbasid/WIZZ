import Link from "next/link";
import { Package } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { WishlistButton } from "./wishlist-button";

/** Serialisable product summary for the homepage tiles and deal cards (built on the server). */
export interface HomeTileProduct {
  id: string;
  slug: string;
  title: string;
  imageUrl: string | null;
  imageAlt: string;
  /** Lowest active variant price; null when nothing is purchasable. */
  priceMinor: number | null;
  /** Set only when it is a real markdown (above priceMinor). */
  compareAtMinor: number | null;
  discountPercent: number;
  fromPrice: boolean;
  badge: "deal" | "featured" | null;
  sellerName: string;
  sellerCity: string | null;
  /** Short age label such as "2d", computed on the server. */
  listedLabel: string;
  categorySlug: string | null;
  /** Net sellable units across variants. */
  sellable: number;
  lowStockThreshold: number;
}

export function TilePrice({ product, size = "md" }: { product: HomeTileProduct; size?: "sm" | "md" }) {
  if (product.priceMinor === null) {
    return <p className="font-mono text-[13px] text-mute">Unavailable</p>;
  }
  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0 font-mono tabular-nums">
      <span className={`font-semibold text-ink ${size === "sm" ? "text-[13px]" : "text-[14px]"}`}>
        {product.fromPrice && <span className="font-normal text-mute">From </span>}
        {formatCurrency(product.priceMinor)}
      </span>
      {product.compareAtMinor && (
        <span className="text-[11px] text-mute line-through">
          <span className="sr-only">Was </span>
          {formatCurrency(product.compareAtMinor)}
        </span>
      )}
    </p>
  );
}

/** Dense homepage tile: square photo on sand, optional volt tag, heart, mono price, 2-line title, meta row. */
export function HomeProductTile({ product, eager = false }: { product: HomeTileProduct; eager?: boolean }) {
  const href = `/products/${product.slug}`;
  const soldOut = product.priceMinor !== null && product.sellable === 0;

  return (
    <article className="group relative flex min-w-0 flex-col gap-2.5">
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden="true"
        className="relative block aspect-square overflow-hidden rounded-[18px] bg-sand"
      >
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- product photos come from arbitrary seller upload hosts (same approach as ProductCard)
          <img
            src={product.imageUrl}
            alt=""
            width={240}
            height={240}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none ${
              soldOut ? "opacity-60" : ""
            }`}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-mute-2">
            <Package size={32} strokeWidth={1.25} />
          </span>
        )}
        {product.badge && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-volt px-2 py-1 font-mono text-[10px] uppercase leading-none tracking-[0.06em] text-ink">
            {product.badge === "deal" ? `Deal −${product.discountPercent}%` : "Featured"}
          </span>
        )}
      </Link>
      <WishlistButton
        productId={product.id}
        productTitle={product.title}
        className="absolute right-1.5 top-1.5 shadow-[0_1px_2px_rgba(14,14,13,0.08)]"
      />

      <div className="flex min-w-0 flex-col gap-1 px-0.5">
        <TilePrice product={product} />
        <h3 className="text-[13px] leading-snug text-ink line-clamp-2">
          <Link href={href} className="hover:underline underline-offset-2 decoration-brand-300">
            {product.title}
          </Link>
        </h3>
        <p className="flex min-w-0 items-center justify-between gap-2 text-[11px] text-mute">
          <span className="truncate">{product.sellerCity ?? product.sellerName}</span>
          <span className="flex-shrink-0 font-mono">
            {soldOut ? (
              "Sold out"
            ) : (
              <>
                <span className="sr-only">Listed </span>
                {product.listedLabel}
                <span className="sr-only"> ago</span>
              </>
            )}
          </span>
        </p>
      </div>
    </article>
  );
}
