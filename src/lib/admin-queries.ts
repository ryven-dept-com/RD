import "server-only";
import { db } from "@/db";
import {
  categories,
  deliveryZones,
  orders,
  products,
} from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";

export type DashboardStats = {
  totalProducts: number;
  totalCategories: number;
  totalOrders: number;
  statusCounts: Record<string, number>;
  totalSales: number; // cents, delivered + shipped + confirmed
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const [prodCount] = await db
    .select({ c: sql<number>`count(*)` })
    .from(products);

  const [catCount] = await db
    .select({ c: sql<number>`count(*)` })
    .from(categories);

  const rows = await db
    .select({
      status: orders.status,
      c: sql<number>`count(*)`,
      sum: sql<number>`coalesce(sum(${orders.total}), 0)`,
    })
    .from(orders)
    .groupBy(orders.status);

  const statusCounts: Record<string, number> = {
    جديد: 0,
    "تم التأكيد": 0,
    "قيد التحضير": 0,
    "تم الشحن": 0,
    "تم التسليم": 0,
    ملغى: 0,
  };
  let totalOrders = 0;
  let totalSales = 0;
  for (const r of rows) {
    const count = Number(r.c);
    totalOrders += count;
    if (r.status in statusCounts) statusCounts[r.status] = count;
    if (r.status !== "ملغى") totalSales += Number(r.sum);
  }

  return {
    totalProducts: Number(prodCount?.c ?? 0),
    totalCategories: Number(catCount?.c ?? 0),
    totalOrders,
    statusCounts,
    totalSales,
  };
}

export async function getRecentOrders(limit = 8) {
  return db.select().from(orders).orderBy(desc(orders.createdAt)).limit(limit);
}

export async function getAllOrders() {
  return db.select().from(orders).orderBy(desc(orders.createdAt));
}

export async function getOrderById(id: number) {
  const [row] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return row ?? null;
}

export async function getAllProductsAdmin() {
  return db.select().from(products).orderBy(desc(products.createdAt));
}

export async function getProductByIdAdmin(id: number) {
  const [row] = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  return row ?? null;
}

export async function getAllCategories() {
  return db.select().from(categories).orderBy(categories.name);
}

/** Lightweight product list for CMS pickers (id / name / first image). */
export async function getProductOptions() {
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      images: products.images,
    })
    .from(products)
    .orderBy(products.name);
  return rows.map((p) => ({ id: p.id, name: p.name, image: p.images[0] ?? "" }));
}

export async function getAllDeliveryZones() {
  return db.select().from(deliveryZones).orderBy(deliveryZones.code);
}

// Settings live in the central settings service (single source of truth).
export { getSettingsMap } from "@/lib/settings";

// ---------------- Customers (derived from real order data) -----------------

export type CustomerSummary = {
  key: string;
  name: string;
  email: string;
  phone: string;
  wilaya: string;
  orderCount: number;
  itemCount: number;
  totalSpent: number; // cents
  lastOrderAt: Date;
};

/**
 * The store has no dedicated customer accounts table, so customers are
 * derived from real orders: grouped by email when present, otherwise by
 * name + phone combination. No data is invented.
 */
export async function getCustomerSummaries(): Promise<CustomerSummary[]> {
  const all = await getAllOrders();
  const map = new Map<string, CustomerSummary>();

  for (const o of all) {
    const email = o.email.trim().toLowerCase();
    const key = email || `${o.fullName.trim().toLowerCase()}|${o.phone.trim()}`;
    const items = o.items.reduce((a, i) => a + i.quantity, 0);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        name: o.fullName,
        email: o.email,
        phone: o.phone,
        wilaya: o.wilaya,
        orderCount: 1,
        itemCount: items,
        totalSpent: o.total,
        lastOrderAt: o.createdAt,
      });
      continue;
    }
    existing.orderCount += 1;
    existing.itemCount += items;
    existing.totalSpent += o.total;
    if (o.createdAt > existing.lastOrderAt) {
      existing.lastOrderAt = o.createdAt;
      // keep the most recent contact/shipping details on file
      if (o.email) existing.email = o.email;
      if (o.phone) existing.phone = o.phone;
      if (o.wilaya) existing.wilaya = o.wilaya;
      existing.name = o.fullName;
    }
  }

  return [...map.values()].sort((a, b) => b.totalSpent - a.totalSpent);
}

