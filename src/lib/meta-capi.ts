import "server-only";

import { createHash } from "node:crypto";
import { getStoreSettings, getSettingSecret } from "@/lib/settings";
import { isoCurrencyCode } from "@/lib/money";

/**
 * Meta Conversions API (server-side events).
 *
 * Architecture: the browser Pixel and this dispatcher share ONE `event_id`
 * per conversion (generated in the checkout API), so Meta deduplicates the
 * pair instead of double-counting. Everything here is server-only — the
 * access token lives in the settings table and is NEVER included in API
 * responses, page props, or client bundles.
 *
 * When the Conversions API is not configured (disabled, missing token or
 * missing Pixel ID) every function is a safe no-op, so the browser Pixel
 * implementation keeps working untouched.
 */

const GRAPH_API_VERSION = "v21.0";
const REQUEST_TIMEOUT_MS = 8000;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Hash user data per Meta's normalization rules (trim, lowercase). */
function hashUserData(value: string, normalize: (v: string) => string) {
  const v = normalize(value);
  return v ? sha256(v) : undefined;
}

export type MetaPurchaseParams = {
  request: Request;
  orderNumber: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  postalCode: string;
  items: Array<{ slug: string; name: string; price: number; quantity: number }>;
  total: number;
  eventId: string;
};

export type MetaServerEventResult =
  | { sent: true; eventsReceived?: number; fbtraceId?: string }
  | { sent: false; reason: string };

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "";
  return request.headers.get("x-real-ip") ?? "";
}

/**
 * Send a Purchase event through the Conversions API. Resolves with a
 * diagnostic result; never throws for configuration problems so checkout is
 * never blocked by marketing infrastructure.
 */
export async function sendMetaPurchaseServerEvent(
  params: MetaPurchaseParams,
): Promise<MetaServerEventResult> {
  let store;
  try {
    store = await getStoreSettings();
  } catch {
    return { sent: false, reason: "settings unavailable" };
  }

  if (!store.metaPixelEnabled || !store.metaPixelId) {
    return { sent: false, reason: "pixel disabled or not configured" };
  }
  if (!store.metaCapiEnabled) {
    return { sent: false, reason: "conversions api disabled" };
  }

  // Secret read through a dedicated accessor — it is never part of the
  // typed settings view that can reach the client.
  const accessToken = await getSettingSecret("metaCapiAccessToken");
  if (!accessToken) {
    return { sent: false, reason: "conversions api token missing" };
  }

  const userData: Record<string, string> = {};
  const em = hashUserData(params.email, (v) => v.trim().toLowerCase());
  if (em) userData.em = em;
  const ph = hashUserData(params.phone, (v) => v.replace(/[^\d]/g, ""));
  if (ph) userData.ph = ph;
  const ct = hashUserData(params.city, (v) => v.trim().toLowerCase());
  if (ct) userData.ct = ct;
  const country = hashUserData(params.country, (v) => v.trim().toLowerCase());
  if (country) userData.country = country;
  const zp = hashUserData(params.postalCode, (v) => v.trim().toLowerCase());
  if (zp) userData.zp = zp;
  const ip = clientIp(params.request);
  if (ip) userData.client_ip_address = ip;
  const ua = params.request.headers.get("user-agent");
  if (ua) userData.client_user_agent = ua;

  const numItems = params.items.reduce((sum, i) => sum + i.quantity, 0);

  const event: Record<string, unknown> = {
    event_name: "Purchase",
    event_time: Math.floor(Date.now() / 1000),
    event_id: params.eventId,
    action_source: "website",
    event_source_url: `${new URL(params.request.url).origin}/checkout`,
    user_data: userData,
    custom_data: {
      currency: isoCurrencyCode(store.currency),
      value: Math.round(params.total) / 100,
      content_ids: params.items.map((i) => i.slug),
      content_type: "product",
      contents: params.items.map((i) => ({
        id: i.slug,
        quantity: i.quantity,
        item_price: i.price / 100,
        title: i.name,
      })),
      num_items: numItems,
      order_id: params.orderNumber,
    },
  };
  if (store.metaCapiTestEventCode) {
    event.test_event_code = store.metaCapiTestEventCode;
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(
    store.metaPixelId,
  )}/events`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Authorization header keeps the token out of URLs and server logs.
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ data: [event] }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const payload = (await res.json().catch(() => null)) as {
    events_received?: number;
    fbtrace_id?: string;
    error?: { message?: string };
  } | null;

  if (!res.ok) {
    return {
      sent: false,
      reason: `graph api ${res.status}${payload?.error?.message ? ": " + payload.error.message.slice(0, 200) : ""}`,
    };
  }

  return {
    sent: true,
    eventsReceived: payload?.events_received,
    fbtraceId: payload?.fbtrace_id,
  };
}
