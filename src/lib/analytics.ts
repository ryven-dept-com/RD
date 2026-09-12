import "server-only";

import { db } from "@/db";
import { orders, type OrderItem } from "@/db/schema";

/**
 * Phase 10 — advanced business analytics.
 *
 * Every number on the admin Analytics page is computed from REAL order
 * rows (orders + their jsonb item snapshots + the immutable delivery
 * snapshot fields). Nothing is simulated: when data is missing the UI
 * shows an empty state instead.
 *
 * Date boundaries use the store's operating timezone (Africa/Algiers,
 * a fixed UTC+1 with no DST), so "Today"/"Last 7 days" match the
 * merchant's calendar rather than UTC.
 */

export const ANALYTICS_RANGES = ["today", "7d", "30d", "90d", "all"] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export function isAnalyticsRange(value: unknown): value is AnalyticsRange {
  return ANALYTICS_RANGES.includes(value as AnalyticsRange);
}

/** Store operating timezone — Algeria has no DST (fixed UTC+1). */
export const STORE_TIMEZONE = "Africa/Algiers";
const STORE_UTC_OFFSET_MINUTES = 60;

export const ORDER_STATUSES = [
  "جديد",
  "تم التأكيد",
  "قيد التحضير",
  "تم الشحن",
  "تم التسليم",
  "ملغى",
  "مرجع",
] as const;

export const STATUS_DELIVERED = "تم التسليم";
export const STATUS_CANCELLED = "ملغى";
export const STATUS_RETURNED = "مرجع";

/** Revenue convention (same as the admin dashboard): not cancelled, not returned. */
export function countsAsRevenue(status: string): boolean {
  return status !== STATUS_CANCELLED && status !== STATUS_RETURNED;
}

export type AnalyticsOrderRow = {
  createdAt: Date;
  status: string;
  total: number;
  wilaya: string;
  deliveryMethod: string;
  deliveryStatus: string;
  items: OrderItem[];
};

export type SeriesPoint = { key: string; label: string; orders: number; revenue: number };
export type StatusSlice = { status: string; count: number; revenue: number };
export type ProductSlice = {
  name: string;
  slug: string;
  image: string;
  units: number;
  revenue: number;
};
export type VariantSlice = {
  name: string;
  sku: string;
  size: string;
  color: string;
  units: number;
  revenue: number;
};
export type OptionSlice = { option: string; units: number; revenue: number };
export type WilayaSlice = {
  wilaya: string;
  orders: number;
  revenue: number;
  completed: number;
  cancelled: number;
  returned: number;
};

export type AdvancedAnalytics = {
  range: AnalyticsRange;
  /** Range start (null = all time). */
  from: Date | null;
  kpis: {
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
    productsSold: number;
    completed: number;
    cancelled: number;
    returned: number;
  };
  series: SeriesPoint[];
  byStatus: StatusSlice[];
  topProducts: ProductSlice[];
  topVariants: VariantSlice[];
  bySize: OptionSlice[];
  byColor: OptionSlice[];
  byWilaya: WilayaSlice[];
  delivery: {
    byMethod: Array<{ method: string; count: number; revenue: number }>;
    byParcelStatus: Array<{ status: string; count: number }>;
  };
  funnel: {
    purchases: number;
    purchaseRevenue: number;
    /**
     * Honest limitation flag: PageView / ViewContent / InitiateCheckout are
     * sent to Meta by the browser and are NOT stored in this database, so
     * historical funnel stages above Purchase cannot be computed here.
     */
    upstreamStoredServerSide: false;
  };
};

