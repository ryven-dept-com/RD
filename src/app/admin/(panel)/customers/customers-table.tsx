"use client";

import { useMemo, useState } from "react";
import { formatDZD, formatDateTime } from "@/lib/admin-format";

export type CustomerRow = {
  key: string;
  name: string;
  email: string;
  phone: string;
  wilaya: string;
  orderCount: number;
  itemCount: number;
  totalSpent: number;
  lastOrderAt: string;
};

export function CustomersTable({ customers }: { customers: CustomerRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.wilaya.toLowerCase().includes(q),
    );
  }, [customers, query]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email, phone, wilaya…"
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none sm:max-w-xs"
        />
        <span className="text-sm text-slate-400 sm:ml-auto">
          {filtered.length} customers
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Wilaya</th>
              <th className="px-4 py-3 font-medium">Orders</th>
              <th className="px-4 py-3 font-medium">Items</th>
              <th className="px-4 py-3 font-medium">Total spent</th>
              <th className="px-4 py-3 font-medium">Last order</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  No customers found.
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr
                  key={c.key}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900" dir="auto">
                          {c.name}
                        </p>
                        {c.orderCount > 1 && (
                          <p className="text-xs font-medium text-emerald-600">
                            Repeat customer
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-700">{c.email || "—"}</p>
                    <p className="text-xs text-slate-400" dir="ltr">
                      {c.phone || "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-600" dir="auto">
                    {c.wilaya || "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">
                    {c.orderCount}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">
                    {c.itemCount}
                  </td>
                  <td className="px-4 py-3 font-medium tabular-nums text-slate-900">
                    {formatDZD(c.totalSpent)}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {formatDateTime(c.lastOrderAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
