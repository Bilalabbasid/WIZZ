import { Navbar, StorefrontDock } from "@/components/navbar";
import { Footer } from "@/components/footer";

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-canvas">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      {/* Phones only; renders a bottom spacer so nothing hides behind it (hidden on /checkout) */}
      <StorefrontDock />
    </div>
  );
}
