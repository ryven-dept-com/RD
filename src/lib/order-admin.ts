import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  orderEvents,
  orderNotes,
  orders,
  productVariants,
  products,
  PAYMENT_STATUSES,
  type OrderItem,
  type PaymentStatus,
} from "@/db/schema";

// ---------------------------------------------------------------------------
// Phase 7 — professional order management.
//
// The store's original Arabic fulfillment lifecycle is preserved (existing
// orders and dashboards use it); Phase 7 adds transition validation, payment
// state, notes, an audit trail and idempotent inventory restoration.
// ---------------------------------------------------------------------------

/** Fulfillment statuses (original Arabic lifecycle + refunded). */
export const STATUS_PENDING = "جديد";
export const STATUS_CONFIRMED = "تم التأكيد";
export const STATUS_PROCESSING = "قيد التحضير";
export const STATUS_SHIPPED = "تم الشحن";
export const STATUS_DELIVERED = "تم التسليم";
export const STATUS_CANCELLED = "ملغى";
export const STATUS_REFUNDED = "مرجع";

/**
 * Allowed forward transitions. Cancellation is allowed until the order
 * ships; refunds only after delivery. Anything else requires the explicit
 * `force` override from an authenticated admin.
 */
export const ORDER_TRANSITIONS: Record<string, readonly string[]> = {
  [STATUS_PENDING]: [STATUS_CONFIRMED, STATUS_CANCELLED],
  [STATUS_CONFIRMED]: [STATUS_PROCESSING, STATUS_CANCELLED],
  [STATUS_PROCESSING]: [STATUS_SHIPPED, STATUS_CANCELLED],
  [STATUS_SHIPPED]: [STATUS_DELIVERED],
  [STATUS_DELIVERED]: [STATUS_REFUNDED],
  [STATUS_CANCELLED]: [],
  [STATUS_REFUNDED]: [],
};

export function isKnownStatus(status: string): boolean {
  return status in ORDER_TRANSITIONS;
}

export function isTerminalStatus(status: string): boolean {
  return status === STATUS_CANCELLED || status === STATUS_REFUNDED;
}

