import { db } from "@/db";
import { orders } from "@/db/schema";
import { verifyRequest } from "@/lib/admin-auth";
import {
  countsAsRevenue,
  resolveRangeStart,
  STORE_TIMEZONE,
} from "@/lib/analytics";
import {
  STATUS_CONFIRMED,
  STATUS_PENDING,
  STATUS_PROCESSING,
} from "@/lib/order-admin";

export const dynamic = "force-dynamic";

/**
 * Mobile admin app dashboard KPIs (admin-only, CSRF-checked).
 *
 * Computed from REAL order rows — the same conventions as the web admin:
 * revenue excludes cancelled/returned orders, "today" follows the store's
 * operating timezone (Africa/Algiers). No simulated data: an empty store
 * returns zeros.
 */
export async function GET(request: Request) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const todayStart = resolveRangeStart("today", now);

    const rows = await db
      .select({
        createdAt: orders.createdAt,
        status: orders.status,
        total: orders.total,
        items: orders.items,
      })
      .from(orders);

    let ordersToday = 0;
    let revenueToday = 0;
    let productsSoldToday = 0;
    let newOrders = 0; // new (جديد) across the whole lifetime
    let pendingOrders = 0; // not yet shipped (new/confirmed/preparing)
    const pendingSet = new Set([STATUS_PENDING, STATUS_CONFIRMED, STATUS_PROCESSING]);

    for (const o of rows) {
      if (o.status === STATUS_PENDING) newOrders += 1;
      if (pendingSet.has(o.status)) pendingOrders += 1;
      if (todayStart && o.createdAt.getTime() >= todayStart.getTime()) {
        ordersToday += 1;
        if (countsAsRevenue(o.status)) {
          revenueToday += o.total;
          for (const item of o.items) productsSoldToday += item.quantity;
        }
      }
    }

    return Response.json({
      ok: true,
      timezone: STORE_TIMEZONE,
      today: {
        orders: ordersToday,
        revenue: revenueToday,
        productsSold: productsSoldToday,
        currency: "DZD",
      },
      orders: {
        new: newOrders,
        pending: pendingOrders,
      },
      computedAt: now.toISOString(),
    });
  } catch (err) {
    console.error("GET /api/admin/dashboard failed:", err);
    return Response.json(
      { ok: false, error: "Server error" },
      { status: 500 },
    );
  }
}