/** Calendar day key (YYYY-MM-DD) of a UTC instant in the store timezone. */
export function tzDayKey(date: Date, tz: string = STORE_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Month key (YYYY-MM) of a UTC instant in the store timezone. */
export function tzMonthKey(date: Date, tz: string = STORE_TIMEZONE): string {
  return tzDayKey(date, tz).slice(0, 7);
}

/**
 * Start of the analytics range as a UTC instant, using store-timezone day
 * boundaries. "today" starts at local midnight; "7d"/"30d"/"90d" include
 * today plus the previous 6/29/89 days; "all" has no boundary.
 */
export function resolveRangeStart(
  range: AnalyticsRange,
  now: Date,
  tz: string = STORE_TIMEZONE,
): Date | null {
  if (range === "all") return null;
  const localMidnight = new Date(`${tzDayKey(now, tz)}T00:00:00Z`);
  const midnightUtc = new Date(
    localMidnight.getTime() - STORE_UTC_OFFSET_MINUTES * 60_000,
  );
  const backDays =
    range === "today" ? 0 : range === "7d" ? 6 : range === "30d" ? 29 : 89;
  return new Date(midnightUtc.getTime() - backDays * 86_400_000);
}

function dayLabel(key: string): string {
  const [, m, d] = key.split("-");
  return `${d}/${m}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${m}/${y}`;
}

/** Enumerate day keys (oldest → newest) between two store-timezone days. */
function enumerateDayKeys(fromKey: string, toKey: string): string[] {
  const keys: string[] = [];
  let cursor = new Date(`${fromKey}T00:00:00Z`);
  const end = new Date(`${toKey}T00:00:00Z`).getTime();
  let guard = 0;
  while (cursor.getTime() <= end && guard < 400) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor.getTime() + 86_400_000);
    guard += 1;
  }
  return keys;
}

/**
 * Pure aggregation over order rows — unit-testable without a database and
 * the exact code path the admin page uses with real rows.
 */
