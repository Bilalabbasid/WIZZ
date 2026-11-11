export default function CartLoading() {
  return (
    <div role="status" aria-label="Loading your cart" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-pulse">
      <div className="h-3 w-40 rounded bg-slate-200" />
      <div className="space-y-2">
        <div className="h-8 w-56 rounded bg-slate-200" />
        <div className="h-3 w-72 max-w-full rounded bg-canvas" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-4">
          {[0, 1].map((g) => (
            <div key={g} className="bg-white rounded-[20px] border border-line overflow-hidden">
              <div className="h-12 bg-canvas border-b border-line-soft" />
              {[0, 1].map((i) => (
                <div key={i} className="p-4 flex items-center gap-4 border-b border-line-soft last:border-b-0">
                  <div className="w-18 h-18 rounded-xl bg-canvas shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-3/4 rounded bg-slate-200" />
                    <div className="h-3 w-1/2 rounded bg-canvas" />
                  </div>
                  <div className="h-10 w-16 rounded-lg bg-canvas" />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="lg:col-span-4">
          <div className="bg-white rounded-[20px] border border-line p-5 space-y-4">
            <div className="h-5 w-40 rounded bg-slate-200" />
            <div className="h-11 rounded-lg bg-canvas" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-3 rounded bg-canvas" />
            ))}
            <div className="h-12 rounded-lg bg-slate-200" />
          </div>
        </div>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
