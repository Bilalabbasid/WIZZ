"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw } from "lucide-react";

/** Shared body for error boundaries. Never shows the raw error message (it may hold internals). */
export function ErrorContent({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest =
    error && typeof error === "object" && "digest" in error && typeof (error as { digest?: unknown }).digest === "string"
      ? (error as { digest: string }).digest
      : null;

  return (
    <div role="alert" className="mx-auto max-w-[1360px] px-5 md:px-10 py-16 md:py-24">
      <div className="max-w-2xl flex flex-col gap-6">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-mute">Something went wrong</p>
        <h1 className="text-[40px] md:text-[56px] font-semibold leading-[0.95] tracking-[-0.05em] text-ink">
          We couldn&apos;t load this page. <span className="text-mute-2">Please try again.</span>
        </h1>
        {digest && <p className="font-mono text-xs text-mute">Reference: {digest}</p>}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => retry()}
            className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-full bg-ink text-white text-sm font-medium hover:bg-ink-2"
          >
            <RotateCw size={16} aria-hidden="true" />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center min-h-[44px] px-5 rounded-full border border-ink text-ink text-sm font-medium hover:bg-white"
          >
            Go to the homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
