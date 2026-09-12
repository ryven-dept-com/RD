import { db } from "@/db";
import { orderNotes, orders } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { verifyRequest } from "@/lib/admin-auth";
import { addOrderNote } from "@/lib/order-admin";

export const dynamic = "force-dynamic";

function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

/** Internal admin notes — never exposed on any public endpoint. */
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
  const notes = await db
    .select()
    .from(orderNotes)
    .where(eq(orderNotes.orderId, orderId))
    .orderBy(desc(orderNotes.createdAt), desc(orderNotes.id));
  return Response.json({
    ok: true,
    notes: notes.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
  });
}

/** Add an internal admin note (auth + CSRF + server validation). */
export async function POST(
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
    const text = String(body.body ?? "").trim();
    if (!text) {
      return Response.json({ ok: false, error: "Note is required" }, { status: 400 });
    }
    if (text.length > 2000) {
      return Response.json({ ok: false, error: "Note is too long" }, { status: 400 });
    }

    const [exists] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    if (!exists) {
      return Response.json({ ok: false, error: "Order not found" }, { status: 404 });
    }

    const author = admin.displayName || admin.username || "admin";
    const note = await addOrderNote(orderId, author, text);
    return Response.json({ ok: true, note }, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/orders/[id]/notes failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