/** Same-status "changes" are idempotent no-ops, everything else must be allowed. */
export function isValidTransition(from: string, to: string): boolean {
  if (from === to) return true;
  const allowed = ORDER_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

/**
 * Stock is consumed at order creation (Phase 5 checkout). Restoration is
 * appropriate exactly once, when an order moves into cancelled or refunded
 * from a state that had not already been cancelled.
 */
export function shouldRestoreStock(from: string, to: string): boolean {
  if (from === STATUS_CANCELLED) return false;
  return to === STATUS_CANCELLED || to === STATUS_REFUNDED;
}

export function isValidPaymentStatus(value: string): value is PaymentStatus {
  return (PAYMENT_STATUSES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Append an audit-trail entry (lightweight, production-safe). */
export async function recordOrderEvent(params: {
  orderId: number;
  kind: "status" | "payment" | "stock" | "note" | "delivery";
  fromValue?: string;
  toValue?: string;
  actor?: string;
  note?: string;
  tx?: Tx;
}): Promise<void> {
  const target = params.tx ?? db;
  await target.insert(orderEvents).values({
    orderId: params.orderId,
    kind: params.kind,
    fromValue: params.fromValue ?? "",
    toValue: params.toValue ?? "",
    actor: params.actor ?? "",
    note: (params.note ?? "").slice(0, 1000),
  });
}

/**
 * Restore the purchased stock for an order EXACTLY ONCE.
 *
 * The claim and the restoration happen in ONE transaction: `stock_restored`
 * flips false→true via a guarded UPDATE, so concurrent or repeated
 * cancel/refund requests can never double-restock. Returns true when this
 * call performed the restoration.
 */
export async function restoreOrderStockOnce(
  orderId: number,
  items: OrderItem[],
  actor: string,
): Promise<boolean> {
  let restored = false;
  await db.transaction(async (tx) => {
    const claimed = await tx
      .update(orders)
      .set({ stockRestored: true })
      .where(and(eq(orders.id, orderId), eq(orders.stockRestored, false)))
      .returning({ id: orders.id });
    if (!claimed.length) return; // already restored (or unknown order)
    restored = true;

    for (const item of items) {
      const qty = Math.max(0, Math.floor(Number(item.quantity) || 0));
      if (!qty) continue;
      if (item.variantId != null) {
        await tx
          .update(productVariants)
          .set({ stock: sql`${productVariants.stock} + ${qty}` })
          .where(eq(productVariants.id, item.variantId));
      } else {
        await tx
          .update(products)
          .set({ stock: sql`${products.stock} + ${qty}` })
          .where(eq(products.id, item.productId));
      }
    }
    // Re-sync product-level totals/sold-out flags for touched products.
    const productIds = [...new Set(items.map((i) => i.productId))];
    for (const productId of productIds) {
      const hasVariants = await tx
        .select({ id: productVariants.id })
        .from(productVariants)
        .where(eq(productVariants.productId, productId))
        .limit(1);
      if (hasVariants.length) {
        const [agg] = await tx
          .select({ total: sql<number>`coalesce(sum(${productVariants.stock}), 0)::int` })
          .from(productVariants)
          .where(eq(productVariants.productId, productId));
        const total = Number(agg?.total ?? 0);
        await tx
          .update(products)
          .set({ stock: sql`GREATEST(${products.stock}, ${total})`, soldOut: total <= 0 })
          .where(eq(products.id, productId));
      } else {
        await tx
          .update(products)
          .set({ soldOut: sql`${products.stock} <= 0` })
          .where(eq(products.id, productId));
      }
    }
    await recordOrderEvent({
      orderId,
      kind: "stock",
      fromValue: "",
      toValue: "restored",
      actor,
      tx,
    });
  });
  return restored;
}

// ---------------------------------------------------------------------------
// Server-side order search (list page + API)
// ---------------------------------------------------------------------------

export type OrderSearchParams = {
  q?: string;
  status?: string;
  payment?: string;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
  sort?: "newest" | "oldest" | "total-desc" | "total-asc";
  page?: number;
  pageSize?: number;
};

export type AdminOrderRow = {
  id: number;
  orderNumber: string;
  fullName: string;
  email: string;
  phone: string;
  total: number;
  currency: string;
  status: string;
  paymentStatus: string;
  /** Phase 8: shipping snapshot + parcel lifecycle. */
  deliveryMethod: string;
  deliveryStatus: string;
  deliveryZoneCode: number;
  itemCount: number;
  stockRestored: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OrderSearchResult = {
  orders: AdminOrderRow[];
  total: number;
  page: number;
  pageSize: number;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Server-side search/filter/sort/pagination — one query + one count query. */
export async function searchOrdersAdmin(
  params: OrderSearchParams = {},
): Promise<OrderSearchResult> {
  const conditions = [];

  if (params.q) {
    const needle = params.q.trim();
    if (needle) {
      conditions.push(
        sql`(${orders.orderNumber} ILIKE ${`%${needle}%`}
          OR ${orders.fullName} ILIKE ${`%${needle}%`}
          OR ${orders.phone} ILIKE ${`%${needle}%`}
          OR ${orders.email} ILIKE ${`%${needle}%`})`,
      );
    }
  }
  if (params.status && isKnownStatus(params.status)) {
    conditions.push(eq(orders.status, params.status));
  }
  if (params.payment && isValidPaymentStatus(params.payment)) {
    conditions.push(eq(orders.paymentStatus, params.payment));
  }
  if (params.dateFrom && DATE_PATTERN.test(params.dateFrom)) {
    conditions.push(sql`${orders.createdAt} >= ${params.dateFrom}::timestamp`);
  }
  if (params.dateTo && DATE_PATTERN.test(params.dateTo)) {
    conditions.push(
      sql`${orders.createdAt} < (${params.dateTo}::date + interval '1 day')`,
    );
  }

  const where = conditions.length ? and(...conditions) : undefined;

  let orderClause;
  switch (params.sort) {
    case "oldest":
      orderClause = sql`${orders.createdAt} ASC, ${orders.id} ASC`;
      break;
    case "total-desc":
      orderClause = sql`${orders.total} DESC, ${orders.id} DESC`;
      break;
    case "total-asc":
      orderClause = sql`${orders.total} ASC, ${orders.id} ASC`;
      break;
    default:
      orderClause = sql`${orders.createdAt} DESC, ${orders.id} DESC`;
  }

  const pageSize = Math.min(
    50,
    Math.max(1, Math.floor(Number(params.pageSize) || 20)),
  );
  const totalRows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(orders)
    .where(where);
  const total = Number(totalRows[0]?.c ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Math.floor(Number(params.page) || 1)), totalPages);

  const rows = await db
    .select()
    .from(orders)
    .where(where)
    .orderBy(orderClause)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    orders: rows.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      fullName: o.fullName,
      email: o.email,
      phone: o.phone,
      total: o.total,
      currency: o.currency,
      status: o.status,
      paymentStatus: o.paymentStatus,
      deliveryMethod: o.deliveryMethod,
      deliveryStatus: o.deliveryStatus,
      deliveryZoneCode: o.deliveryZoneCode,
      itemCount: o.items.reduce((sum, i) => sum + i.quantity, 0),
      stockRestored: o.stockRestored,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  };
}

/** Order detail + notes + audit trail for the admin (one query each). */
export async function getOrderDetailAdmin(orderId: number) {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order) return null;

  const [notes, events] = await Promise.all([
    db
      .select()
      .from(orderNotes)
      .where(eq(orderNotes.orderId, orderId))
      .orderBy(desc(orderNotes.createdAt), desc(orderNotes.id)),
    db
      .select()
      .from(orderEvents)
      .where(eq(orderEvents.orderId, orderId))
      .orderBy(desc(orderEvents.createdAt), desc(orderEvents.id)),
  ]);

  return { order, notes, events };
}

/** Add an internal admin note (never exposed to customers). */
export async function addOrderNote(
  orderId: number,
  author: string,
  body: string,
) {
  const clean = body.trim().slice(0, 2000);
  if (!clean) return null;
  const [note] = await db
    .insert(orderNotes)
    .values({ orderId, author: author.slice(0, 80), body: clean })
    .returning();
  await recordOrderEvent({
    orderId,
    kind: "note",
    fromValue: "",
    toValue: "note",
    actor: author.slice(0, 80),
    note: clean.slice(0, 140),
  });
  return note;
}
