export default function CheckoutLoading() {
  return (
    <div
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6 sm:space-y-8"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading checkout…</span>
      <div className="h-3 w-40 rounded bg-slate-200 animate-pulse" />
      <div className="space-y-2">
        <div className="h-8 w-48 rounded-lg bg-slate-200 animate-pulse" />
        <div className="h-3 w-72 max-w-full rounded bg-canvas animate-pulse" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">
        <div className="lg:col-span-7 space-y-6">
          {[2, 6, 2, 2].map((rows, i) => (
            <div key={i} className="bg-white p-4 sm:p-6 rounded-[20px] border border-line space-y-4 ">
              <div className="flex items-center gap-2 pb-3 border-b border-line-soft">
                <div className="w-6 h-6 rounded-full bg-slate-200 animate-pulse" />
                <div className="h-4 w-40 rounded bg-slate-200 animate-pulse" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from({ length: rows }).map((_, j) => (
                  <div key={j} className="space-y-1.5">
                    <div className="h-3 w-24 rounded bg-canvas animate-pulse" />
                    <div className="h-10 rounded-lg bg-canvas animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-5">
          <div className="bg-white p-4 sm:p-6 rounded-[20px] border border-line space-y-4 ">
            <div className="h-5 w-36 rounded bg-slate-200 animate-pulse" />
            <div className="h-10 rounded-lg bg-canvas animate-pulse" />
            <div className="space-y-2">
              <div className="h-3 rounded bg-canvas animate-pulse" />
              <div className="h-3 w-5/6 rounded bg-canvas animate-pulse" />
              <div className="h-5 w-2/3 rounded bg-slate-200 animate-pulse" />
            </div>
            <div className="h-12 rounded-lg bg-brand-100 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
