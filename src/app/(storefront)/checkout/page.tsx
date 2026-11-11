import { redirect } from "next/navigation";
import { CatalogBreadcrumb } from "@/components/catalog-ui";
import { getCurrentUser } from "@/lib/auth";
import { getActiveCart } from "@/modules/cart/services";
import { getCartToken } from "@/lib/cart-session";
import { CheckoutView } from "@/components/checkout-view";
import { getEnabledPaymentMethods } from "@/lib/payment-methods";
import { getCommerceSettings } from "@/lib/commerce-settings";
import { prisma } from "@/lib/db";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export interface CheckoutPageProps {
  searchParams: Promise<{ coupon?: string | string[] }>;
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const { coupon } = await searchParams;
  const couponParam = (Array.isArray(coupon) ? coupon[0] : coupon)?.trim().slice(0, 40) ?? "";

  const user = await getCurrentUser();
  // Guests are identified by the cart cookie (the same one /api/cart/items sets)
  const sessionToken = user ? undefined : await getCartToken();
  const cart = await getActiveCart(sessionToken, user?.id);

  if (!cart || cart.items.length === 0) {
    redirect("/cart");
  }

  // Signed-in customers can pick one of their saved addresses
  const savedAddresses = user?.id
    ? await prisma.address.findMany({
        where: { userId: user.id },
        orderBy: [{ isDefaultShipping: "desc" }, { updatedAt: "desc" }],
        select: {
          id: true,
          title: true,
          fullName: true,
          phone: true,
          street1: true,
          street2: true,
          city: true,
          stateProvince: true,
          postalCode: true,
          countryCode: true,
          isDefaultShipping: true,
        },
      })
    : [];

  // Only methods enabled for this environment are offered (the sandbox is never offered in production)
  const settings = await getCommerceSettings();
  const paymentMethods = getEnabledPaymentMethods(settings.codMaxOrderMinor);

  return (
    <div className="mx-auto w-full max-w-[1360px] px-5 sm:px-10 py-8 sm:py-10 space-y-6 sm:space-y-8">
      <CatalogBreadcrumb items={[{ label: "Home", href: "/" }, { label: "Cart", href: "/cart" }, { label: "Checkout" }]} />

      <div className="space-y-3">
        <h1 className="text-[clamp(32px,4.5vw,56px)] font-semibold leading-none tracking-[-0.045em] text-ink">Checkout</h1>
        <p className="text-sm text-mute">
          {user
            ? "Confirm your delivery details and payment method."
            : (
              <>
                Checking out as a guest.{" "}
                <Link href="/login?next=/checkout" className="font-semibold text-brand-700 hover:underline">
                  Sign in
                </Link>{" "}
                to use saved addresses and track orders from your account.
              </>
            )}
        </p>
      </div>

      <CheckoutView
        cartId={cart.id}
        initialEmail={user?.email || ""}
        initialPhone={user?.phone || ""}
        initialCoupon={couponParam}
        savedAddresses={savedAddresses}
        paymentMethods={paymentMethods}
        codLimitMinor={settings.codMaxOrderMinor}
        shippingRates={{
          standardMinor: settings.standardShippingMinor,
          expressMinor: settings.expressShippingMinor,
          freeThresholdMinor: settings.freeShippingThresholdMinor,
        }}
      />
    </div>
  );
}
