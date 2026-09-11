import Link from "next/link";
import { getAnalyticsData } from "@/lib/admin-queries";
import { formatDZD, STATUS_STYLES } from "@/lib/admin-format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const data = await getAnalyticsData(14);

  const cards = [
    {
      label: "Total Revenue",
      value: formatDZD(data.totalRevenue),
      note: "Excludes cancelled orders",
    },
    {
      label: "Average Order Value",
      value: formatDZD(data.averageOrderValue),
      note: "Across non-cancelled orders",
    },
    {
      label: "Orders — last 30 days",
      value: String(data.ordersLast30),
      note: `${formatDZD(data.revenueLast30)} revenue`,
    },
  ];

  const maxCount = Math.max(1, ...data.daily.map((d) => d.count));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="mt-1 text-sm text-slate-500">
          Sales and order insights computed from live order data
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm font-medium text-slate-500">{c.label}</p>
            <p className="mt-2 truncate text-2xl font-bold tabular-nums text-slate-900">
              {c.value}
            </p>
            <p className="mt-1 text-xs text-slate-400">{c.note}</p>
          </div>
        ))}
      </div>

      {/* orders — last 14 days */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Orders — last 14 days</h2>
          <span className="text-xs text-slate-400">
            {data.daily.reduce((a, d) => a + d.count, 0)} orders in period
          </span>
        </div>
        <div className="flex h-44 items-end gap-1 sm:gap-2">
          {data.daily.map((d) => (
            <div
              key={d.date}
              className="group flex flex-1 flex-col items-center justify-end gap-1.5 self-stretch"
              title={`${d.label} — ${d.count} orders · ${formatDZD(d.revenue)}`}
            >
              <span className="text-[10px] font-medium tabular-nums text-slate-400 opacity-0 transition-opacity group-hover:opacity-100">
                {d.count}
              </span>
              <div
                className={`w-full rounded-t-md transition-colors ${
                  d.count > 0
                    ? "bg-slate-900 group-hover:bg-slate-700"
                    : "bg-slate-100"
                }`}
                style={{
                  height: `${Math.max(d.count > 0 ? 8 : 3, (d.count / maxCount) * 100)}%`,
                }}
              />
              <span className="hidden text-[10px] text-slate-400 sm:block">
                {d.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* top products */}
        <div className="rounded-2xl border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 px-5 py-4 font-semibold text-slate-900">
            Top products by units sold
          </h2>
          {data.topProducts.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-400">
              No completed sales yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.topProducts.map((p, i) => (
                <li key={p.slug} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-5 text-sm font-semibold text-slate-400">
                    {i + 1}
                  </span>
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {p.name}
                    </p>
                    <p className="text-xs text-slate-400">{p.units} units</p>
                  </div>
                  <span className="text-sm font-medium tabular-nums text-slate-900">
                    {formatDZD(p.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* status breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 px-5 py-4 font-semibold text-slate-900">
            Orders by status
          </h2>
          {data.byStatus.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-400">
              No orders yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.byStatus.map((s) => (
                <li
                  key={s.status}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <span
                    className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                      STATUS_STYLES[s.status] ?? "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {s.status}
                  </span>
                  <span className="text-sm tabular-nums text-slate-600">
                    {s.count} orders
                  </span>
                  <span className="text-sm font-medium tabular-nums text-slate-900">
                    {formatDZD(s.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* top wilayas */}
      <div className="rounded-2xl border border-slate-200 bg-white">
        <h2 className="border-b border-slate-200 px-5 py-4 font-semibold text-slate-900">
          Top wilayas by orders
        </h2>
        {data.topWilayas.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">
            No delivery data yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Wilaya</th>
                  <th className="px-5 py-3 font-medium">Orders</th>
                  <th className="px-5 py-3 font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.topWilayas.map((w) => (
                  <tr
                    key={w.wilaya}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-5 py-3 text-slate-800" dir="auto">
                      {w.wilaya}
                    </td>
                    <td className="px-5 py-3 tabular-nums text-slate-600">
                      {w.count}
                    </td>
                    <td className="px-5 py-3 font-medium tabular-nums text-slate-900">
                      {formatDZD(w.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400">
        All figures are calculated from live order records — nothing is
        estimated or mocked.{" "}
        <Link href="/admin/orders" className="font-medium hover:text-slate-600">
          View orders →
        </Link>
      </p>
    </div>
  );
}
