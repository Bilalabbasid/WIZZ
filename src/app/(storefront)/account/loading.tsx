export default function AccountLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your account…</span>
      <div className="bg-white rounded-[28px] border border-line p-6 sm:p-7 flex items-center gap-4">
        <div className="w-16 h-16 rounded-[20px] bg-slate-200 animate-pulse" />
        <div className="space-y-2 flex-1">
          <div className="h-6 w-48 max-w-full rounded bg-slate-200 animate-pulse" />
          <div className="h-3 w-40 max-w-full rounded bg-canvas animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-6 w-40 rounded bg-slate-200 animate-pulse" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-5 rounded-[20px] bg-white border border-line space-y-3">
              <div className="h-4 w-32 rounded bg-slate-200 animate-pulse" />
              <div className="h-3 w-full rounded bg-canvas animate-pulse" />
            </div>
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-56 rounded-[28px] bg-white border border-line animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