export function aggregateAnalytics(
  rows: AnalyticsOrderRow[],
  range: AnalyticsRange,
  now: Date,
): AdvancedAnalytics {
  const from = resolveRangeStart(range, now);
  const selected = rows.filter((o) => !from || o.createdAt.getTime() >= from.getTime());

  // ---- KPIs ---------------------------------------------------------------
  let totalRevenue = 0;
  let revenueOrders = 0;
  let productsSold = 0;
  let completed = 0;
  let cancelled = 0;
  let returned = 0;

  for (const o of selected) {
    if (o.status === STATUS_DELIVERED) completed += 1;
    if (o.status === STATUS_CANCELLED) cancelled += 1;
    if (o.status === STATUS_RETURNED) returned += 1;
    if (countsAsRevenue(o.status)) {
      totalRevenue += o.total;
      revenueOrders += 1;
      for (const item of o.items) productsSold += item.quantity;
    }
  }

  // ---- Series (daily, or monthly for all-time) -----------------------------
  const seriesMap = new Map<string, SeriesPoint>();
  if (range !== "all" && from) {
    const fromKey = tzDayKey(from);
    const toKey = tzDayKey(now);
    for (const key of enumerateDayKeys(fromKey, toKey)) {
      seriesMap.set(key, { key, label: dayLabel(key), orders: 0, revenue: 0 });
    }
    for (const o of selected) {
      const bucket = seriesMap.get(tzDayKey(o.createdAt));
      if (!bucket) continue;
      bucket.orders += 1;
      if (countsAsRevenue(o.status)) bucket.revenue += o.total;
    }
  } else {
    for (const o of selected) {
      const key = tzMonthKey(o.createdAt);
      const bucket =
        seriesMap.get(key) ??
        ({ key, label: monthLabel(key), orders: 0, revenue: 0 } as SeriesPoint);
      bucket.orders += 1;
      if (countsAsRevenue(o.status)) bucket.revenue += o.total;
      seriesMap.set(key, bucket);
    }
  }
  const series = [...seriesMap.values()].sort((a, b) => a.key.localeCompare(b.key));

  // ---- Status breakdown -----------------------------------------------------
  const statusMap = new Map<string, StatusSlice>();
  for (const status of ORDER_STATUSES) {
    statusMap.set(status, { status, count: 0, revenue: 0 });
  }
  for (const o of selected) {
    const slice =
      statusMap.get(o.status) ??
      ({ status: o.status, count: 0, revenue: 0 } as StatusSlice);
    slice.count += 1;
    if (countsAsRevenue(o.status)) slice.revenue += o.total;
    statusMap.set(o.status, slice);
  }
  const byStatus = [...statusMap.values()].filter((s) => s.count > 0);

  // ---- Product / variant / option performance (real sales only) ------------
  const productMap = new Map<string, ProductSlice>();
  const variantMap = new Map<string, VariantSlice>();
  const sizeMap = new Map<string, OptionSlice>();
  const colorMap = new Map<string, OptionSlice>();

  for (const o of selected) {
    if (!countsAsRevenue(o.status)) continue;
    for (const item of o.items) {
      const lineRevenue = item.price * item.quantity;

      const p =
        productMap.get(item.slug) ??
        ({
          name: item.name,
          slug: item.slug,
          image: item.image,
          units: 0,
          revenue: 0,
        } as ProductSlice);
      p.units += item.quantity;
      p.revenue += lineRevenue;
      productMap.set(item.slug, p);

      const vKey = item.sku || `${item.slug}|${item.size}|${item.color}`;
      const v =
        variantMap.get(vKey) ??
        ({
          name: item.name,
          sku: item.sku || "—",
          size: item.size || "—",
          color: item.color || "—",
          units: 0,
          revenue: 0,
        } as VariantSlice);
      v.units += item.quantity;
      v.revenue += lineRevenue;
      variantMap.set(vKey, v);

      if (item.size) {
        const s = sizeMap.get(item.size) ?? { option: item.size, units: 0, revenue: 0 };
        s.units += item.quantity;
        s.revenue += lineRevenue;
        sizeMap.set(item.size, s);
      }
      if (item.color) {
        const c =
          colorMap.get(item.color) ?? { option: item.color, units: 0, revenue: 0 };
        c.units += item.quantity;
        c.revenue += lineRevenue;
        colorMap.set(item.color, c);
      }
    }
  }

  // ---- Wilaya (immutable order snapshot — never the live zone config) ------
  const wilayaMap = new Map<string, WilayaSlice>();
  for (const o of selected) {
    const name = o.wilaya.trim();
    if (!name) continue;
    const w =
      wilayaMap.get(name) ??
      ({
        wilaya: name,
        orders: 0,
        revenue: 0,
        completed: 0,
        cancelled: 0,
        returned: 0,
      } as WilayaSlice);
    w.orders += 1;
    if (countsAsRevenue(o.status)) w.revenue += o.total;
    if (o.status === STATUS_DELIVERED) w.completed += 1;
    if (o.status === STATUS_CANCELLED) w.cancelled += 1;
    if (o.status === STATUS_RETURNED) w.returned += 1;
    wilayaMap.set(name, w);
  }

  // ---- Delivery (method split + parcel lifecycle) --------------------------
  const methodMap = new Map<string, { method: string; count: number; revenue: number }>();
  const parcelMap = new Map<string, number>();
  for (const o of selected) {
    const m =
      methodMap.get(o.deliveryMethod) ??
      { method: o.deliveryMethod || "home", count: 0, revenue: 0 };
    m.count += 1;
    if (countsAsRevenue(o.status)) m.revenue += o.total;
    methodMap.set(o.deliveryMethod || "home", m);

    const ds = o.deliveryStatus || "not_ready";
    parcelMap.set(ds, (parcelMap.get(ds) ?? 0) + 1);
  }

  return {
    range,
    from,
    kpis: {
      totalRevenue,
      totalOrders: selected.length,
      averageOrderValue: revenueOrders ? Math.round(totalRevenue / revenueOrders) : 0,
      productsSold,
      completed,
      cancelled,
      returned,
    },
    series,
    byStatus: byStatus.sort((a, b) => b.count - a.count),
    topProducts: [...productMap.values()]
      .sort((a, b) => b.units - a.units || b.revenue - a.revenue)
      .slice(0, 10),
    topVariants: [...variantMap.values()]
      .sort((a, b) => b.units - a.units || b.revenue - a.revenue)
      .slice(0, 10),
    bySize: [...sizeMap.values()].sort((a, b) => b.units - a.units),
    byColor: [...colorMap.values()].sort((a, b) => b.units - a.units),
    byWilaya: [...wilayaMap.values()]
      .sort((a, b) => b.orders - a.orders || b.revenue - a.revenue)
      .slice(0, 12),
    delivery: {
      byMethod: [...methodMap.values()].sort((a, b) => b.count - a.count),
      byParcelStatus: [...parcelMap.entries()]
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count),
    },
    funnel: {
      purchases: selected.length,
      purchaseRevenue: totalRevenue,
      upstreamStoredServerSide: false,
    },
  };
}

/** Load real orders (snapshot fields only) and aggregate for the admin UI. */
export async function getAdvancedAnalytics(
  range: AnalyticsRange,
  now: Date = new Date(),
): Promise<AdvancedAnalytics> {
  const rows = await db
    .select({
      createdAt: orders.createdAt,
      status: orders.status,
      total: orders.total,
      wilaya: orders.wilaya,
      deliveryMethod: orders.deliveryMethod,
      deliveryStatus: orders.deliveryStatus,
      items: orders.items,
    })
    .from(orders);
  return aggregateAnalytics(rows, range, now);
}
