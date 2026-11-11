import { CATALOG_CONTAINER, CATALOG_GRID, CatalogCardSkeleton } from "@/components/catalog-ui";

/** Listing skeleton with the geometry of the real page: mono breadcrumb, big title, filter column, 4:5 card grid. */
export function ListingSkeleton({ label = "Loading products" }: { label?: string }) {
  return (
    <div
      className={`${CATALOG_CONTAINER} space-y-8 pb-20 animate-pulse motion-reduce:animate-none`}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">{label}…</span>
      <div className="space-y-6 pt-4">
        <div className="h-3 w-44 rounded-full bg-line-soft" />
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="space-y-3">
            <div className="h-[clamp(32px,4.5vw,56px)] w-64 max-w-full rounded-2xl bg-sand sm:w-96" />
            <div className="h-4 w-48 rounded-full bg-line-soft" />
          </div>
          <div className="flex gap-2">
            <div className="h-11 w-28 rounded-full bg-white lg:hidden" />
            <div className="h-11 w-48 rounded-full bg-white" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="hidden space-y-6 lg:block">
          <div className="h-6 w-20 rounded-full bg-sand" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3 border-t border-line pt-5">
              <div className="h-3 w-24 rounded-full bg-line-soft" />
              <div className="h-5 w-full rounded-full bg-line-soft" />
              <div className="h-5 w-4/5 rounded-full bg-line-soft" />
            </div>
          ))}
        </div>
        <div className={`${CATALOG_GRID} lg:border-t lg:border-line lg:pt-6`}>
          {Array.from({ length: 8 }).map((_, i) => (
            <CatalogCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ProductsLoading() {
  return <ListingSkeleton />;
}
