import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { getOrCreateCart } from "@/modules/cart/services";
import { CheckoutView } from "@/components/checkout-view";
import { SITE_CONFIG } from "@/lib/config";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Checkout | WIZZ.PK",
  robots: { index: false, follow: false },
};

export interface CheckoutPageProps {
  searchParams: Promise<{ coupon?: string }>;
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const { coupon } = await searchParams;
  const user = await getCurrentUser();
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SITE_CONFIG.sessionCookieName)?.value;

  const cart = await getOrCreateCart(sessionToken, user?.id);

  if (cart.items.length === 0) {
    redirect("/cart");
  }

  // Load customer saved addresses if logged in
  let savedAddresses: Array<{
    id: string;
    fullName: string;
    phone: string;
    street1: string;
    street2?: string | null;
    city: string;
    stateProvince: string;
    postalCode: string;
    countryCode: string;
  }> = [];

  if (user?.id) {
    savedAddresses = await prisma.address.findMany({
      where: { userId: user.id },
      orderBy: { isDefaultShipping: "desc" },
    });
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/" className="hover:text-slate-900">Home</Link>
        <ChevronRight size={14} />
        <Link href="/cart" className="hover:text-slate-900">Cart</Link>
        <ChevronRight size={14} />
        <span className="font-semibold text-slate-900">Checkout</span>
      </nav>

      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Secure Checkout
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Complete your order with verified stock hold and encrypted checkout processing.
        </p>
      </div>

      <CheckoutView
        cartId={cart.id}
        initialEmail={user?.email || ""}
        initialPhone={user?.phone || ""}
        initialCoupon={coupon || ""}
        savedAddresses={savedAddresses}
      />
    </div>
  );
}
