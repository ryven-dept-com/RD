import { db } from "@/db";
import { orders, products, type OrderItem } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { getStoreSettings } from "@/lib/settings";
import { makeEventId } from "@/lib/pixel-events";
import { sendMetaPurchaseServerEvent } from "@/lib/meta-capi";

export const dynamic = "force-dynamic";

const SHIPPING_FLAT = 995; // flat rate used below the free-shipping threshold
const FALLBACK_FREE_SHIP_THRESHOLD = 15000;

type IncomingItem = {
  slug: string;
  size: string;
  color: string;
  quantity: number;
};

/**
 * Checkout honours Admin → Settings → Checkout:
 * - checkout disabled → 403
 * - minimum order amount enforced server-side
 * - phone / address required-ness driven by settings
 * - free-shipping threshold read from the database
 * The free-shipping threshold and rules are NEVER trusted from the client.
 */
export async function POST(request: Request) {
  let store;
  try {
    store = await getStoreSettings();
  } catch {
    store = null;
  }

  const checkoutEnabled = store ? store.checkoutEnabled : true;
  if (!checkoutEnabled) {
    return Response.json(
      { ok: false, error: "Checkout is currently disabled" },
      { status: 403 },
    );
  }

  const requireAddress = store ? store.requireAddress : true;
  const requirePhone = store ? store.requirePhone : false;
  const freeShipThreshold = store
    ? store.freeShippingThreshold
    : FALLBACK_FREE_SHIP_THRESHOLD;
  const minOrderAmount = store ? store.minOrderAmount : 0;

  try {
    const body = await request.json();
    const items: IncomingItem[] = Array.isArray(body.items) ? body.items : [];

    if (!items.length) {
      return Response.json(
        { ok: false, error: "Your cart is empty" },
        { status: 400 },
      );
    }

    const required: Array<[string, string]> = [
      ["email", "Missing email"],
      ["fullName", "Missing fullName"],
    ];
    if (requireAddress) {
      required.push(
        ["address", "Missing address"],
        ["city", "Missing city"],
        ["postalCode", "Missing postalCode"],
        ["country", "Missing country"],
      );
    }
    if (requirePhone) {
      required.push(["phone", "Missing phone"]);
    }
    for (const [key, message] of required) {
      if (!String(body[key] ?? "").trim()) {
        return Response.json({ ok: false, error: message }, { status: 400 });
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

    if (minOrderAmount > 0 && subtotal < minOrderAmount) {
      return Response.json(
        { ok: false, error: "ORDER_BELOW_MINIMUM" },
        { status: 400 },
      );
    }

    const shipping = subtotal >= freeShipThreshold ? 0 : SHIPPING_FLAT;
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
        phone: String(body.phone ?? "").trim(),
        address: String(body.address ?? "").trim(),
        city: String(body.city ?? "").trim(),
        postalCode: String(body.postalCode ?? "").trim(),
        country: String(body.country ?? "").trim(),
        subtotal,
        shipping,
        deliveryPrice: shipping,
        total,
        items: orderItems,
        status: "جديد",
      })
      .returning();

    // Meta Ads tracking: one event ID shared by the browser Pixel Purchase
    // event and the server-side Conversions API event so Meta deduplicates
    // them instead of double-counting revenue.
    const purchaseEventId = makeEventId();
    void sendMetaPurchaseServerEvent({
      request,
      orderNumber: order.orderNumber,
      email: String(body.email ?? "").trim(),
      phone: String(body.phone ?? "").trim(),
      city: String(body.city ?? "").trim(),
      country: String(body.country ?? "").trim(),
      postalCode: String(body.postalCode ?? "").trim(),
      items: orderItems.map((i) => ({
        slug: i.slug,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
      })),
      total,
      eventId: purchaseEventId,
    }).catch((err) => {
      console.error("[meta-capi] purchase event failed:", err);
    });

    return Response.json(
      {
        ok: true,
        orderNumber: order.orderNumber,
        subtotal,
        shipping,
        total,
        currency: store ? store.currency : "",
        purchaseEventId,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST /api/checkout failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
