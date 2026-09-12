import { db } from "@/db";
import {
  orders,
  productVariants,
  products,
  type OrderItem,
} from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getStoreSettings } from "@/lib/settings";
import { makeEventId } from "@/lib/pixel-events";
import { sendMetaPurchaseServerEvent } from "@/lib/meta-capi";
import {
  resolveVariantForCheckout,
  syncProductStockFlags,
} from "@/lib/product-admin";
import {
  getZoneByCode,
  isShippingMethod,
  quoteShipping,
} from "@/lib/delivery-admin";

export const dynamic = "force-dynamic";

const SHIPPING_FLAT = 995; // flat rate used below the free-shipping threshold
const FALLBACK_FREE_SHIP_THRESHOLD = 15000;

type IncomingItem = {
  slug: string;
  size: string;
  color: string;
  quantity: number;
  variantId?: number | null;
};

/**
 * Checkout honours Admin → Settings → Checkout:
 * - checkout disabled → 403
 * - minimum order amount enforced server-side
 * - full name + phone required; wilaya/commune drive delivery
 * - free-shipping threshold read from the database
 * The free-shipping threshold and rules are NEVER trusted from the client.
 *
 * Phase 5: stock is enforced SERVER-side per variant. Each line is resolved
 * to a real variant row (size + color must match an active variant when the
 * product has variants); quantities are validated against live stock and
 * decremented atomically in the same transaction as the order insert, so an
 * unavailable variant can never be purchased.
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

    // Direct-purchase flow: the order is identified by full name + phone;
    // delivery goes through wilaya + commune (zone selector). Email, street
    // address, city, postal code and country are no longer collected — the
    // columns remain for historical orders and legacy API clients.
    const required: Array<[string, string]> = [
      ["fullName", "Missing fullName"],
      ["phone", "Missing phone"],
    ];
    for (const [key, message] of required) {
      if (!String(body[key] ?? "").trim()) {
        return Response.json({ ok: false, error: message }, { status: 400 });
      }
    }

    const slugs = [...new Set(items.map((i) => String(i.slug ?? "")))];
    const rows = await db
      .select()
      .from(products)
      .where(inArray(products.slug, slugs));
    const bySlug = new Map(rows.map((r) => [r.slug, r]));

    // ------------------------------------------------------------------
    // Validate every line against the live catalogue BEFORE writing.
    // ------------------------------------------------------------------
    type ValidatedLine = {
      product: (typeof rows)[number];
      size: string;
      color: string;
      quantity: number;
      variantId: number | null;
      sku: string;
    };
    const lines: ValidatedLine[] = [];

    for (const item of items) {
      const p = bySlug.get(String(item.slug ?? ""));
      if (!p || !p.active || p.status !== "active") {
        return Response.json(
          {
            ok: false,
            error: "Some items in your bag are no longer available",
            code: "PRODUCT_UNAVAILABLE",
          },
          { status: 409 },
        );
      }
      const qty = Math.max(1, Math.min(Number(item.quantity) || 1, 20));
      const size = String(item.size ?? "");
      const color = String(item.color ?? "");

      const resolution = await resolveVariantForCheckout(p.id, size, color);
      if (resolution.hasVariants) {
        const v = resolution.variant;
        // A requested variant id must agree with the size/color match.
        if (
          !v ||
          !v.active ||
          (item.variantId != null && Number(item.variantId) !== v.id)
        ) {
          return Response.json(
            {
              ok: false,
              error: `${p.name}: the selected size/color combination is unavailable`,
              code: "VARIANT_UNAVAILABLE",
            },
            { status: 409 },
          );
        }
        lines.push({
          product: p,
          size,
          color,
          quantity: qty,
          variantId: v.id,
          sku: v.sku,
        });
      } else {
        // Legacy product without variant rows — product-level stock applies.
        lines.push({
          product: p,
          size,
          color,
          quantity: qty,
          variantId: null,
          sku: p.sku,
        });
      }
    }

    if (!lines.length) {
      return Response.json(
        { ok: false, error: "No valid items in cart" },
        { status: 400 },
      );
    }

    // Merge duplicate lines (same variant or same legacy product).
    const merged: ValidatedLine[] = [];
    for (const line of lines) {
      const existing = merged.find(
        (m) =>
          m.product.id === line.product.id &&
          (line.variantId
            ? m.variantId === line.variantId
            : m.variantId === null &&
              m.size === line.size &&
              m.color === line.color),
      );
      if (existing) existing.quantity = Math.min(existing.quantity + line.quantity, 50);
      else merged.push({ ...line });
    }

    const subtotal = merged.reduce(
      (sum, l) => sum + l.product.price * l.quantity,
      0,
    );
    if (minOrderAmount > 0 && subtotal < minOrderAmount) {
      return Response.json(
        { ok: false, error: "ORDER_BELOW_MINIMUM" },
        { status: 400 },
      );
    }

    const orderItems: OrderItem[] = merged.map((l) => ({
      productId: l.product.id,
      slug: l.product.slug,
      name: l.product.name,
      price: l.product.price,
      quantity: l.quantity,
      size: l.size,
      color: l.color,
      image: l.product.images[0] ?? "",
      variantId: l.variantId ?? undefined,
      sku: l.sku || undefined,
    }));

    // ------------------------------------------------------------------
    // Phase 8: server-authoritative shipping. When the client picks a
    // delivery zone + method, the server re-resolves the zone, verifies it
    // is active and the method is enabled, and computes the fee from the
    // database (NEVER from client-provided prices). The Phase 3 free-
    // shipping threshold still applies on top. Clients that send no zone
    // keep the legacy flat rate so existing integrations stay compatible.
    // ------------------------------------------------------------------
    let shipping: number;
    let deliveryMethod: "home" | "office" = "home";
    let deliveryZoneCode = 0;
    let deliveryZoneName = "";
    let deliveryEstimate = "";

    const zoneCodeRaw = body.deliveryZone;
    if (zoneCodeRaw !== undefined && zoneCodeRaw !== null && zoneCodeRaw !== "") {
      const zoneCode = Number(zoneCodeRaw);
      if (!Number.isFinite(zoneCode) || zoneCode <= 0 || Math.floor(zoneCode) !== zoneCode) {
        return Response.json(
          { ok: false, error: "Invalid delivery zone" },
          { status: 400 },
        );
      }
      const methodRaw = String(body.deliveryMethod ?? "home");
      if (!isShippingMethod(methodRaw)) {
        return Response.json(
          { ok: false, error: "Invalid shipping method" },
          { status: 400 },
        );
      }
      const zone = await getZoneByCode(zoneCode);
      if (!zone || !zone.enabled) {
        return Response.json(
          { ok: false, error: "Delivery zone is not available", code: "ZONE_INACTIVE" },
          { status: 404 },
        );
      }
      const quote = quoteShipping(zone, methodRaw, subtotal, freeShipThreshold);
      if (!quote) {
        return Response.json(
          {
            ok: false,
            error: "Shipping method is not available for this zone",
            code: "METHOD_UNAVAILABLE",
          },
          { status: 409 },
        );
      }
      shipping = quote.shipping;
      deliveryMethod = methodRaw;
      deliveryZoneCode = zone.code;
      deliveryZoneName = zone.wilaya;
      deliveryEstimate = quote.estimatedTime;
    } else {
      shipping = subtotal >= freeShipThreshold ? 0 : SHIPPING_FLAT;
    }

    const total = subtotal + shipping;
    const orderNumber = `RVN-${Date.now().toString(36).toUpperCase()}${Math.floor(
      Math.random() * 900 + 100,
    )}`;

    // ------------------------------------------------------------------
    // Atomic purchase: guarded stock decrements + order insert in ONE
    // transaction. Any insufficient stock aborts the whole checkout.
    // ------------------------------------------------------------------
    let insertError: { error: string; code: string } | null = null;
    const inserted = await db.transaction(async (tx) => {
      for (const line of merged) {
        if (line.variantId != null) {
          const updated = await tx
            .update(productVariants)
            .set({ stock: sql`${productVariants.stock} - ${line.quantity}` })
            .where(
              and(
                eq(productVariants.id, line.variantId),
                sql`${productVariants.stock} >= ${line.quantity}`,
              ),
            )
            .returning({ id: productVariants.id });
          if (!updated.length) {
            insertError = {
              error: `${line.product.name} (${line.size || "—"} / ${line.color || "—"}): only limited stock available`,
              code: "INSUFFICIENT_STOCK",
            };
            throw new Error("INSUFFICIENT_STOCK");
          }
        } else {
          const updated = await tx
            .update(products)
            .set({ stock: sql`${products.stock} - ${line.quantity}` })
            .where(
              and(
                eq(products.id, line.product.id),
                sql`${products.stock} >= ${line.quantity}`,
              ),
            )
            .returning({ id: products.id });
          if (!updated.length) {
            insertError = {
              error: `${line.product.name}: only limited stock available`,
              code: "INSUFFICIENT_STOCK",
            };
            throw new Error("INSUFFICIENT_STOCK");
          }
        }
      }

      return tx
        .insert(orders)
        .values({
          orderNumber,
          email: String(body.email ?? "").trim(),
          fullName: String(body.fullName).trim(),
          phone: String(body.phone ?? "").trim(),
          address: String(body.address ?? "").trim(),
          // Legacy fields stay writable but are no longer requested by the
          // storefront; country defaults to Algeria (Algeria-first store).
          city: String(body.city ?? "").trim(),
          postalCode: String(body.postalCode ?? "").trim(),
          country: String(body.country ?? "").trim() || "الجزائر",
          // Phase 8: wilaya/commune captured for Algeria-first delivery.
          wilaya: deliveryZoneName || String(body.wilaya ?? "").trim(),
          commune: String(body.commune ?? "").trim(),
          subtotal,
          shipping,
          deliveryPrice: shipping,
          total,
          items: orderItems,
          status: "جديد",
          // Phase 8: immutable shipping snapshot — zone/method/estimate as
          // chosen at checkout; later zone price changes never touch this.
          deliveryMethod,
          deliveryZoneCode,
          deliveryEstimate,
          // Phase 7 snapshots: payment is cash-on-delivery (the store's real
          // checkout method) and the currency is fixed at purchase time.
          paymentMethod: "cod",
          currency: store ? store.currency : "",
        })
        .returning();
    }).catch((err) => {
      if (insertError) return null;
      throw err;
    });
    const order = inserted?.[0];

    if (!order) {
      return Response.json(
        { ok: false, error: insertError!.error, code: insertError!.code },
        { status: 409 },
      );
    }

    // Keep product-level totals/sold-out flags in sync after the decrement.
    const touchedProductIds = [...new Set(merged.map((l) => l.product.id))];
    for (const pid of touchedProductIds) {
      try {
        await syncProductStockFlags(pid);
      } catch (err) {
        console.error("[checkout] stock flag sync failed:", err);
      }
    }

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
