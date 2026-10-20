import { notFound, redirect } from "next/navigation";
import { getOrderById } from "@/modules/orders/services";
import { getCurrentUser } from "@/lib/auth";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";
import { OrderActions } from "@/components/order-actions";
import Link from "next/link";
import type { Metadata } from "next";
import {
  CheckCircle2,
  Clock,
  Truck,
  Package,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Order Details | WIZZ.PK",
  robots: { index: false, follow: false },
};

export interface OrderPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: OrderPageProps) {
  const { id } = await params;
  const order = await getOrderById(id);

  if (!order) {
    notFound();
  }

  // Authorization check: if order belongs to a registered customer account,
  // enforce that the caller is the owner or an authorized platform administrator.
  if (order.customerUserId) {
    const currentUser = await getCurrentUser();
    const isPrivileged =
      currentUser?.role === "PLATFORM_SUPER_ADMIN" ||
      currentUser?.role === "PLATFORM_SUPPORT";

    if (!currentUser) {
      redirect(`/login?next=/orders/${id}`);
    }

    if (!isPrivileged && currentUser.id !== order.customerUserId) {
      notFound();
    }
  }

  let shippingAddress: {
    fullName: string;
    phone: string;
    street1: string;
    street2?: string;
    city: string;
    stateProvince: string;
    postalCode: string;
    countryCode: string;
  };

  try {
    shippingAddress = JSON.parse(order.shippingAddressJson);
  } catch {
    shippingAddress = {
      fullName: "Customer",
      phone: "",
      street1: "",
      city: "",
      stateProvince: "",
      postalCode: "",
      countryCode: "US",
    };
  }

  const isPreDispatch =
    order.status === "PENDING_PAYMENT" ||
    order.status === "PAID" ||
    order.status === "PROCESSING";

  const isDelivered = order.status === "DELIVERED";

