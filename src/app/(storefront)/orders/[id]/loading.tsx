export default function OrderLoading() {
  return (
    <div role="status" aria-label="Loading order" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-pulse">
      <div className="h-3 w-48 rounded bg-slate-200" />
      <div className="h-28 rounded-[28px] bg-slate-200" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {[0, 1].map((i) => (
            <div key={i} className="bg-white rounded-[28px] border border-line p-6 space-y-4">
              <div className="h-4 w-1/2 rounded bg-slate-200" />
              <div className="h-3 w-3/4 rounded bg-canvas" />
              <div className="h-3 w-2/3 rounded bg-canvas" />
            </div>
          ))}
        </div>
        <div className="space-y-6">
          <div className="h-40 rounded-[28px] bg-white border border-line" />
          <div className="h-48 rounded-[28px] bg-white border border-line" />
        </div>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
