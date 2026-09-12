import { searchOrdersAdmin } from "@/lib/order-admin";
import { OrdersTable } from "./orders-table";

export const dynamic = "force-dynamic";

export const metadata = { title: "Orders" };

type SearchParams = Promise<{
  q?: string;
  status?: string;
  payment?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
  page?: string;
}>;

const SORTS = new Set(["newest", "oldest", "total-desc", "total-asc"]);

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  const result = await searchOrdersAdmin({
    q: sp.q?.trim() || undefined,
    status: sp.status || undefined,
    payment: sp.payment || undefined,
    dateFrom: sp.dateFrom || undefined,
    dateTo: sp.dateTo || undefined,
    sort: sp.sort && SORTS.has(sp.sort) ? (sp.sort as "newest") : "newest",
    page: Number(sp.page) || 1,
    pageSize: 20,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
        <p className="mt-1 text-sm text-slate-500">
          {result.total} orders total
        </p>
      </div>

      <OrdersTable
        orders={result.orders}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
      />
    </div>
  );
}
