import { connection } from "next/server";
import { Navbar, StorefrontDock } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { NotFoundContent } from "./(storefront)/_components/not-found-content";

// Unmatched URLs render here, outside the storefront layout, so add the store chrome.
export default async function NotFound() {
  // Render per request: never query the database while `next build` prerenders
  await connection();
  return (
    <div className="flex flex-col min-h-screen bg-canvas">
      <Navbar />
      <main className="flex-1">
        <NotFoundContent />
      </main>
      <Footer />
      <StorefrontDock />
    </div>
  );
}
