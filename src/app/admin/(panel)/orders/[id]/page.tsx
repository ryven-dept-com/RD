import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderById } from "@/lib/admin-queries";
import { formatDZD, formatDateTime } from "@/lib/admin-format";
import { OrderStatusUpdater } from "./status-updater";

export const dynamic = "force-dynamic";

export const metadata = { title: "Order Details" };

export default async function OrderViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) notFound();

  const order = await getOrderById(orderId);
  if (!order) notFound();

  const rows: [string, string][] = [
    ["Customer", order.fullName],
    ["Phone", order.phone || "—"],
    ["Email", order.email || "—"],
    ["Wilaya", order.wilaya || "—"],
    ["Commune", order.commune || order.city || "—"],
    ["Address", order.address || "—"],
    ["Order date", formatDateTime(order.createdAt)],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/admin/orders"
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            ← Back to orders
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Order {order.orderNumber}
          </h1>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* items + totals */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white">
            <h2 className="border-b border-slate-200 px-5 py-4 font-semibold text-slate-900">
              Items
            </h2>
            <ul className="divide-y divide-slate-100">
              {order.items.map((item, i) => (
                <li key={i} className="flex gap-4 px-5 py-4">
                  <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">
                      {item.color} · {item.size} · Qty {item.quantity}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {formatDZD(item.price)} each
                    </p>
                  </div>
                  <span className="self-center font-medium tabular-nums text-slate-900">
                    {formatDZD(item.price * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="space-y-2 border-t border-slate-200 px-5 py-4 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatDZD(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Delivery</span>
                <span className="tabular-nums">
                  {formatDZD(order.deliveryPrice || order.shipping)}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-semibold text-slate-900">
                <span>Total</span>
                <span className="tabular-nums">{formatDZD(order.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* customer + status */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 font-semibold text-slate-900">Status</h2>
            <OrderStatusUpdater orderId={order.id} current={order.status} />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 font-semibold text-slate-900">
              Customer & delivery
            </h2>
            <dl className="space-y-3 text-sm">
              {rows.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">
                    {label}
                  </dt>
                  <dd className="text-slate-800" dir="auto">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
