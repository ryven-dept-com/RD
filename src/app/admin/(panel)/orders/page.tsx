import { getAllOrders } from "@/lib/admin-queries";
import { OrdersTable } from "./orders-table";

export const dynamic = "force-dynamic";

export const metadata = { title: "Orders" };

export default async function AdminOrdersPage() {
  const orders = await getAllOrders();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
        <p className="mt-1 text-sm text-slate-500">
          {orders.length} orders total
        </p>
      </div>

      <OrdersTable
        orders={orders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          fullName: o.fullName,
          phone: o.phone,
          wilaya: o.wilaya,
          total: o.total,
          status: o.status,
          createdAt:
            typeof o.createdAt === "string"
              ? o.createdAt
              : o.createdAt.toISOString(),
          itemCount: o.items.reduce((a, i) => a + i.quantity, 0),
        }))}
      />
    </div>
  );
}
