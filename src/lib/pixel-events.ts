/**
 * Meta Ads tracking — pure event builders shared by the browser Pixel and
 * the (future) Meta Conversions API.
 *
 * Keeping payload construction in one place guarantees the browser Pixel
 * and server-side events describe products identically, and lets both
 * sides attach the SAME `eventID` so Meta can deduplicate them when the
 * Conversions API is enabled.
 *
 * This module is pure (no DOM, no network) so it can be unit-tested and
 * imported from both client components and server routes.
 */

export type PixelEventName =
  | "PageView"
  | "ViewContent"
  | "AddToCart"
  | "InitiateCheckout"
  | "Purchase";

export type PixelContent = {
  id: string;
  quantity: number;
  item_price?: number;
  title?: string;
};

export type PixelEventData = {
  content_ids: string[];
  content_type: "product";
  contents: PixelContent[];
  value: number;
  currency: string;
  num_items: number;
  [key: string]: unknown;
};

export type BuiltPixelEvent = {
  eventName: PixelEventName;
  data: PixelEventData;
  eventId: string;
};

/**
 * Unique event ID for Meta deduplication. Sent as `eventID` with the
 * browser Pixel call and as `event_id` in Conversions API payloads —
 * Meta keeps only one event per (event name, event ID) pair.
 */
export function makeEventId(random?: () => number): string {
  const rnd = random ?? Math.random;
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 24; i += 1) {
    out += alphabet[Math.floor(rnd() * alphabet.length)];
  }
  return `${Date.now().toString(36)}-${out}`;
}

/** Prices are stored in cents; Meta expects major units. */
export function toMajorUnits(cents: number): number {
  return Math.round((cents / 100) * 100) / 100;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

type ProductLike = {
  slug: string;
  name: string;
  price: number;
  category?: string;
};

/** ViewContent — fired on product pages. */
export function buildViewContentEvent(
  product: ProductLike,
  currency: string,
  eventId?: string,
): BuiltPixelEvent {
  return {
    eventName: "ViewContent",
    eventId: eventId ?? makeEventId(),
    data: {
      content_ids: [product.slug],
      content_type: "product",
      contents: [
        { id: product.slug, quantity: 1, item_price: toMajorUnits(product.price) },
      ],
      content_name: product.name,
      ...(product.category ? { content_category: product.category } : {}),
      value: toMajorUnits(product.price),
      currency,
      num_items: 1,
    },
  };
}

/** AddToCart — fired only after a real product was added to the cart. */
export function buildAddToCartEvent(
  product: ProductLike,
  quantity: number,
  currency: string,
  eventId?: string,
): BuiltPixelEvent {
  const qty = Math.max(1, Math.floor(quantity));
  return {
    eventName: "AddToCart",
    eventId: eventId ?? makeEventId(),
    data: {
      content_ids: [product.slug],
      content_type: "product",
      contents: [
        {
          id: product.slug,
          quantity: qty,
          item_price: toMajorUnits(product.price),
          title: product.name,
        },
      ],
      content_name: product.name,
      value: round2(toMajorUnits(product.price) * qty),
      currency,
      num_items: qty,
    },
  };
}

/** InitiateCheckout — fired when the checkout flow actually starts. */
export function buildInitiateCheckoutEvent(
  items: Array<{ slug: string; name?: string; price: number; quantity: number }>,
  currency: string,
  eventId?: string,
): BuiltPixelEvent {
  const contents: PixelContent[] = items.map((i) => ({
    id: i.slug,
    quantity: Math.max(1, Math.floor(i.quantity)),
    item_price: toMajorUnits(i.price),
    ...(i.name ? { title: i.name } : {}),
  }));
  const value = round2(
    items.reduce((sum, i) => sum + toMajorUnits(i.price) * i.quantity, 0),
  );
  return {
    eventName: "InitiateCheckout",
    eventId: eventId ?? makeEventId(),
    data: {
      content_ids: items.map((i) => i.slug),
      content_type: "product",
      contents,
      value,
      currency,
      num_items: items.reduce((sum, i) => sum + i.quantity, 0),
    },
  };
}

/**
 * Purchase — fired only after an order was successfully created. The
 * `eventId` MUST come from the order API response so the browser Pixel and
 * the server-side Conversions API event share one ID and Meta deduplicates
 * them instead of double-counting revenue.
 */
export function buildPurchaseEvent(
  params: {
    orderNumber: string;
    items: Array<{ slug: string; name?: string; price: number; quantity: number }>;
    total: number;
    currency: string;
    eventId: string;
  },
): BuiltPixelEvent {
  const contents: PixelContent[] = params.items.map((i) => ({
    id: i.slug,
    quantity: Math.max(1, Math.floor(i.quantity)),
    item_price: toMajorUnits(i.price),
    ...(i.name ? { title: i.name } : {}),
  }));
  return {
    eventName: "Purchase",
    eventId: params.eventId,
    data: {
      content_ids: params.items.map((i) => i.slug),
      content_type: "product",
      contents,
      value: round2(toMajorUnits(params.total)),
      currency: params.currency,
      num_items: params.items.reduce((sum, i) => sum + i.quantity, 0),
      order_id: params.orderNumber,
    },
  };
}

// ---------------------------------------------------------------------------
// Purchase deduplication across refresh / reload / bfcache.
// The order number is the natural dedupe key: an order can only ever be
// purchased once, regardless of how many times the confirmation screen is
// re-rendered or the page reloaded.
// ---------------------------------------------------------------------------

const PURCHASE_TRACKED_PREFIX = "rvn:px:purchase:";

export function purchaseTrackedKey(orderNumber: string): string {
  return `${PURCHASE_TRACKED_PREFIX}${orderNumber}`;
}

export function wasPurchaseTracked(orderNumber: string): boolean {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return false;
    return window.sessionStorage.getItem(purchaseTrackedKey(orderNumber)) === "1";
  } catch {
    return false;
  }
}

export function markPurchaseTracked(orderNumber: string): void {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return;
    window.sessionStorage.setItem(purchaseTrackedKey(orderNumber), "1");
  } catch {
    // sessionStorage unavailable (private mode) — the eventID shared with
    // the Conversions API still protects against double counting.
  }
}
