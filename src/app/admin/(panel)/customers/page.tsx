import { getCustomerSummaries } from "@/lib/admin-queries";
import { formatDZD } from "@/lib/admin-format";
import { CustomersTable } from "./customers-table";

export const dynamic = "force-dynamic";

export const metadata = { title: "Customers" };

export default async function CustomersPage() {
  const customers = await getCustomerSummaries();

  const repeat = customers.filter((c) => c.orderCount > 1).length;
  const totalSpent = customers.reduce((a, c) => a + c.totalSpent, 0);
  const totalOrders = customers.reduce((a, c) => a + c.orderCount, 0);

  const cards = [
    { label: "Total Customers", value: String(customers.length) },
    { label: "Repeat Customers", value: String(repeat) },
    { label: "Total Orders", value: String(totalOrders) },
    { label: "Lifetime Spend", value: formatDZD(totalSpent) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
        <p className="mt-1 text-sm text-slate-500">
          Derived from real order history, grouped by contact details
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm font-medium text-slate-500">{c.label}</p>
            <p className="mt-2 truncate text-2xl font-bold tabular-nums text-slate-900">
              {c.value}
            </p>
          </div>
        ))}
      </div>

      <CustomersTable
        customers={customers.map((c) => ({
          key: c.key,
          name: c.name,
          email: c.email,
          phone: c.phone,
          wilaya: c.wilaya,
          orderCount: c.orderCount,
          itemCount: c.itemCount,
          totalSpent: c.totalSpent,
          lastOrderAt:
            typeof c.lastOrderAt === "string"
              ? c.lastOrderAt
              : c.lastOrderAt.toISOString(),
        }))}
      />
    </div>
  );
}
