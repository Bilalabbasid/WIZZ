import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SITE_CONFIG } from "@/lib/config";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-geist-mono",
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
    default: "WIZZ.PK — Shop online, pay on delivery",
    template: "%s | WIZZ.PK",
  },
  description: "Shop electronics, home, kitchen, outdoor and fitness products from WIZZ.PK and verified Pakistani sellers. Cash on delivery across Pakistan.",
  keywords: ["WIZZ.PK", "online shopping Pakistan", "cash on delivery", "marketplace", "electronics", "home and kitchen"],
  authors: [{ name: "WIZZ.PK" }],
  openGraph: {
    title: "WIZZ.PK — Shop online, pay on delivery",
    description: "Products from WIZZ.PK and verified Pakistani sellers, with cash on delivery across Pakistan.",
    url: SITE_CONFIG.canonicalUrl,
    siteName: "WIZZ.PK",
    locale: "en_PK",
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
    <html lang="en" className={`h-full ${geist.variable} ${geistMono.variable}`}>
      <body className="min-h-full flex flex-col bg-canvas text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
