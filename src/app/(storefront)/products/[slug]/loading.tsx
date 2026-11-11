import { CATALOG_CONTAINER } from "@/components/catalog-ui";

/** Product page skeleton: mono breadcrumb, thumbnail column + 4:5 photo, buy panel blocks. */
export default function ProductDetailLoading() {
  return (
    <div
      className={`${CATALOG_CONTAINER} pb-24 animate-pulse motion-reduce:animate-none`}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading product…</span>
      <div className="pt-4">
        <div className="h-3 w-64 max-w-full rounded-full bg-line-soft" />
      </div>
      <div className="flex flex-col gap-10 pt-7 lg:flex-row lg:gap-12">
        <div className="flex min-w-0 flex-col-reverse gap-3 lg:flex-[1.3] lg:flex-row">
          <div className="flex gap-2.5 p-1 lg:w-[92px] lg:flex-col">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 w-16 shrink-0 rounded-[14px] bg-sand lg:h-[100px] lg:w-[84px]" />
            ))}
          </div>
          <div className="aspect-[4/5] w-full rounded-[20px] bg-sand sm:rounded-[28px] lg:max-h-[760px] lg:flex-1" />
        </div>
        <div className="flex min-w-0 flex-col gap-6 lg:max-w-[480px] lg:flex-1">
          <div className="flex gap-2">
            <div className="h-6 w-24 rounded-full bg-line-soft" />
            <div className="h-6 w-20 rounded-full bg-line-soft" />
          </div>
          <div className="space-y-2">
            <div className="h-10 w-full rounded-2xl bg-sand" />
            <div className="h-10 w-2/3 rounded-2xl bg-sand" />
          </div>
          <div className="h-8 w-40 rounded-full bg-sand" />
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-11 w-24 rounded-full bg-white" />
            ))}
          </div>
          <div className="h-14 w-full rounded-full bg-sand" />
          <div className="flex gap-2.5">
            <div className="h-[52px] flex-1 rounded-full bg-white" />
            <div className="h-[52px] w-[52px] rounded-full bg-white" />
          </div>
          <div className="h-[78px] w-full rounded-[20px] bg-white" />
          <div className="grid grid-cols-2 border-t border-line">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2 border-b border-line py-3.5">
                <div className="h-2.5 w-16 rounded-full bg-line-soft" />
                <div className="h-4 w-24 rounded-full bg-line-soft" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
