import Link from "next/link";
import type { SellerOperationalStatus } from "@prisma/client";
import { requireAdminPage } from "@/modules/admin/access";
import { listSellers, SELLER_STATUS_VALUES } from "@/modules/admin/sellers";
import { ADMIN_PAGE_SIZE, firstParam, parsePage } from "@/modules/admin/http";
import { formatDate } from "@/lib/formatters";
import { AdminBadge, AdminEmptyState, AdminFilterBar, AdminPageHeader, AdminPagination, adminCardCls, sellerStatusTone } from "@/components/admin-ui";

export default async function AdminSellersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage("sellers", "/admin/sellers");
  const sp = await searchParams;
  const q = firstParam(sp.q);
  const rawStatus = firstParam(sp.status);
  const status = (SELLER_STATUS_VALUES as string[]).includes(rawStatus) ? (rawStatus as SellerOperationalStatus) : null;
  const page = parsePage(sp.page);
  const { total, sellers } = await listSellers({ q, status, page });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Marketplace"
        title="Sellers"
        description="All seller organisations, including the WIZZ.PK Direct first-party store. Open a seller to manage status and commission."
      />

      <AdminFilterBar
        basePath="/admin/sellers"
        q={q}
        placeholder="Store name, legal name, slug or email"
        selectName="status"
        selectLabel="Status"
        selectValue={status ?? ""}
        selectOptions={[{ value: "", label: "All statuses" }, ...SELLER_STATUS_VALUES.map((s) => ({ value: s, label: s }))]}
      />

      {sellers.length === 0 ? (
        <AdminEmptyState title="No sellers match these filters" />
      ) : (
        <div className={`${adminCardCls} overflow-x-auto`}>
          <table className="w-full text-left text-xs min-w-[760px]">
            <caption className="sr-only">Seller organisations</caption>
            <thead className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-700">
              <tr>
                <th scope="col" className="px-4 py-3">Seller</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3 text-right">Products</th>
                <th scope="col" className="px-4 py-3 text-right">Seller orders</th>
                <th scope="col" className="px-4 py-3 text-right">Commission</th>
                <th scope="col" className="px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {sellers.map((s) => (
                <tr key={s.id} className="hover:bg-slate-800">
                  <td className="px-4 py-3">
                    <Link href={`/admin/sellers/${s.id}`} className="font-semibold text-white hover:text-brand-300">
                      {s.name}
                    </Link>
                    {s.isFirstParty && <span className="ml-2"><AdminBadge tone="accent">1P</AdminBadge></span>}
                    <span className="block text-slate-400 truncate max-w-[280px]">
                      {s.legalName} · {s.contactEmail}
                    </span>
                  </td>
                  <td className="px-4 py-3"><AdminBadge tone={sellerStatusTone(s.operationalStatus)}>{s.operationalStatus}</AdminBadge></td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-200">{s._count.products}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-200">{s._count.sellerOrders}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-white font-bold">{s.commissionRatePercent}%</td>
                  <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{formatDate(s.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminPagination basePath="/admin/sellers" page={page} pageSize={ADMIN_PAGE_SIZE} total={total} params={{ q, status: status ?? undefined }} />
    </div>
  );
}
