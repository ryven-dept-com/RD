import "server-only";

import { db } from "@/db";
import {
  deliveryZones,
  SHIPPING_METHODS,
  type DeliveryStatus,
  type ShippingMethod,
} from "@/db/schema";
import { and, asc, eq, ilike, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Phase 8 — delivery status lifecycle (complements the Phase 7 order status)
// ---------------------------------------------------------------------------

export const DELIVERY_TRANSITIONS: Record<DeliveryStatus, readonly DeliveryStatus[]> = {
  not_ready: ["ready"],
  ready: ["handed_to_courier", "not_ready"],
  handed_to_courier: ["in_transit"],
  in_transit: ["delivered", "returned"],
  delivered: ["returned"],
  returned: [],
};

export function isKnownDeliveryStatus(value: string): value is DeliveryStatus {
  return Object.prototype.hasOwnProperty.call(DELIVERY_TRANSITIONS, value);
}

export function isTerminalDeliveryStatus(value: string): boolean {
  return value === "returned";
}

/** Same-status updates are idempotent no-ops (matches the Phase 7 pattern). */
export function isValidDeliveryTransition(from: string, to: string): boolean {
  if (!isKnownDeliveryStatus(from) || !isKnownDeliveryStatus(to)) return false;
  if (from === to) return true;
  return (DELIVERY_TRANSITIONS[from] as readonly string[]).includes(to);
}

// ---------------------------------------------------------------------------
// Zone validation / sanitization (server is the source of truth — client
// prices are never trusted at checkout)
// ---------------------------------------------------------------------------

export type ZoneInput = {
  code: number;
  wilaya: string;
  slug?: string;
  city?: string;
  enabled?: boolean;
  homeEnabled?: boolean;
  homePrice?: number;
  homeEstimatedTime?: string;
  pickupEnabled?: boolean;
  pickupPrice?: number;
  pickupEstimatedTime?: string;
  notes?: string;
  sortOrder?: number;
};

/** Non-negative, integer-safe money value (DZD is handled as whole units). */
export function sanitizePrice(value: unknown, fallback = 0): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

export function sanitizeEstimate(value: unknown): string {
  return String(value ?? "").trim().slice(0, 80);
}

export function slugifyWilaya(wilaya: string, code: number): string {
  const slug = wilaya
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || `wilaya-${code}`;
}

export type ZoneValidationResult =
  | { ok: true; zone: Required<ZoneInput> }
  | { ok: false; error: string };

/** Full server-side validation for create/update payloads. */
export function validateZoneInput(
  body: Record<string, unknown>,
  opts: { requireCode: boolean },
): ZoneValidationResult {
  const wilaya = String(body.wilaya ?? "").trim().slice(0, 80);
  if (!wilaya) return { ok: false, error: "Wilaya / zone name is required" };

  let code = Number(body.code);
  if (opts.requireCode) {
    if (!Number.isFinite(code) || code < 1 || code > 58 || Math.floor(code) !== code) {
      return { ok: false, error: "Wilaya code must be an integer between 1 and 58" };
    }
    code = Math.floor(code);
  } else {
    code = Number.isFinite(code) ? Math.floor(code) : 0;
  }

  const homeEnabled = Boolean(body.homeEnabled ?? true);
  const pickupEnabled = Boolean(body.pickupEnabled ?? false);
  const homePrice = sanitizePrice(body.homePrice);
  const pickupPrice = sanitizePrice(body.pickupPrice);
  if (!homeEnabled && !pickupEnabled) {
    return {
      ok: false,
      error: "At least one shipping method must be enabled for the zone",
    };
  }

  return {
    ok: true,
    zone: {
      code,
      wilaya,
      slug: String(body.slug ?? "").trim().slice(0, 80) || slugifyWilaya(wilaya, code),
      city: String(body.city ?? "").trim().slice(0, 120),
      enabled: Boolean(body.enabled ?? true),
      homeEnabled,
      homePrice,
      homeEstimatedTime: sanitizeEstimate(body.homeEstimatedTime),
      pickupEnabled,
      pickupPrice,
      pickupEstimatedTime: sanitizeEstimate(body.pickupEstimatedTime),
      notes: String(body.notes ?? "").trim().slice(0, 1000),
      sortOrder: sanitizePrice(body.sortOrder, 0),
    },
  };
}

// ---------------------------------------------------------------------------
// Shipping quote — the ONLY place shipping prices are computed. The checkout
// calls this server-side; clients only ever see the result.
//
// Money units (single rule, enforced here):
//  - delivery_zones.home_price / pickup_price are stored as WHOLE DZD (DA) —
//    exactly the numbers the Admin Delivery panel shows and edits.
//  - The free-shipping threshold is a store SETTING in whole DZD (DA).
//  - Everything handed to the storefront (quote.shipping, public zone method
//    prices) is INTEGER CENTS, like every other amount in the store
//    (product prices, subtotals, order totals). The DA → cents conversion
//    happens only at this boundary.
// ---------------------------------------------------------------------------

/** Whole-dinar → cents factor (DZD has 100 centimes). */
export const DZD_TO_CENTS = 100;

/** Convert a whole-dinar delivery price to store cents. */
export function daToCents(wholeDzd: number): number {
  return sanitizePrice(wholeDzd) * DZD_TO_CENTS;
}

export type ShippingQuote = {
  method: ShippingMethod;
  shipping: number;
  freeShipping: boolean;
  estimatedTime: string;
};

/**
 * Server-authoritative shipping calculation:
 *  1. the zone must be active and the method enabled for it,
 *  2. shipping = the zone's configured method price (whole DZD in the DB,
 *     returned in cents),
 *  3. FREE SHIPPING applies to STOP DESK / BUREAU ONLY: an order subtotal at
 *     or above the free-shipping threshold (store setting, whole DZD —
 *     5,000 DA = 500,000 cents) ships bureau free. HOME DELIVERY ALWAYS
 *     keeps its configured wilaya price, at any subtotal.
 *
 * Compute the authoritative shipping fee for a zone + method.
 *
 * @param zone            delivery zone row (prices stored in WHOLE DZD)
 * @param method          "home" | "office"
 * @param subtotalCents   cart subtotal in INTEGER CENTS (store-wide unit)
 * @param freeShipThresholdDa  the store setting, in WHOLE DZD
 *
 * Unit-incident history: the threshold used to be compared raw against the
 * cents subtotal (DZD vs cents), which made every cart "free" and hid the
 * configured prices. Both sides are normalized to cents before comparing,
 * and the configured zone price is returned as cents so it lands in order
 * totals unchanged.
 */
export function quoteShipping(
  zone: { enabled: boolean; homeEnabled: boolean; pickupEnabled: boolean; homePrice: number; pickupPrice: number; homeEstimatedTime: string; pickupEstimatedTime: string; estimatedTime: string },
  method: ShippingMethod,
  subtotalCents: number,
  freeShipThresholdDa: number,
): ShippingQuote | null {
  if (!zone.enabled) return null;
  if (method === "home") {
    // Home delivery is NEVER free — the configured wilaya price applies at
    // every subtotal, including at/above the free-shipping threshold.
    if (!zone.homeEnabled) return null;
    return {
      method,
      shipping: daToCents(zone.homePrice),
      freeShipping: false,
      estimatedTime: zone.homeEstimatedTime || zone.estimatedTime,
    };
  }
  if (method === "office") {
    if (!zone.pickupEnabled) return null;
    const freeThresholdCents = daToCents(freeShipThresholdDa);
    const free = subtotalCents >= freeThresholdCents;
    return {
      method,
      shipping: free ? 0 : daToCents(zone.pickupPrice),
      freeShipping: free,
      estimatedTime: zone.pickupEstimatedTime || zone.estimatedTime,
    };
  }
  return null;
}

export function isShippingMethod(value: unknown): value is ShippingMethod {
  return SHIPPING_METHODS.includes(value as ShippingMethod);
}

// ---------------------------------------------------------------------------
// Queries (single-query, no N+1 — zones are a small configuration table)
// ---------------------------------------------------------------------------

export async function listActiveZonesPublic() {
  const rows = await db
    .select()
    .from(deliveryZones)
    .where(eq(deliveryZones.enabled, true))
    .orderBy(asc(deliveryZones.sortOrder), asc(deliveryZones.code));
  // Prices are exposed to the storefront in CENTS (store-wide unit); the
  // zone table itself stores whole DZD (what Admin sees and edits).
  return rows.map((z) => ({
    code: z.code,
    wilaya: z.wilaya,
    city: z.city,
    methods: {
      home: z.homeEnabled
        ? { price: daToCents(z.homePrice), estimatedTime: z.homeEstimatedTime || z.estimatedTime }
        : null,
      office: z.pickupEnabled
        ? { price: daToCents(z.pickupPrice), estimatedTime: z.pickupEstimatedTime || z.estimatedTime }
        : null,
    },
  }));
}

export async function getZoneByCode(code: number) {
  const [zone] = await db
    .select()
    .from(deliveryZones)
    .where(eq(deliveryZones.code, code))
    .limit(1);
  return zone ?? null;
}

export type AdminZoneListParams = {
  q?: string;
  active?: "all" | "active" | "inactive";
  sort?: "code" | "wilaya" | "price-desc" | "price-asc";
};

export async function listZonesAdmin(params: AdminZoneListParams) {
  const conditions = [];
  if (params.q?.trim()) {
    const needle = `%${params.q.trim()}%`;
    conditions.push(
      sql`(${deliveryZones.wilaya} ILIKE ${needle} OR ${deliveryZones.city} ILIKE ${needle} OR CAST(${deliveryZones.code} AS text) ILIKE ${needle})`,
    );
  }
  if (params.active === "active") conditions.push(eq(deliveryZones.enabled, true));
  if (params.active === "inactive") conditions.push(eq(deliveryZones.enabled, false));
  const where = conditions.length ? and(...conditions) : undefined;

  let orderClause;
  switch (params.sort) {
    case "wilaya":
      orderClause = asc(deliveryZones.wilaya);
      break;
    case "price-desc":
      orderClause = sql`${deliveryZones.homePrice} DESC, ${deliveryZones.code} ASC`;
      break;
    case "price-asc":
      orderClause = sql`${deliveryZones.homePrice} ASC, ${deliveryZones.code} ASC`;
      break;
    default:
      orderClause = sql`${deliveryZones.sortOrder} ASC, ${deliveryZones.code} ASC`;
  }

  return db.select().from(deliveryZones).where(where).orderBy(orderClause);
}

/**
 * Safe deletion policy: zones may only be removed once DISABLED. Historical
 * orders keep their immutable shipping snapshot regardless, and checkout
 * only ever offers enabled zones — so deleting a disabled zone cannot break
 * anything. Enabled zones are rejected with 409 so an admin consciously
 * deactivates first.
 */
export async function deleteZoneSafely(zoneId: number) {
  const [zone] = await db
    .select()
    .from(deliveryZones)
    .where(eq(deliveryZones.id, zoneId))
    .limit(1);
  if (!zone) return { ok: false as const, status: 404, error: "Zone not found" };
  if (zone.enabled) {
    return {
      ok: false as const,
      status: 409,
      error:
        "Active zones cannot be deleted. Disable the zone first (historical orders keep their shipping snapshot).",
    };
  }
  await db.delete(deliveryZones).where(eq(deliveryZones.id, zoneId));
  return { ok: true as const, zone };
}

export type { ShippingMethod };
