import Link from "next/link";
import { formatCurrency } from "@/lib/formatters";
import { MONO_LABEL } from "./catalog-ui";

/**
 * Compact 1:1 product tile (reference "More from seller" row): square photo,
 * title + mono price on one row. Server component; a broken image leaves the
 * sand placeholder (empty alt, the title is the link text).
 */
export function CatalogProductTile({
  href,
  title,
  imageUrl,
  priceMinor,
  fromPrice = false,
  outOfStock = false,
}: {
  href: string;
  title: string;
  imageUrl: string | null;
  /** Lowest active variant price; null when nothing is purchasable. */
  priceMinor: number | null;
  fromPrice?: boolean;
  outOfStock?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-[18px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4 focus-visible:ring-offset-canvas"
    >
      <div className="relative aspect-square overflow-hidden rounded-[18px] bg-sand">
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            width={320}
            height={320}
            loading="lazy"
            decoding="async"
            className={`h-full w-full object-cover motion-safe:transition-opacity motion-safe:duration-300 group-hover:opacity-90 ${
              outOfStock || priceMinor === null ? "opacity-55" : ""
            }`}
          />
        )}
        {(outOfStock || priceMinor === null) && (
          <span className={`absolute bottom-3 left-3 rounded-full bg-ink px-2.5 py-1 text-white ${MONO_LABEL}`}>
            {priceMinor === null ? "Unavailable" : "Out of stock"}
          </span>
        )}
      </div>
      <div className="flex items-start justify-between gap-3 px-1">
        <span className="line-clamp-2 min-w-0 text-sm font-semibold leading-snug tracking-[-0.01em] text-ink">{title}</span>
        {priceMinor !== null && (
          <span className="shrink-0 whitespace-nowrap font-mono text-sm text-ink">
            {fromPrice && <span className="mr-1 font-sans text-[11px] text-mute">From</span>}
            {formatCurrency(priceMinor)}
          </span>
        )}
      </div>
    </Link>
  );
}
