import { describe, expect, it } from "vitest";
import {
  aggregateAnalytics,
  countsAsRevenue,
  isAnalyticsRange,
  resolveRangeStart,
  tzDayKey,
  tzMonthKey,
  type AnalyticsOrderRow,
} from "./analytics";

/** Fixed "now": 2026-09-12 14:30 UTC = 15:30 in Africa/Algiers (UTC+1). */
const NOW = new Date("2026-09-12T14:30:00Z");

function order(
  overrides: Partial<AnalyticsOrderRow> & { createdAt: Date },
): AnalyticsOrderRow {
  return {
    status: "جديد",
    total: 10_000,
    wilaya: "المسيلة",
    deliveryMethod: "home",
    deliveryStatus: "not_ready",
    items: [
      {
        productId: 1,
        slug: "hoodie-black",
        name: "Hoodie Black",
        price: 5_000,
        quantity: 2,
        size: "M",
        color: "Onyx",
        image: "/x.jpg",
        sku: "H-M-ONYX",
      },
    ],
    ...overrides,
  };
}

describe("range + timezone helpers", () => {
  it("accepts only the documented ranges", () => {
    for (const r of ["today", "7d", "30d", "90d", "all"]) {
      expect(isAnalyticsRange(r)).toBe(true);
    }
    expect(isAnalyticsRange("yesterday")).toBe(false);
    expect(isAnalyticsRange("")).toBe(false);
    expect(isAnalyticsRange(undefined)).toBe(false);
  });

  it("keys days by the store timezone (Algiers = UTC+1)", () => {
    // 23:30 UTC on Sep 11 is already Sep 12 in Algiers.
    expect(tzDayKey(new Date("2026-09-11T23:30:00Z"))).toBe("2026-09-12");
    // 22:30 UTC is still Sep 11 in Algiers.
    expect(tzDayKey(new Date("2026-09-11T22:30:00Z"))).toBe("2026-09-11");
    expect(tzMonthKey(new Date("2026-09-11T23:30:00Z"))).toBe("2026-09");
  });

  it("'today' starts at Algiers midnight (23:00 UTC the previous day)", () => {
    const start = resolveRangeStart("today", NOW);
    expect(start?.toISOString()).toBe("2026-09-11T23:00:00.000Z");
  });

  it("7d covers today + the previous six days", () => {
    const start = resolveRangeStart("7d", NOW);
    // Sep 12 - 6 days = Sep 6 at Algiers midnight = Sep 5 23:00 UTC.
    expect(start?.toISOString()).toBe("2026-09-05T23:00:00.000Z");
  });

  it("'all' has no boundary", () => {
    expect(resolveRangeStart("all", NOW)).toBeNull();
  });
});

