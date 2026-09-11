import { db } from "@/db";
import { orders, products, type OrderItem } from "@/db/schema";
import { inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

const SHIPPING_FLAT = 995; // $9.95
const FREE_SHIP_THRESHOLD = 15000; // $150

type IncomingItem = {
  slug: string;
  size: string;
  color: string;
  quantity: number;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const items: IncomingItem[] = Array.isArray(body.items) ? body.items : [];

    if (!items.length) {
      return Response.json(
        { ok: false, error: "Your cart is empty" },
        { status: 400 },
      );
    }

    const required = ["email", "fullName", "address", "city", "postalCode", "country"];
    for (const key of required) {
      if (!String(body[key] ?? "").trim()) {
        return Response.json(
          { ok: false, error: `Missing ${key}` },
          { status: 400 },
        );
      }
    }

    const slugs = [...new Set(items.map((i) => i.slug))];
    const rows = await db
      .select()
      .from(products)
      .where(inArray(products.slug, slugs));
    const bySlug = new Map(rows.map((r) => [r.slug, r]));

    const orderItems: OrderItem[] = [];
    let subtotal = 0;
    for (const item of items) {
      const p = bySlug.get(item.slug);
      if (!p) continue;
      const qty = Math.max(1, Math.min(Number(item.quantity) || 1, 20));
      subtotal += p.price * qty;
      orderItems.push({
        productId: p.id,
        slug: p.slug,
        name: p.name,
        price: p.price,
        quantity: qty,
        size: String(item.size ?? ""),
        color: String(item.color ?? ""),
        image: p.images[0] ?? "",
      });
    }

    if (!orderItems.length) {
      return Response.json(
        { ok: false, error: "No valid items in cart" },
        { status: 400 },
      );
    }

    const shipping = subtotal >= FREE_SHIP_THRESHOLD ? 0 : SHIPPING_FLAT;
    const total = subtotal + shipping;
    const orderNumber = `RVN-${Date.now().toString(36).toUpperCase()}${Math.floor(
      Math.random() * 900 + 100,
    )}`;

    const [order] = await db
      .insert(orders)
      .values({
        orderNumber,
        email: String(body.email).trim(),
        fullName: String(body.fullName).trim(),
        address: String(body.address).trim(),
        city: String(body.city).trim(),
        postalCode: String(body.postalCode).trim(),
        country: String(body.country).trim(),
        subtotal,
        shipping,
        deliveryPrice: shipping,
        total,
        items: orderItems,
        status: "جديد",
      })
      .returning();

    return Response.json(
      {
        ok: true,
        orderNumber: order.orderNumber,
        subtotal,
        shipping,
        total,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST /api/checkout failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