// ---------------- Analytics (all computed from real orders) ----------------

export type DailyOrders = {
  date: string; // YYYY-MM-DD (UTC)
  label: string; // DD/MM
  count: number;
  revenue: number; // cents, excluding cancelled
};

export type TopProduct = {
  name: string;
  slug: string;
  image: string;
  units: number;
  revenue: number; // cents
};

export type StatusBreakdown = {
  status: string;
  count: number;
  revenue: number; // cents
};

export type WilayaBreakdown = {
  wilaya: string;
  count: number;
  revenue: number; // cents
};

export type AnalyticsData = {
  totalRevenue: number; // cents, excluding cancelled
  averageOrderValue: number; // cents, excluding cancelled
  ordersLast30: number;
  revenueLast30: number; // cents, excluding cancelled
  daily: DailyOrders[]; // last 14 days, oldest first
  topProducts: TopProduct[];
  byStatus: StatusBreakdown[];
  topWilayas: WilayaBreakdown[];
};

const CANCELLED = "ملغى";

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function getAnalyticsData(days = 14): Promise<AnalyticsData> {
  const all = await getAllOrders();

  let totalRevenue = 0;
  let activeOrders = 0;
  let ordersLast30 = 0;
  let revenueLast30 = 0;

  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  // daily buckets (UTC days), oldest first
  const buckets = new Map<string, DailyOrders>();
  const daysStart = new Date(now);
  daysStart.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(daysStart.getTime() - i * 24 * 60 * 60 * 1000);
    const key = dayKey(d);
    buckets.set(key, {
      date: key,
      label: `${String(d.getUTCDate()).padStart(2, "0")}/${String(
        d.getUTCMonth() + 1,
      ).padStart(2, "0")}`,
      count: 0,
      revenue: 0,
    });
  }

  const productAgg = new Map<string, TopProduct>();
  const statusAgg = new Map<string, StatusBreakdown>();
  const wilayaAgg = new Map<string, WilayaBreakdown>();

  for (const o of all) {
    const cancelled = o.status === CANCELLED;
    const bucket = buckets.get(dayKey(o.createdAt));
    if (bucket) bucket.count += 1;

    if (!cancelled) {
      totalRevenue += o.total;
      activeOrders += 1;
      if (bucket) bucket.revenue += o.total;
      if (o.createdAt.getTime() >= thirtyDaysAgo) {
        ordersLast30 += 1;
        revenueLast30 += o.total;
      }

      for (const item of o.items) {
        const p = productAgg.get(item.slug) ?? {
          name: item.name,
          slug: item.slug,
          image: item.image,
          units: 0,
          revenue: 0,
        };
        p.units += item.quantity;
        p.revenue += item.price * item.quantity;
        productAgg.set(item.slug, p);
      }

      if (o.wilaya.trim()) {
        const w = wilayaAgg.get(o.wilaya) ?? {
          wilaya: o.wilaya,
          count: 0,
          revenue: 0,
        };
        w.count += 1;
        w.revenue += o.total;
        wilayaAgg.set(o.wilaya, w);
      }
    }

    const s = statusAgg.get(o.status) ?? {
      status: o.status,
      count: 0,
      revenue: 0,
    };
    s.count += 1;
    s.revenue += cancelled ? 0 : o.total;
    statusAgg.set(o.status, s);
  }

  return {
    totalRevenue,
    averageOrderValue: activeOrders ? Math.round(totalRevenue / activeOrders) : 0,
    ordersLast30,
    revenueLast30,
    daily: [...buckets.values()],
    topProducts: [...productAgg.values()]
      .sort((a, b) => b.units - a.units || b.revenue - a.revenue)
      .slice(0, 8),
    byStatus: [...statusAgg.values()].sort((a, b) => b.count - a.count),
    topWilayas: [...wilayaAgg.values()]
      .sort((a, b) => b.count - a.count || b.revenue - a.revenue)
      .slice(0, 8),
  };
}