describe("aggregateAnalytics", () => {
  const inRange = order({ createdAt: new Date("2026-09-10T10:00:00Z") });
  const old = order({
    createdAt: new Date("2026-01-01T10:00:00Z"),
    total: 99_999,
  });
  const cancelled = order({
    createdAt: new Date("2026-09-11T10:00:00Z"),
    status: "ملغى",
    total: 7_000,
  });
  const returned = order({
    createdAt: new Date("2026-09-11T12:00:00Z"),
    status: "مرجع",
    total: 8_000,
    wilaya: "الجزائر",
    deliveryMethod: "office",
  });
  const delivered = order({
    createdAt: new Date("2026-09-12T08:00:00Z"),
    status: "تم التسليم",
    total: 20_000,
    deliveryStatus: "delivered",
  });

  it("computes KPIs from real orders only (no cancelled/returned revenue)", () => {
    const a = aggregateAnalytics([inRange, old, cancelled, returned, delivered], "30d", NOW);
    expect(a.kpis.totalOrders).toBe(4); // old order outside 30d window
    expect(a.kpis.totalRevenue).toBe(10_000 + 20_000);
    expect(a.kpis.averageOrderValue).toBe(15_000);
    expect(a.kpis.productsSold).toBe(4); // 2 units x 2 revenue orders
    expect(a.kpis.completed).toBe(1);
    expect(a.kpis.cancelled).toBe(1);
    expect(a.kpis.returned).toBe(1);
  });

  it("includes every order in all-time range", () => {
    const a = aggregateAnalytics([inRange, old, cancelled, returned, delivered], "all", NOW);
    expect(a.kpis.totalOrders).toBe(5);
    expect(a.kpis.totalRevenue).toBe(10_000 + 99_999 + 20_000);
  });

  it("series has one bucket per day with zero-fill", () => {
    const a = aggregateAnalytics([inRange], "7d", NOW);
    expect(a.series).toHaveLength(7);
    const day = a.series.find((s) => s.key === "2026-09-10");
    expect(day?.orders).toBe(1);
    expect(day?.revenue).toBe(10_000);
    expect(a.series.every((s) => s.orders >= 0)).toBe(true);
  });

  it("all-time series buckets by month", () => {
    const a = aggregateAnalytics([inRange, old], "all", NOW);
    expect(a.series.map((s) => s.key)).toEqual(["2026-01", "2026-09"]);
  });

  it("status breakdown keeps the Arabic lifecycle and real revenue", () => {
    const a = aggregateAnalytics([inRange, cancelled, returned, delivered], "all", NOW);
    const byName = Object.fromEntries(a.byStatus.map((s) => [s.status, s]));
    expect(byName["تم التسليم"].count).toBe(1);
    expect(byName["تم التسليم"].revenue).toBe(20_000);
    expect(byName["ملغى"].revenue).toBe(0);
    expect(byName["مرجع"].revenue).toBe(0);
  });

  it("product/variant/size/color performance comes from order item snapshots", () => {
    const a = aggregateAnalytics([inRange, cancelled, delivered], "all", NOW);
    expect(a.topProducts).toHaveLength(1);
    expect(a.topProducts[0].units).toBe(4); // cancelled order excluded
    expect(a.topProducts[0].revenue).toBe(20_000);
    expect(a.topVariants[0].sku).toBe("H-M-ONYX");
    expect(a.bySize[0]).toEqual({ option: "M", units: 4, revenue: 20_000 });
    expect(a.byColor[0]).toEqual({ option: "Onyx", units: 4, revenue: 20_000 });
  });

  it("wilaya analytics use the immutable order snapshot with lifecycle splits", () => {
    const a = aggregateAnalytics([inRange, returned, delivered, cancelled], "all", NOW);
    const msila = a.byWilaya.find((w) => w.wilaya === "المسيلة");
    expect(msila?.orders).toBe(3);
    expect(msila?.completed).toBe(1);
    expect(msila?.cancelled).toBe(1);
    const algiers = a.byWilaya.find((w) => w.wilaya === "الجزائر");
    expect(algiers?.returned).toBe(1);
  });

  it("delivery split uses the order's delivery method snapshot", () => {
    const a = aggregateAnalytics([inRange, returned], "all", NOW);
    const methods = Object.fromEntries(
      a.delivery.byMethod.map((m) => [m.method, m.count]),
    );
    expect(methods.home).toBe(1);
    expect(methods.office).toBe(1);
  });

  it("funnel reports only real purchases and flags the upstream limitation", () => {
    const a = aggregateAnalytics([inRange, cancelled], "all", NOW);
    expect(a.funnel.purchases).toBe(2);
    expect(a.funnel.upstreamStoredServerSide).toBe(false);
  });

  it("empty data yields safe zero states (no NaN)", () => {
    const a = aggregateAnalytics([], "30d", NOW);
    expect(a.kpis.totalOrders).toBe(0);
    expect(a.kpis.averageOrderValue).toBe(0);
    expect(a.series.every((s) => s.orders === 0 && s.revenue === 0)).toBe(true);
    expect(a.topProducts).toHaveLength(0);
    expect(Number.isFinite(a.kpis.totalRevenue)).toBe(true);
  });

  it("revenue convention matches the dashboard", () => {
    expect(countsAsRevenue("جديد")).toBe(true);
    expect(countsAsRevenue("تم التسليم")).toBe(true);
    expect(countsAsRevenue("ملغى")).toBe(false);
    expect(countsAsRevenue("مرجع")).toBe(false);
  });
});
