import Link from "next/link";
import { requireAdminPage } from "@/modules/admin/access";
import { listCustomers } from "@/modules/admin/customers";
import { ADMIN_PAGE_SIZE, firstParam, parsePage } from "@/modules/admin/http";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { AdminBadge, AdminEmptyState, AdminFilterBar, AdminPageHeader, AdminPagination, adminCardCls } from "@/components/admin-ui";

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage("customers", "/admin/customers");
  const sp = await searchParams;
  const q = firstParam(sp.q);
  const page = parsePage(sp.page);
  const { total, customers } = await listCustomers({ q, page });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Customer Support"
        title="Customers"
        description="Registered customer accounts. Total spent counts orders that are not cancelled, refunded or awaiting payment."
      />

      <AdminFilterBar basePath="/admin/customers" q={q} placeholder="Name, email or phone" />

      {customers.length === 0 ? (
        <AdminEmptyState title={q ? "No customers match your search" : "No customers yet"} description={q ? "Try a different name, email or phone number." : undefined} />
      ) : (
        <div className={`${adminCardCls} overflow-x-auto`}>
          <table className="w-full text-left text-xs min-w-[720px]">
            <caption className="sr-only">Customer accounts</caption>
            <thead className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-700">
              <tr>
                <th scope="col" className="px-4 py-3">Customer</th>
                <th scope="col" className="px-4 py-3">Phone</th>
                <th scope="col" className="px-4 py-3">Joined</th>
                <th scope="col" className="px-4 py-3 text-right">Orders</th>
                <th scope="col" className="px-4 py-3 text-right">Total spent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-800">
                  <td className="px-4 py-3">
                    <Link href={`/admin/customers/${c.id}`} className="font-semibold text-white hover:text-brand-300 focus:outline-none focus-visible:underline">
                      {c.firstName} {c.lastName}
                    </Link>
                    <div className="text-slate-400 flex items-center gap-2 mt-0.5">
                      <span className="truncate max-w-[260px]">{c.email}</span>
                      {!c.isEmailVerified && <AdminBadge tone="warning">Unverified</AdminBadge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{c.phone || "—"}</td>
                  <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{formatDate(c.createdAt)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-200">{c.orderCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-white">{formatCurrency(c.totalSpentMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminPagination basePath="/admin/customers" page={page} pageSize={ADMIN_PAGE_SIZE} total={total} params={{ q }} />
    </div>
  );
}
