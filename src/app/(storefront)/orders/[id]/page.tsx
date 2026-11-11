import { notFound, redirect } from "next/navigation";
import { CatalogBreadcrumb } from "@/components/catalog-ui";
import { getOrderById } from "@/modules/orders/services";
import { deliveredAtOf } from "@/modules/orders/lifecycle";
import { getCommerceSettings } from "@/lib/commerce-settings";
import { getCurrentUser } from "@/lib/auth";
import { verifyOrderAccessToken } from "@/lib/order-access";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/formatters";
import { SITE_CONFIG } from "@/lib/config";
import { Badge } from "@/components/ui/badge";
import { OrderActions, type ReturnablePackage } from "@/components/order-actions";
import Link from "next/link";
import type { Metadata } from "next";
import {
  CheckCircle2,
  Clock,
  Truck,
  Package,
  ExternalLink,
  XCircle,
  RotateCcw,
  Banknote,
} from "lucide-react";
import { connection } from "next/server";

export const metadata: Metadata = {
  title: "Order details",
  robots: { index: false, follow: false },
};

export interface OrderPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string | string[] }>;
}

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "neutral";

const PACKAGE_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  PENDING_PAYMENT: { label: "Awaiting payment", variant: "warning" },
  CONFIRMED: { label: "Confirmed", variant: "info" },
  PACKING: { label: "Being packed", variant: "info" },
  DISPATCHED: { label: "Shipped", variant: "default" },
  DELIVERED: { label: "Delivered", variant: "success" },
  CANCELLED: { label: "Cancelled", variant: "danger" },
};

const RETURN_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  SUBMITTED: { label: "Waiting for seller review", variant: "warning" },
  APPROVED: { label: "Approved – send the item back", variant: "info" },
  REJECTED: { label: "Not approved", variant: "danger" },
  RECEIVED: { label: "Received by seller – refund in progress", variant: "info" },
  REFUNDED: { label: "Refunded", variant: "success" },
};

const RETURN_REASON: Record<string, string> = {
  DEFECTIVE: "Defective or damaged",
  NOT_AS_DESCRIBED: "Not as described",
  WRONG_ITEM: "Wrong item received",
  UNWANTED: "No longer needed",
};

const SHIPMENT_STATUS: Record<string, string> = {
  LABEL_CREATED: "Label created",
  IN_TRANSIT: "In transit",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  FAILED_DELIVERY: "Delivery attempt failed",
};

const PAYMENT_STATUS: Record<string, string> = {
  UNPAID: "Not paid yet",
  AUTHORIZED: "Authorised",
  PAID: "Paid",
  REFUNDED: "Refunded",
  FAILED: "Payment failed",
};

/** Whether a package's return window (ending at `windowEndsMs`) is still open at request time. */
function isWindowOpen(windowEndsMs: number): boolean {
  return Date.now() <= windowEndsMs;
}

function safeHttpsUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export default async function OrderDetailPage({ params, searchParams }: OrderPageProps) {
  // Render per request (never query the database during `next build`)
  await connection();
  const { id } = await params;
  const { t } = await searchParams;
  const accessToken = Array.isArray(t) ? t[0] : t;

  const order = await getOrderById(id);
  if (!order) notFound();

  const currentUser = await getCurrentUser();
  const isPrivileged =
    currentUser?.role === "PLATFORM_SUPER_ADMIN" || currentUser?.role === "PLATFORM_SUPPORT";
  const isOwner = Boolean(currentUser && order.customerUserId && currentUser.id === order.customerUserId);

  if (order.customerUserId) {
    // Account orders: only the owner (or platform support staff).
    if (!currentUser) redirect(`/login?next=${encodeURIComponent(`/orders/${id}`)}`);
    if (!isOwner && !isPrivileged) notFound();
  } else if (!isPrivileged && !verifyOrderAccessToken(order.id, accessToken)) {
    // Guest orders hold an address, phone and email: require the signed link from checkout.
    notFound();
  }

  const isGuestOrder = !order.customerUserId;
  const { returnWindowDays } = await getCommerceSettings();

  let shippingAddress: {
    fullName: string;
    phone: string;
    street1: string;
    street2?: string;
    city: string;
    stateProvince: string;
    postalCode: string;
    countryCode: string;
  } | null = null;
  try {
    shippingAddress = JSON.parse(order.shippingAddressJson);
  } catch {
    shippingAddress = null;
  }

  const isCod = order.codRecords.length > 0 || order.paymentAttempts.some((a) => a.provider === "COD");
  const payOnDelivery = isCod && order.paymentStatus === "UNPAID" && order.status !== "CANCELLED";

  // Status-appropriate heading (never claims more than the order's real state)
  const heading = (() => {
    switch (order.status) {
      case "PENDING_PAYMENT":
        return isCod
          ? { title: "Order placed", sub: "We've received your order. You'll pay in cash on delivery.", tone: "ok" as const }
          : { title: "Awaiting payment", sub: "Your order is reserved until payment is confirmed.", tone: "warn" as const };
      case "PAID":
        return { title: "Order confirmed", sub: "Payment received. The seller is preparing your order.", tone: "ok" as const };
      case "PROCESSING":
        return { title: "Order confirmed", sub: "The seller is preparing your order.", tone: "ok" as const };
      case "PARTIALLY_SHIPPED":
        return { title: "Partly shipped", sub: "Some packages are on their way; others are still being prepared.", tone: "ok" as const };
      case "SHIPPED":
        return { title: "On its way", sub: "All packages have been handed to the courier.", tone: "ok" as const };
      case "DELIVERED":
        return { title: "Delivered", sub: "Your order has been delivered.", tone: "ok" as const };
      case "CANCELLED":
        return { title: "Order cancelled", sub: "This order was cancelled.", tone: "bad" as const };
      case "REFUNDED":
        return { title: "Order refunded", sub: "This order has been refunded.", tone: "bad" as const };
      default:
        return { title: "Order details", sub: "", tone: "ok" as const };
    }
  })();

  const anyDispatched = order.sellerOrders.some((so) => so.status === "DISPATCHED" || so.status === "DELIVERED");
  const cancellable =
    (order.status === "PENDING_PAYMENT" || order.status === "PAID" || order.status === "PROCESSING") && !anyDispatched;

  // Returns: one entry per delivered package that is still inside the return window
  const returnablePackages: ReturnablePackage[] = order.sellerOrders
    .filter((so) => so.status === "DELIVERED")
    .map((so) => {
      const deliveredAt = deliveredAtOf(so);
      const windowEnds = deliveredAt.getTime() + returnWindowDays * 24 * 60 * 60 * 1000;
      const requestedByItem = new Map<string, number>();
      for (const rr of so.returnRequests) {
        if (rr.status === "REJECTED") continue;
        for (const ri of rr.items) {
          requestedByItem.set(ri.orderItemId, (requestedByItem.get(ri.orderItemId) || 0) + ri.quantity);
        }
      }
      return {
        sellerOrderId: so.id,
        sellerName: so.sellerOrg.name,
        sellerOrderNumber: so.sellerOrderNumber,
        windowOpen: isWindowOpen(windowEnds),
        windowEndsLabel: formatDate(new Date(windowEnds)),
        items: so.items.map((i) => ({
          id: i.id,
          title: i.productTitleSnapshot,
          variant: i.variantNameSnapshot,
          returnableQuantity: Math.max(0, i.quantity - (requestedByItem.get(i.id) || 0)),
        })),
      };
    });

  const statusTone =
    heading.tone === "bad"
      ? "bg-slate-900 text-white"
      : heading.tone === "warn"
      ? "bg-amber-900 text-white"
      : "bg-brand-950 text-white";

  return (
    <div className="mx-auto w-full max-w-5xl px-5 sm:px-10 py-8 sm:py-10 space-y-8">
      <CatalogBreadcrumb
        items={[
          { label: "Home", href: "/" },
          isGuestOrder ? { label: "Orders" } : { label: "Account", href: "/account" },
          { label: `Order ${order.orderNumber}` },
        ]}
      />

      <div className={`p-5 sm:p-6 rounded-[28px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4  ${statusTone}`}>
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-[20px] bg-white/10 flex items-center justify-center flex-shrink-0">
            {heading.tone === "bad" ? <XCircle size={26} /> : heading.tone === "warn" ? <Clock size={26} /> : <CheckCircle2 size={26} className="text-emerald-400" />}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold">{heading.title}</h1>
            <p className="text-xs text-white/80 mt-0.5">
              Order {order.orderNumber} • Placed {formatDateTime(order.createdAt)}
            </p>
            {heading.sub && <p className="text-xs text-white/80 mt-0.5">{heading.sub}</p>}
            <p className="text-xs text-white/70 mt-0.5 break-all">We&apos;ll email updates to {order.customerEmail}</p>
          </div>
        </div>
      </div>

      {isGuestOrder && (
        <p className="text-xs text-mute p-3 rounded-xl bg-canvas border border-line">
          Bookmark this page: it is the private link to your order. Anyone with the link can see the order details.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {order.sellerOrders.map((so) => {
            const pkg = PACKAGE_STATUS[so.status] ?? { label: so.status, variant: "neutral" as const };
            const orderItemsById = new Map(so.items.map((i) => [i.id, i]));
            return (
              <section
                key={so.id}
                aria-label={`Package from ${so.sellerOrg.name}`}
                className="bg-white rounded-[28px] border border-line/90 p-5 sm:p-6 space-y-5 "
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-line-soft">
                  <div className="flex items-center gap-2 min-w-0">
                    <Package size={18} className="text-brand-600 shrink-0" />
                    <span className="font-bold text-sm text-ink truncate">Sold by {so.sellerOrg.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={pkg.variant} size="md">{pkg.label}</Badge>
                    <span className="text-[11px] font-mono text-mute">{so.sellerOrderNumber}</span>
                  </div>
                </div>

                <ul className="divide-y divide-line-soft">
                  {so.items.map((item) => (
                    <li key={item.id} className="py-4 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h2 className="font-bold text-sm text-ink">{item.productTitleSnapshot}</h2>
                        <p className="text-xs text-mute mt-0.5">
                          Variant: <span className="font-semibold text-ink-2">{item.variantNameSnapshot}</span> • SKU:{" "}
                          <span className="font-mono text-[11px]">{item.skuSnapshot}</span>
                        </p>
                        <p className="text-xs text-mute mt-1">
                          Quantity: <span className="font-bold">{item.quantity}</span> × {formatCurrency(item.unitPriceMinor)}
                        </p>
                      </div>
                      <div className="text-right font-semibold text-sm text-ink shrink-0">
                        {formatCurrency(item.totalMinor)}
                      </div>
                    </li>
                  ))}
                </ul>

                {so.shipments.length > 0 ? (
                  <div className="pt-4 border-t border-line-soft space-y-3">
                    <h3 className="text-xs font-bold tracking-normal text-mute">Delivery tracking</h3>
                    {so.shipments.map((shipment) => {
                      const trackingUrl = safeHttpsUrl(shipment.trackingUrl);
                      const events = [...shipment.events].sort(
                        (a, b) => new Date(b.eventTimestamp).getTime() - new Date(a.eventTimestamp).getTime()
                      );
                      return (
                        <div key={shipment.id} className="p-4 rounded-[20px] bg-canvas border border-line space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="flex items-center gap-1.5 font-bold text-ink">
                              <Truck size={15} className="text-brand-600" />
                              <span>{shipment.carrierName}</span>
                            </span>
                            <span className="text-mute">{SHIPMENT_STATUS[shipment.status] ?? shipment.status}</span>
                          </div>
                          <p className="text-xs text-mute">
                            Tracking number:{" "}
                            <span className="font-mono font-semibold text-ink break-all">{shipment.trackingNumber}</span>
                          </p>
                          {shipment.deliveredAt ? (
                            <p className="text-xs text-mute">Delivered {formatDateTime(shipment.deliveredAt)}</p>
                          ) : shipment.shippedAt ? (
                            <p className="text-xs text-mute">Shipped {formatDateTime(shipment.shippedAt)}</p>
                          ) : null}
                          {trackingUrl && (
                            <a
                              href={trackingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-semibold text-brand-700 hover:underline inline-flex items-center gap-1 min-h-[32px]"
                            >
                              <span>Track on the courier&apos;s website</span>
                              <ExternalLink size={12} />
                            </a>
                          )}
                          {events.length > 0 && (
                            <ol className="space-y-1.5 pt-2 border-t border-line/60">
                              {events.map((event) => (
                                <li key={event.id} className="text-[11px] flex justify-between gap-3 text-mute">
                                  <span>
                                    {event.note || SHIPMENT_STATUS[event.status] || event.status}
                                    {event.location ? ` — ${event.location}` : ""}
                                  </span>
                                  <span className="text-mute-2 shrink-0">{formatDateTime(event.eventTimestamp)}</span>
                                </li>
                              ))}
                            </ol>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : so.status !== "CANCELLED" && so.status !== "DELIVERED" ? (
                  <p className="p-3 rounded-xl bg-canvas border border-line-soft text-xs text-mute flex items-center gap-2">
                    <Clock size={14} className="text-mute-2 shrink-0" />
                    <span>Tracking details will appear here once the seller ships this package.</span>
                  </p>
                ) : null}

                {so.returnRequests.length > 0 && (
                  <div className="pt-4 border-t border-line-soft space-y-3">
                    <h3 className="text-xs font-bold tracking-normal text-mute flex items-center gap-1.5">
                      <RotateCcw size={13} /> Return requests
                    </h3>
                    {so.returnRequests.map((rr) => {
                      const st = RETURN_STATUS[rr.status] ?? { label: rr.status, variant: "neutral" as const };
                      return (
                        <div key={rr.id} className="p-3 rounded-[20px] border border-line space-y-1.5 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <Badge variant={st.variant} size="sm">{st.label}</Badge>
                            <span className="text-mute-2">Requested {formatDate(rr.requestedAt)}</span>
                          </div>
                          <ul className="text-ink-2">
                            {rr.items.map((ri) => {
                              const oi = orderItemsById.get(ri.orderItemId);
                              return (
                                <li key={ri.id}>
                                  {ri.quantity} × {oi ? `${oi.productTitleSnapshot} (${oi.variantNameSnapshot})` : "Item"}
                                </li>
                              );
                            })}
                          </ul>
                          <p className="text-mute">Reason: {RETURN_REASON[rr.reasonCode] ?? rr.reasonCode}</p>
                          {rr.resolvedAt && <p className="text-mute">Updated {formatDate(rr.resolvedAt)}</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}

          <section className="bg-white rounded-[28px] border border-line/90 p-5 sm:p-6 space-y-3">
            <h2 className="font-bold text-sm text-ink">Need to change something?</h2>
            {isGuestOrder ? (
              <p className="text-xs text-mute leading-relaxed">
                This order was placed without an account. Please{" "}
                <Link href={`/login?next=${encodeURIComponent("/account")}`} className="font-semibold text-brand-700 underline">
                  sign in
                </Link>{" "}
                or{" "}
                <Link href="/contact" className="font-semibold text-brand-700 underline">
                  contact support
                </Link>{" "}
                with order number <span className="font-mono">{order.orderNumber}</span> to cancel or return items.
              </p>
            ) : !isOwner ? (
              <p className="text-xs text-mute">Only the customer who placed this order can cancel it or request returns.</p>
            ) : (
              <>
                <p className="text-xs text-mute leading-relaxed">
                  You can cancel until a package has shipped. Delivered packages can be returned within {returnWindowDays} days
                  of delivery (
                  <Link href="/policies/returns" className="underline">
                    returns policy
                  </Link>
                  ).
                </p>
                <OrderActions orderId={order.id} canCancel={cancellable} returnablePackages={returnablePackages} />
                {!cancellable && returnablePackages.length === 0 && order.status !== "CANCELLED" && (
                  <p className="text-xs text-mute">
                    This order can no longer be cancelled. Returns open once a package is delivered.
                  </p>
                )}
              </>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-white rounded-[28px] border border-line/90 p-5 sm:p-6 space-y-3 ">
            <h2 className="font-semibold text-sm text-ink pb-2 border-b border-line-soft">Delivery address</h2>
            {shippingAddress ? (
              <address className="not-italic text-xs text-mute space-y-1 leading-relaxed">
                <p className="font-bold text-ink">{shippingAddress.fullName}</p>
                <p>{shippingAddress.street1}</p>
                {shippingAddress.street2 && <p>{shippingAddress.street2}</p>}
                <p>
                  {shippingAddress.city}, {shippingAddress.stateProvince} {shippingAddress.postalCode}
                </p>
                <p className="font-semibold text-ink-2">
                  {shippingAddress.countryCode === "PK" ? "Pakistan" : shippingAddress.countryCode}
                </p>
                {shippingAddress.phone && <p className="pt-1 text-mute">{shippingAddress.phone}</p>}
              </address>
            ) : (
              <p className="text-xs text-mute">Address details are unavailable. Contact support if you need them.</p>
            )}
          </section>

          <section className="bg-white rounded-[28px] border border-line/90 p-5 sm:p-6 space-y-4 ">
            <h2 className="font-semibold text-sm text-ink pb-2 border-b border-line-soft">Payment summary</h2>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between text-mute">
                <dt>Subtotal</dt>
                <dd className="font-semibold text-ink">{formatCurrency(order.subtotalMinor)}</dd>
              </div>
              {order.discountMinor > 0 && (
                <div className="flex justify-between text-brand-700 font-semibold">
                  <dt>Discount{order.couponCode ? ` (${order.couponCode})` : ""}</dt>
                  <dd>-{formatCurrency(order.discountMinor)}</dd>
                </div>
              )}
              <div className="flex justify-between text-mute">
                <dt>Delivery</dt>
                <dd className="font-semibold text-ink">
                  {order.shippingMinor === 0 ? "FREE" : formatCurrency(order.shippingMinor)}
                </dd>
              </div>
              {order.taxMinor > 0 && (
                <div className="flex justify-between text-mute">
                  <dt>Tax</dt>
                  <dd className="font-semibold text-ink">{formatCurrency(order.taxMinor)}</dd>
                </div>
              )}
              <div className="pt-3 border-t border-line-soft flex justify-between text-sm font-semibold text-ink">
                <dt>Total</dt>
                <dd className="text-brand-700">{formatCurrency(order.totalMinor, SITE_CONFIG.defaultCurrency)}</dd>
              </div>
            </dl>

            <div className="p-3 rounded-xl bg-canvas border border-line-soft text-[11px] text-mute space-y-1">
              {payOnDelivery ? (
                <p className="font-bold text-ink-2 flex items-center gap-1.5">
                  <Banknote size={13} className="text-brand-600" /> Pay on delivery — {formatCurrency(order.totalMinor)} in cash
                </p>
              ) : (
                <p className="font-bold text-ink-2">
                  Payment: {PAYMENT_STATUS[order.paymentStatus] ?? order.paymentStatus}
                  {isCod ? " (cash on delivery)" : ""}
                </p>
              )}
              {order.refunds.length > 0 && (
                <p>
                  Refunds:{" "}
                  {order.refunds
                    .map((r) => `${formatCurrency(r.amountMinor)} ${r.status === "SUCCEEDED" ? "refunded" : r.status === "PENDING" ? "pending" : "failed"}`)
                    .join(", ")}
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
