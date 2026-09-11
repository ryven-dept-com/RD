import "server-only";
import { db } from "@/db";
import {
  categories,
  deliveryZones,
  orders,
  products,
  settings,
} from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";

export type DashboardStats = {
  totalProducts: number;
  totalOrders: number;
  statusCounts: Record<string, number>;
  totalSales: number; // cents, delivered + shipped + confirmed
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const [prodCount] = await db
    .select({ c: sql<number>`count(*)` })
    .from(products);

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

export async function getAllDeliveryZones() {
  return db.select().from(deliveryZones).orderBy(deliveryZones.code);
}

export async function getSettingsMap(): Promise<Record<string, string>> {
  const rows = await db.select().from(settings);
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}
