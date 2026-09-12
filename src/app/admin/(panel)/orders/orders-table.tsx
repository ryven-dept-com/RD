"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/db/schema";
import {
  DELIVERY_STATUS_LABELS,
  DELIVERY_STATUS_STYLES,
  formatDZD,
  formatDateTime,
  PAYMENT_STATUS_STYLES,
  STATUS_STYLES,
} from "@/lib/admin-format";

type Row = {
  id: number;
  orderNumber: string;
  fullName: string;
  email: string;
  phone: string;
  total: number;
  currency: string;
  status: string;
  paymentStatus: string;
  deliveryMethod: string;
  deliveryStatus: string;
  deliveryZoneCode: number;
  itemCount: number;
  stockRestored: boolean;
  createdAt: string;
  updatedAt: string;
};

const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "total-desc", label: "Total: high → low" },
  { value: "total-asc", label: "Total: low → high" },
];

export function OrdersTable({
  orders,
  total,
  page,
  pageSize,
}: {
  orders: Row[];
  total: number;
  page: number;
  pageSize: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const pushParams = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    // Any filter change resets pagination.
    if (!("page" in patch)) next.delete("page");
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    pushParams({ q: query.trim() });
  };

  const field =
    "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      {/* toolbar */}
      <form
        onSubmit={submitSearch}
        className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search order #, name, phone, email…"
          aria-label="Search orders"
          className={`w-full sm:max-w-xs ${field}`}
        />
        <select
          value={params.get("status") ?? ""}
          onChange={(e) => pushParams({ status: e.target.value })}
          aria-label="Filter by order status"
          className={field}
        >
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={params.get("payment") ?? ""}
          onChange={(e) => pushParams({ payment: e.target.value })}
          aria-label="Filter by payment status"
          className={field}
        >
          <option value="">All payments</option>
          {PAYMENT_STATUSES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={params.get("dateFrom") ?? ""}
            onChange={(e) => pushParams({ dateFrom: e.target.value })}
            aria-label="From date"
            className={field}
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={params.get("dateTo") ?? ""}
            onChange={(e) => pushParams({ dateTo: e.target.value })}
            aria-label="To date"
            className={field}
          />
        </div>
        <select
          value={params.get("sort") ?? "newest"}
          onChange={(e) => pushParams({ sort: e.target.value })}
          aria-label="Sort orders"
          className={field}
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <span className="text-sm text-slate-400 lg:ml-auto">
          {total} results
        </span>
      </form>

      {/* table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Items</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Payment</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center">
                  <p className="font-medium text-slate-500">No orders found</p>
                  <p className="mt-1 text-sm text-slate-400">
                    Adjust the search or filters, or wait for new checkouts.
                  </p>
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr
                  key={o.id}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{o.orderNumber}</p>
                    <p className="text-xs text-slate-400">#{o.id}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{o.fullName}</p>
                    <p className="text-xs text-slate-400">
                      {o.phone || o.email || "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDateTime(new Date(o.createdAt))}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">
                    {o.itemCount}
                  </td>
                  <td className="px-4 py-3 font-medium tabular-nums text-slate-900">
                    {formatDZD(o.total)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold capitalize ${
                        PAYMENT_STATUS_STYLES[o.paymentStatus] ??
                        "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {o.paymentStatus.replace("_", " ")}
                    </span>
                    <span
                      className={`mt-1 block w-fit rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        DELIVERY_STATUS_STYLES[o.deliveryStatus] ??
                        "bg-slate-100 text-slate-600"
                      }`}
                      title={`Delivery: ${o.deliveryMethod}`}
                    >
                      {DELIVERY_STATUS_LABELS[o.deliveryStatus] ?? o.deliveryStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        STATUS_STYLES[o.status] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end">
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        View
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm">
          <span className="text-slate-400">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => pushParams({ page: String(Math.max(1, page - 1)) })}
              disabled={page <= 1}
              className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              onClick={() =>
                pushParams({ page: String(Math.min(totalPages, page + 1)) })
              }
              disabled={page >= totalPages}
              className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
