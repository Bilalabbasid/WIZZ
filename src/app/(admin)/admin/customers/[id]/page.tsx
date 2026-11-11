import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { requireAdminPage } from "@/modules/admin/access";
import { getCustomerDetail } from "@/modules/admin/customers";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/formatters";
import { AdminBadge, AdminEmptyState, adminCardCls, buildHref } from "@/components/admin-ui";

function orderTone(status: string) {
  if (status === "DELIVERED") return "success" as const;
  if (status === "CANCELLED" || status === "REFUNDED") return "danger" as const;
  if (status === "PENDING_PAYMENT") return "warning" as const;
  return "accent" as const;
}

export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdminPage("customers", `/admin/customers/${id}`);
  const customer = await getCustomerDetail(id);
  if (!customer) notFound();

  return (
    <div className="space-y-6">
      <Link href="/admin/customers" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-400 hover:text-brand-300">
        <ArrowLeft size={14} aria-hidden="true" /> All customers
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">Customer profile</span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1">
            {customer.firstName} {customer.lastName}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {customer.email} · {customer.phone || "no phone on file"}
          </p>
        </div>
        <AdminBadge tone={customer.isEmailVerified ? "success" : "warning"}>
          {customer.isEmailVerified ? "Email verified" : "Email not verified"}
        </AdminBadge>
      </div>

      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ["Joined", formatDate(customer.createdAt)],
          ["Orders", customer._count.orders.toLocaleString("en-PK")],
          ["Total spent", formatCurrency(customer.totalSpentMinor)],
          ["Return requests", customer.returnsCount.toLocaleString("en-PK")],
        ].map(([label, value]) => (
          <div key={label} className={`${adminCardCls} p-4`}>
            <dt className="text-[11px] font-semibold text-slate-400">{label}</dt>
            <dd className="text-lg font-black text-white tabular-nums mt-1">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-[11px] text-slate-500">
        Total spent excludes cancelled, refunded and unpaid orders. Account roles and passwords cannot be changed from this screen.
      </p>

      <section aria-labelledby="addr-h" className="space-y-3">
        <h2 id="addr-h" className="font-bold text-base text-white">Saved addresses</h2>
        {customer.addresses.length === 0 ? (
          <AdminEmptyState title="No saved addresses" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {customer.addresses.map((a) => (
              <div key={a.id} className={`${adminCardCls} p-4 text-xs space-y-1`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <MapPin size={13} className="text-brand-400" aria-hidden="true" />
                    {a.title || "Address"}
                  </span>
                  <span className="flex gap-1">
                    {a.isDefaultShipping && <AdminBadge tone="accent">Default shipping</AdminBadge>}
                    {a.isDefaultBilling && <AdminBadge tone="neutral">Default billing</AdminBadge>}
                  </span>
                </div>
                <p className="text-slate-200">{a.fullName} · {a.phone}</p>
                <p className="text-slate-400">
                  {a.street1}
                  {a.street2 ? `, ${a.street2}` : ""}, {a.city}, {a.stateProvince} {a.postalCode}, {a.countryCode}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="orders-h" className="space-y-3">
        <h2 id="orders-h" className="font-bold text-base text-white">
          Recent orders {customer._count.orders > customer.orders.length && <span className="text-xs text-slate-400 font-normal">(latest {customer.orders.length})</span>}
        </h2>
        {customer.orders.length === 0 ? (
          <AdminEmptyState title="This customer has not placed any orders" />
        ) : (
          <div className={`${adminCardCls} overflow-x-auto`}>
            <table className="w-full text-left text-xs min-w-[620px]">
              <caption className="sr-only">Recent orders</caption>
              <thead className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-700">
                <tr>
                  <th scope="col" className="px-4 py-3">Order</th>
                  <th scope="col" className="px-4 py-3">Placed</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Payment</th>
                  <th scope="col" className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {customer.orders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-3">
                      <Link href={buildHref("/admin/orders", { q: o.orderNumber })} className="font-semibold text-brand-300 hover:text-brand-200">
                        {o.orderNumber}
                      </Link>
                      <span className="block text-[10px] text-slate-500">{o._count.sellerOrders} seller package(s)</span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{formatDateTime(o.createdAt)}</td>
                    <td className="px-4 py-3"><AdminBadge tone={orderTone(o.status)}>{o.status.replace(/_/g, " ")}</AdminBadge></td>
                    <td className="px-4 py-3 text-slate-300">{o.paymentStatus}</td>
                    <td className="px-4 py-3 text-right font-bold text-white tabular-nums">{formatCurrency(o.totalMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
