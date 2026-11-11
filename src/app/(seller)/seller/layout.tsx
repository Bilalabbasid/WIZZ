import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Seller Center",
  robots: { index: false, follow: false },
};

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
