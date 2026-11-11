import { CATALOG_CONTAINER, CATALOG_GRID, CatalogCardSkeleton } from "@/components/catalog-ui";

export default function WishlistLoading() {
  return (
    <div
      className={`${CATALOG_CONTAINER} space-y-10 pb-20 animate-pulse motion-reduce:animate-none`}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading your wishlist…</span>
      <div className="space-y-6 pt-4">
        <div className="h-3 w-40 rounded-full bg-line-soft" />
        <div className="space-y-3">
          <div className="h-[clamp(32px,4.5vw,56px)] w-56 rounded-2xl bg-sand" />
          <div className="h-4 w-64 max-w-full rounded-full bg-line-soft" />
        </div>
      </div>
      <div className={CATALOG_GRID}>
        {Array.from({ length: 8 }).map((_, i) => (
          <CatalogCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
