import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderDetailAdmin } from "@/lib/order-admin";
import { ORDER_TRANSITIONS } from "@/lib/order-admin";
import { DELIVERY_TRANSITIONS } from "@/lib/delivery-admin";
import type { DeliveryStatus } from "@/db/schema";
import {
  formatDZD,
  formatDateTime,
  SHIPPING_METHOD_LABELS,
} from "@/lib/admin-format";
import { OrderActions } from "./order-actions";

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

  const detail = await getOrderDetailAdmin(orderId);
  if (!detail) notFound();
  const { order, notes, events } = detail;

  const deliveryFee = order.deliveryPrice || order.shipping;
  const currency = order.currency || "";

  const customerRows: [string, string][] = [
    ["Name", order.fullName],
    ["Email", order.email || "—"],
    ["Phone", order.phone || "—"],
  ];
  const shippingRows: [string, string][] = [
    ["Address", order.address || "—"],
    ["City", order.city || "—"],
    ["Wilaya", order.wilaya || "—"],
    ["Commune", order.commune || "—"],
    ["Postal code", order.postalCode || "—"],
    ["Country", order.country || "—"],
    // Phase 8: immutable shipping snapshot (as chosen at checkout).
    [
      "Shipping method",
      order.deliveryMethod
        ? (SHIPPING_METHOD_LABELS[order.deliveryMethod] ?? order.deliveryMethod)
        : "Home Delivery",
    ],
    ["Estimated delivery", order.deliveryEstimate || "—"],
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
          <p className="mt-1 text-sm text-slate-500">
            Created {formatDateTime(order.createdAt)} · Last updated{" "}
            {formatDateTime(order.updatedAt)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* items + totals + customer + shipping */}
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
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">
                      {item.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.color || "—"} · {item.size || "—"} · Qty{" "}
                      {item.quantity}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {item.sku || `#${item.productId}`}
                      {item.variantId ? ` · variant ${item.variantId}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">
                      {formatDZD(item.price)} each
                    </p>
                    <p className="font-medium tabular-nums text-slate-900">
                      {formatDZD(item.price * item.quantity)}
                    </p>
                  </div>
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
                <span className="tabular-nums">{formatDZD(deliveryFee)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-semibold text-slate-900">
                <span>Total {currency && `(${currency})`}</span>
                <span className="tabular-nums">{formatDZD(order.total)}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-4 font-semibold text-slate-900">Customer</h2>
              <dl className="space-y-3 text-sm">
                {customerRows.map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">
                      {label}
                    </dt>
                    <dd className="break-words text-slate-800" dir="auto">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-4 font-semibold text-slate-900">Shipping</h2>
              <dl className="space-y-3 text-sm">
                {shippingRows.map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">
                      {label}
                    </dt>
                    <dd className="break-words text-slate-800" dir="auto">
                      {value}
                    </dd>
                  </div>
                ))}
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">
                    Delivery fee
                  </dt>
                  <dd className="tabular-nums text-slate-800">
                    {formatDZD(deliveryFee)}
                  </dd>
                </div>
                {order.deliveryZoneCode > 0 && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">
                      Zone code
                    </dt>
                    <dd className="tabular-nums text-slate-800">
                      {order.deliveryZoneCode}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>

        {/* status/payment controls + notes + audit trail */}
        <OrderActions
          orderId={order.id}
          status={order.status}
          paymentStatus={order.paymentStatus}
          stockRestored={order.stockRestored}
          validNext={[...(ORDER_TRANSITIONS[order.status] ?? [])]}
          deliveryStatus={order.deliveryStatus}
          validDeliveryNext={[
            ...(DELIVERY_TRANSITIONS[order.deliveryStatus as DeliveryStatus] ?? []),
          ]}
          notes={notes.map((n) => ({
            id: n.id,
            author: n.author,
            body: n.body,
            createdAt: n.createdAt.toISOString(),
          }))}
          events={events.map((e) => ({
            id: e.id,
            kind: e.kind,
            fromValue: e.fromValue,
            toValue: e.toValue,
            actor: e.actor,
            note: e.note,
            createdAt: e.createdAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
