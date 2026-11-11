"use client";

import { WizzLogo } from "@/components/wizz-logo";
import { ErrorContent } from "./(storefront)/_components/error-content";

// Root error boundary (errors outside the storefront group, e.g. /login). The navbar is a
// server component, so this fallback uses a minimal branded header instead.
export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-canvas border-b border-line">
        <div className="max-w-[1360px] mx-auto px-5 sm:px-10 py-5">
          <WizzLogo size="md" theme="dark" />
        </div>
      </header>
      <main className="flex-1">
        <ErrorContent error={error} retry={retry} />
      </main>
    </div>
  );
}
