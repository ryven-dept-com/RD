import { db } from "@/db";
import { orders, ORDER_STATUSES, type OrderStatus } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) {
    return Response.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const status = String(body.status ?? "");
    if (!ORDER_STATUSES.includes(status as OrderStatus)) {
      return Response.json({ ok: false, error: "Invalid status" }, { status: 400 });
    }

    const updated = await db
      .update(orders)
      .set({ status })
      .where(eq(orders.id, orderId))
      .returning({ id: orders.id });

    if (!updated.length) {
      return Response.json({ ok: false, error: "Order not found" }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/admin/orders/[id] failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
