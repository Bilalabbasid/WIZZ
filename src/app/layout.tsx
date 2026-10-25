import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { SITE_CONFIG } from "@/lib/config";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_CONFIG.canonicalUrl),
  title: {
    default: "WIZZ.PK — Authentic Hardware & Travel Equipment",
    template: "%s | WIZZ.PK",
  },
  description: "High-trust digital commerce platform delivering verified physical hardware, travel equipment, audio acoustics, and workspace essentials.",
  keywords: ["WIZZ.PK", "hardware", "travel gear", "mechanical keyboard", "audio headphones", "authentic marketplace"],
  authors: [{ name: "WIZZ.PK" }],
  openGraph: {
    title: "WIZZ.PK — High-Trust E-Commerce & Marketplace",
    description: "Verified physical products with real inventory and reliable fulfillment.",
    url: SITE_CONFIG.canonicalUrl,
    siteName: "WIZZ.PK",
    locale: "en_US",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`h-full ${jakarta.variable}`}>
      <body className="min-h-full flex flex-col bg-[var(--background)] text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
