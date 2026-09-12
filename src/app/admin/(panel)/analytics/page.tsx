import Link from "next/link";
import {
  ANALYTICS_RANGES,
  getAdvancedAnalytics,
  isAnalyticsRange,
  STORE_TIMEZONE,
  type AnalyticsRange,
} from "@/lib/analytics";
import {
  DELIVERY_STATUS_LABELS,
  DELIVERY_STATUS_STYLES,
  SHIPPING_METHOD_LABELS,
  STATUS_STYLES,
  formatDZD,
} from "@/lib/admin-format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Analytics" };

const RANGE_LABELS: Record<AnalyticsRange, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  all: "All time",
};

const card = "rounded-2xl border border-slate-200 bg-white shadow-sm";

function Empty({ text }: { text: string }) {
  return (
    <p className="px-5 py-10 text-center text-sm text-slate-400">{text}</p>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const range: AnalyticsRange = isAnalyticsRange(params.range)
    ? params.range
    : "30d";
  const data = await getAdvancedAnalytics(range);
  const { kpis } = data;

  const kpiCards = [
    { label: "Total Revenue", value: formatDZD(kpis.totalRevenue), note: "Excludes cancelled & returned" },
    { label: "Total Orders", value: String(kpis.totalOrders), note: "All orders in period" },
    { label: "Average Order Value", value: formatDZD(kpis.averageOrderValue), note: "Across revenue orders" },
    { label: "Products Sold", value: String(kpis.productsSold), note: "Units, real sales only" },
    { label: "Completed", value: String(kpis.completed), note: "تم التسليم" },
    { label: "Cancelled", value: String(kpis.cancelled), note: "ملغى" },
    { label: "Returned", value: String(kpis.returned), note: "مرجع" },
  ];

  const maxRevenue = Math.max(1, ...data.series.map((s) => s.revenue));
  const maxOrders = Math.max(1, ...data.series.map((s) => s.orders));
  const showEveryNth = data.series.length > 45 ? 10 : data.series.length > 14 ? 5 : 1;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">
            Business insights computed from live order data · timezone{" "}
            {STORE_TIMEZONE}
          </p>
        </div>
        <nav className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1" aria-label="Analytics period">
          {ANALYTICS_RANGES.map((r) => (
            <Link
              key={r}
              href={r === "30d" ? "/admin/analytics" : `/admin/analytics?range=${r}`}
              aria-current={r === range ? "page" : undefined}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                r === range
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {RANGE_LABELS[r]}
            </Link>
          ))}
        </nav>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((c) => (
          <div key={c.label} className={`${card} p-5`}>
            <p className="text-sm font-medium text-slate-500">{c.label}</p>
            <p className="mt-2 truncate text-2xl font-bold tabular-nums text-slate-900">
              {c.value}
            </p>
            <p className="mt-1 text-xs text-slate-400" dir="auto">{c.note}</p>
          </div>
        ))}
      </div>

      {/* Revenue & orders over time */}
      <div className={card}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">
            Revenue &amp; orders over time
          </h2>
          <span className="text-xs text-slate-400">
            {kpis.totalOrders} orders · {formatDZD(kpis.totalRevenue)}
          </span>
        </div>
        {data.series.length === 0 || kpis.totalOrders === 0 ? (
          <Empty text="No orders in this period yet." />
        ) : (
          <div className="px-5 py-4">
            <div className="flex h-48 items-end gap-[2px] sm:gap-1">
              {data.series.map((s, i) => (
                <div
                  key={s.key}
                  className="group flex flex-1 flex-col items-center justify-end gap-1.5 self-stretch"
                  title={`${s.label} — ${s.orders} orders · ${formatDZD(s.revenue)}`}
                >
                  <div className="flex w-full flex-1 items-end justify-center gap-[2px]">
                    <div
                      className={`w-1/2 max-w-4 rounded-t ${s.revenue > 0 ? "bg-slate-900" : "bg-slate-100"}`}
                      style={{ height: `${Math.max(s.revenue > 0 ? 6 : 3, (s.revenue / maxRevenue) * 100)}%` }}
                    />
                    <div
                      className={`w-1/2 max-w-4 rounded-t ${s.orders > 0 ? "bg-slate-400" : "bg-slate-100"}`}
                      style={{ height: `${Math.max(s.orders > 0 ? 6 : 3, (s.orders / maxOrders) * 100)}%` }}
                    />
                  </div>
                  <span className="hidden text-[10px] text-slate-400 sm:block">
                    {i % showEveryNth === 0 ? s.label : ""}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 flex items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-slate-900" /> Revenue
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-slate-400" /> Orders
              </span>
            </p>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Orders by status */}
        <div className={card}>
          <h2 className="border-b border-slate-200 px-5 py-4 font-semibold text-slate-900">
            Orders by status
          </h2>
          {data.byStatus.length === 0 ? (
            <Empty text="No orders in this period." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.byStatus.map((s) => (
                <li key={s.status} className="flex items-center gap-3 px-5 py-3">
                  <span
                    className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                      STATUS_STYLES[s.status] ?? "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {s.status}
                  </span>
                  <span className="flex-1 text-sm tabular-nums text-slate-600">
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

        {/* Delivery */}
        <div className={card}>
          <h2 className="border-b border-slate-200 px-5 py-4 font-semibold text-slate-900">
            Delivery
          </h2>
          {data.delivery.byMethod.length === 0 ? (
            <Empty text="No delivery data in this period." />
          ) : (
            <div className="space-y-4 px-5 py-4">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                  Method
                </p>
                <ul className="space-y-2">
                  {data.delivery.byMethod.map((m) => (
                    <li key={m.method} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">
                        {SHIPPING_METHOD_LABELS[m.method] ?? m.method}
                      </span>
                      <span className="tabular-nums text-slate-600">
                        {m.count} orders · {formatDZD(m.revenue)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                  Parcel lifecycle
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.delivery.byParcelStatus.map((s) => (
                    <span
                      key={s.status}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        DELIVERY_STATUS_STYLES[s.status] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {DELIVERY_STATUS_LABELS[s.status] ?? s.status}: {s.count}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  Counts only — shipping-duration metrics are not computed
                  because dispatch timestamps are not recorded.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Product analytics */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className={card}>
          <h2 className="border-b border-slate-200 px-5 py-4 font-semibold text-slate-900">
            Top selling products
          </h2>
          {data.topProducts.length === 0 ? (
            <Empty text="No completed sales in this period." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.topProducts.map((p, i) => (
                <li key={p.slug} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-5 text-sm font-semibold text-slate-400">{i + 1}</span>
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{p.name}</p>
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

        <div className={card}>
          <h2 className="border-b border-slate-200 px-5 py-4 font-semibold text-slate-900">
            Top variants
          </h2>
          {data.topVariants.length === 0 ? (
            <Empty text="No variant sales in this period." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-3 font-medium">SKU</th>
                    <th className="px-3 py-3 font-medium">Size</th>
                    <th className="px-3 py-3 font-medium">Color</th>
                    <th className="px-3 py-3 font-medium">Units</th>
                    <th className="px-5 py-3 text-right font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topVariants.map((v, i) => (
                    <tr key={`${v.sku}-${i}`} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-800">{v.sku}</td>
                      <td className="px-3 py-3 text-slate-600">{v.size}</td>
                      <td className="px-3 py-3 text-slate-600">{v.color}</td>
                      <td className="px-3 py-3 tabular-nums text-slate-600">{v.units}</td>
                      <td className="px-5 py-3 text-right font-medium tabular-nums text-slate-900">
                        {formatDZD(v.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Size / color performance */}
      <div className="grid gap-6 lg:grid-cols-2">
        {[
          { title: "Size performance", rows: data.bySize },
          { title: "Color performance", rows: data.byColor },
        ].map(({ title, rows }) => (
          <div key={title} className={card}>
            <h2 className="border-b border-slate-200 px-5 py-4 font-semibold text-slate-900">
              {title}
            </h2>
            {rows.length === 0 ? (
              <Empty text="No sales data in this period." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {rows.slice(0, 8).map((r) => {
                  const maxUnits = Math.max(1, ...rows.map((x) => x.units));
                  return (
                    <li key={r.option} className="px-5 py-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-800">{r.option}</span>
                        <span className="tabular-nums text-slate-600">
                          {r.units} units · {formatDZD(r.revenue)}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-slate-900"
                          style={{ width: `${(r.units / maxUnits) * 100}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </div>

      {/* Wilaya analytics */}
      <div className={card}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Wilaya analytics</h2>
          <span className="text-xs text-slate-400">
            From the immutable delivery snapshot on each order
          </span>
        </div>
        {data.byWilaya.length === 0 ? (
          <Empty text="No wilaya data in this period." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Wilaya</th>
                  <th className="px-3 py-3 font-medium">Orders</th>
                  <th className="px-3 py-3 font-medium">Revenue</th>
                  <th className="px-3 py-3 font-medium">Completed</th>
                  <th className="px-3 py-3 font-medium">Cancelled</th>
                  <th className="px-5 py-3 font-medium">Returned</th>
                </tr>
              </thead>
              <tbody>
                {data.byWilaya.map((w) => (
                  <tr key={w.wilaya} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-800" dir="auto">{w.wilaya}</td>
                    <td className="px-3 py-3 tabular-nums text-slate-600">{w.orders}</td>
                    <td className="px-3 py-3 tabular-nums text-slate-600">{formatDZD(w.revenue)}</td>
                    <td className="px-3 py-3 tabular-nums text-emerald-700">{w.completed}</td>
                    <td className="px-3 py-3 tabular-nums text-rose-600">{w.cancelled}</td>
                    <td className="px-5 py-3 tabular-nums text-orange-600">{w.returned}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Funnel */}
      <div className={card}>
        <h2 className="border-b border-slate-200 px-5 py-4 font-semibold text-slate-900">
          Purchase funnel (direct BUY NOW)
        </h2>
        <div className="grid gap-3 px-5 py-4 sm:grid-cols-4">
          {[
            { stage: "Visit", note: "Meta Pixel PageView", real: false },
            { stage: "Product View", note: "Meta Pixel ViewContent", real: false },
            { stage: "Initiate Checkout", note: "Meta Pixel InitiateCheckout", real: false },
            {
              stage: "Purchase",
              note: `${data.funnel.purchases} orders · ${formatDZD(data.funnel.purchaseRevenue)}`,
              real: true,
            },
          ].map((s) => (
            <div
              key={s.stage}
              className={`rounded-xl border p-4 ${
                s.real
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <p className="text-sm font-semibold text-slate-900">{s.stage}</p>
              <p className="mt-1 text-xs text-slate-500">{s.note}</p>
              {!s.real && (
                <p className="mt-2 text-[11px] leading-snug text-slate-400">
                  Not stored server-side — verify in Meta Events Manager.
                </p>
              )}
            </div>
          ))}
        </div>
        <p className="px-5 pb-4 text-xs text-slate-400">
          Upstream funnel stages are sent to Meta from the browser and are not
          recorded in this database, so only Purchases (real orders) can be
          counted here. No historical numbers are estimated.
        </p>
      </div>
    </div>
  );
}