  const allOrderItems = order.sellerOrders.flatMap((so) =>
    so.items.map((i) => ({
      id: i.id,
      productTitleSnapshot: i.productTitleSnapshot,
      variantNameSnapshot: i.variantNameSnapshot,
    }))
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/" className="hover:text-slate-900">Home</Link>
        <ChevronRight size={14} />
        <Link href="/account" className="hover:text-slate-900">Account</Link>
        <ChevronRight size={14} />
        <span className="font-semibold text-slate-900">Order {order.orderNumber}</span>
      </nav>

      {/* Success Notification Bar */}
      <div className="p-6 rounded-3xl bg-emerald-950 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={26} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black">
              Order Confirmed: {order.orderNumber}
            </h1>
            <p className="text-xs text-emerald-200 mt-0.5">
              Placed on {formatDateTime(order.createdAt)} • Email confirmation sent to {order.customerEmail}
            </p>
          </div>
        </div>

        <Badge variant={order.status === "CANCELLED" ? "danger" : "success"} size="md">
          {order.status.replace("_", " ")}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Line Items & Shipments (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {order.sellerOrders.map((so) => (
            <div key={so.id} className="bg-white rounded-3xl border border-slate-200/90 p-6 space-y-6 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Package size={18} className="text-indigo-600" />
                  <span className="font-bold text-sm text-slate-900">
                    Fulfilled by {so.sellerOrg.name}
                  </span>
                </div>
                <Badge variant="neutral" size="sm">
                  {so.sellerOrderNumber}
                </Badge>
              </div>

              {/* Order Items Snapshot */}
              <div className="divide-y divide-slate-100">
                {so.items.map((item) => (
                  <div key={item.id} className="py-4 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">
                        {item.productTitleSnapshot}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Variant: <span className="font-semibold text-slate-700">{item.variantNameSnapshot}</span> • SKU:{" "}
                        <span className="font-mono text-[11px]">{item.skuSnapshot}</span>
                      </p>
                      <p className="text-xs text-slate-600 mt-1">
                        Quantity: <span className="font-bold">{item.quantity}</span> × {formatCurrency(item.unitPriceMinor)}
                      </p>
                    </div>

                    <div className="text-right font-extrabold text-sm text-slate-900">
                      {formatCurrency(item.totalMinor)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Carrier Shipment Info */}
              {so.shipments.length > 0 ? (
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Carrier Tracking & Delivery Status
                  </h4>
                  {so.shipments.map((shipment) => (
                    <div key={shipment.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 font-bold text-slate-900">
                          <Truck size={15} className="text-indigo-600" />
                          <span>{shipment.carrierName}</span>
                        </span>
                        <span className="font-mono font-semibold text-indigo-700">
                          {shipment.trackingNumber}
                        </span>
                      </div>

                      {shipment.trackingUrl && (
                        <a
                          href={shipment.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1"
                        >
                          <span>Track Package on Carrier Website</span>
                          <ExternalLink size={12} />
                        </a>
                      )}

                      {/* Milestones */}
                      {shipment.events.length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-slate-200/60">
                          {shipment.events.map((event) => (
                            <div key={event.id} className="text-[11px] flex justify-between text-slate-600">
                              <span>• {event.note || event.status}</span>
                              <span className="text-slate-400">{formatDateTime(event.eventTimestamp)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-500 flex items-center gap-2">
                  <Clock size={14} className="text-slate-400" />
                  <span>Awaiting warehouse packing and carrier waybill generation.</span>
                </div>
              )}
            </div>
          ))}

          {/* Customer Order Actions (Cancel / Return) */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm">
            <h3 className="font-bold text-sm text-slate-900 mb-2">Need to adjust your order?</h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              You can cancel before fulfillment begins. After delivery, returns can be submitted within 30 days.
            </p>
            <OrderActions
              orderId={order.id}
              canCancel={isPreDispatch && order.status !== "CANCELLED"}
              canReturn={isDelivered}
              sellerOrderId={order.sellerOrders[0]?.id}
              items={allOrderItems}
            />
          </div>
        </div>

        {/* Right Column: Financial Breakdown & Shipping Details (1 col) */}
        <div className="space-y-6">
          {/* Shipping Address Snapshot */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 space-y-3 shadow-sm">
            <h3 className="font-extrabold text-sm text-slate-900 pb-2 border-b border-slate-100">
              Delivery Address
            </h3>
            <div className="text-xs text-slate-600 space-y-1 leading-relaxed">
              <p className="font-bold text-slate-900">{shippingAddress.fullName}</p>
              <p>{shippingAddress.street1}</p>
              {shippingAddress.street2 && <p>{shippingAddress.street2}</p>}
              <p>
                {shippingAddress.city}, {shippingAddress.stateProvince} {shippingAddress.postalCode}
              </p>
              <p className="font-semibold text-slate-700">{shippingAddress.countryCode}</p>
              {shippingAddress.phone && <p className="pt-1 text-slate-500">{shippingAddress.phone}</p>}
            </div>
          </div>

          {/* Payment & Invoicing Breakdown */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 space-y-4 shadow-sm">
            <h3 className="font-extrabold text-sm text-slate-900 pb-2 border-b border-slate-100">
              Payment Summary
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-900">
                  {formatCurrency(order.subtotalMinor)}
                </span>
              </div>

              {order.discountMinor > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Discount ({order.couponCode || "PROMO"})</span>
                  <span>-{formatCurrency(order.discountMinor)}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-600">
                <span>Shipping</span>
                <span className="font-semibold text-slate-900">
                  {order.shippingMinor === 0 ? "FREE" : formatCurrency(order.shippingMinor)}
                </span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Sales Tax</span>
                <span className="font-semibold text-slate-900">
                  {formatCurrency(order.taxMinor)}
                </span>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-between text-sm font-black text-slate-900">
                <span>Total Paid</span>
                <span className="text-indigo-700">{formatCurrency(order.totalMinor)}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500 space-y-1">
              <p className="font-bold text-slate-700">Payment Status: {order.paymentStatus}</p>
              <p>Currency: {order.currency}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
