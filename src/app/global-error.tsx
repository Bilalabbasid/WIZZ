"use client";

import { useEffect } from "react";

/**
 * Replaces the root layout when it fails, so globals.css and fonts are not loaded:
 * styles are inline and minimal. Never shows the raw error message.
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#f8fafc",
          color: "#0f172a",
        }}
      >
        <title>Something went wrong | WIZZ.PK</title>
        <header style={{ background: "#013b23", color: "#fff", padding: "14px 16px", fontWeight: 900, letterSpacing: "0.02em" }}>
          WIZZ.PK
        </header>
        <main role="alert" style={{ flex: 1, maxWidth: 560, margin: "0 auto", padding: "64px 16px", textAlign: "center" }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.5, margin: "0 0 24px" }}>
            The store couldn&apos;t load. Please try again in a moment.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => retry()}
              style={{
                background: "#3a47e0",
                color: "#fff",
                border: 0,
                borderRadius: 8,
                padding: "0 20px",
                minHeight: 44,
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            {/* Plain anchor: client-side navigation is unavailable when the root layout failed */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: "0 20px",
                minHeight: 44,
                color: "#0f172a",
                textDecoration: "none",
                fontWeight: 600,
                background: "#fff",
              }}
            >
              Go to the homepage
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
