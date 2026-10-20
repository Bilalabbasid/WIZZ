import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Seller Workspace | WIZZ.PK",
  robots: { index: false, follow: false },
};

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
