"use client";

import { ErrorContent } from "./_components/error-content";

// Storefront error boundary: rendered inside the storefront layout (header and footer stay).
export default function StorefrontError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorContent error={error} retry={retry} />;
}
