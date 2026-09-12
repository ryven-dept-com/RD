import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyRequest } from "@/lib/admin-auth";
import { ORDER_STATUSES, type OrderStatus } from "@/db/schema";
import {
  getOrderDetailAdmin,
  isKnownStatus,
  isValidPaymentStatus,
  isValidTransition,
  recordOrderEvent,
  restoreOrderStockOnce,
  shouldRestoreStock,
} from "@/lib/order-admin";

export const dynamic = "force-dynamic";

function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

/** Order detail + notes + audit trail (admin-only, CSRF-checked). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const orderId = parseId(id);
  if (!orderId) {
    return Response.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  const detail = await getOrderDetailAdmin(orderId);
  if (!detail) {
    return Response.json({ ok: false, error: "Order not found" }, { status: 404 });
  }
  return Response.json({
    ok: true,
    order: {
      ...detail.order,
      createdAt: detail.order.createdAt.toISOString(),
      updatedAt: detail.order.updatedAt.toISOString(),
    },
    notes: detail.notes.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
    })),
    events: detail.events.map((e) => ({
      ...e,
      createdAt: e.createdAt.toISOString(),
    })),
  });
}

/**
 * Update order status and/or payment status (Phase 7).
 *
 * - Status changes are validated against the lifecycle; illegal moves are
 *   rejected with 409 unless the explicit `force` override is sent.
 * - Moving into cancelled/refunded restores the purchased stock exactly
 *   once (guarded by the order's stock_restored flag).
 * - Client-provided totals, prices or quantities are never accepted.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const orderId = parseId(id);
  if (!orderId) {
    return Response.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const actor = admin.displayName || admin.username || "admin";

    const [existing] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    if (!existing) {
      return Response.json({ ok: false, error: "Order not found" }, { status: 404 });
    }

    const updates: Partial<typeof orders.$inferInsert> = { updatedAt: new Date() };
    const events: Array<{
      kind: "status" | "payment";
      fromValue: string;
      toValue: string;
    }> = [];

    // ---- fulfillment status ----
    if (body.status !== undefined) {
      const status = String(body.status ?? "");
      if (!ORDER_STATUSES.includes(status as OrderStatus) || !isKnownStatus(status)) {
        return Response.json({ ok: false, error: "Invalid status" }, { status: 400 });
      }
      if (status !== existing.status) {
        const force = body.force === true;
        if (!force && !isValidTransition(existing.status, status)) {
          return Response.json(
            {
              ok: false,
              error: `Cannot move an order from "${existing.status}" to "${status}"`,
              code: "INVALID_TRANSITION",
            },
            { status: 409 },
          );
        }
        updates.status = status;
        events.push({ kind: "status", fromValue: existing.status, toValue: status });
      }
    }

    // ---- payment status ----
    if (body.paymentStatus !== undefined) {
      const payment = String(body.paymentStatus ?? "");
      if (!isValidPaymentStatus(payment)) {
        return Response.json(
          { ok: false, error: "Invalid payment status" },
          { status: 400 },
        );
      }
      if (payment !== existing.paymentStatus) {
        updates.paymentStatus = payment;
        events.push({
          kind: "payment",
          fromValue: existing.paymentStatus,
          toValue: payment,
        });
      }
    }

    if (!events.length) {
      // Nothing actually changed — idempotent no-op.
      return Response.json({ ok: true, unchanged: true });
    }

    await db.update(orders).set(updates).where(eq(orders.id, orderId));
    for (const e of events) {
      await recordOrderEvent({
        orderId,
        kind: e.kind,
        fromValue: e.fromValue,
        toValue: e.toValue,
        actor,
        note: typeof body.note === "string" ? body.note.slice(0, 500) : "",
      });
    }

    // ---- inventory restoration (exactly once per order) ----
    let stockRestored = existing.stockRestored;
    const statusEvent = events.find((e) => e.kind === "status");
    if (
      statusEvent &&
      shouldRestoreStock(statusEvent.fromValue, statusEvent.toValue)
    ) {
      const didRestore = await restoreOrderStockOnce(
        orderId,
        existing.items,
        actor,
      );
      stockRestored = stockRestored || didRestore;
    }

    return Response.json({ ok: true, stockRestored });
  } catch (err) {
    console.error("PATCH /api/admin/orders/[id] failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
