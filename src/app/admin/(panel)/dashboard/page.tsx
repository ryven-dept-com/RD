import Link from "next/link";
import { getDashboardStats, getRecentOrders } from "@/lib/admin-queries";
import { formatDZD, formatDateTime, STATUS_STYLES } from "@/lib/admin-format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [stats, recent] = await Promise.all([
    getDashboardStats(),
    getRecentOrders(6),
  ]);

  const cards = [
    { label: "Total Products", value: stats.totalProducts, tone: "bg-slate-900 text-white" },
    { label: "Total Orders", value: stats.totalOrders, tone: "bg-white" },
    { label: "New Orders — جديد", value: stats.statusCounts["جديد"], tone: "bg-white" },
    { label: "Confirmed — تم التأكيد", value: stats.statusCounts["تم التأكيد"], tone: "bg-white" },
    { label: "Shipped — تم الشحن", value: stats.statusCounts["تم الشحن"], tone: "bg-white" },
    { label: "Delivered — تم التسليم", value: stats.statusCounts["تم التسليم"], tone: "bg-white" },
    { label: "Cancelled — ملغى", value: stats.statusCounts["ملغى"], tone: "bg-white" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Overview of your store performance
        </p>
      </div>

      {/* total sales highlight */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 text-white shadow-sm lg:col-span-2">
          <p className="text-sm font-medium text-emerald-50">Total Sales</p>
          <p className="mt-2 text-3xl font-bold">{formatDZD(stats.totalSales)}</p>
          <p className="mt-1 text-xs text-emerald-100">
            Excludes cancelled orders
          </p>
        </div>
        {cards.slice(0, 2).map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.slice(2).map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      {/* recent orders */}
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Recent Orders</h2>
          <Link
            href="/admin/orders"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            View all →
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">
            No orders yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Order</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Total</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{o.fullName}</td>
                    <td className="px-5 py-3 font-medium tabular-nums text-slate-900">
                      {formatDZD(o.total)}
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      {formatDateTime(o.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                          STATUS_STYLES[o.status] ?? "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {o.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  const dark = tone.includes("text-white");
  return (
    <div className={`rounded-2xl border border-slate-200 p-5 shadow-sm ${tone}`}>
      <p className={`text-sm font-medium ${dark ? "text-slate-300" : "text-slate-500"}`}>
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
