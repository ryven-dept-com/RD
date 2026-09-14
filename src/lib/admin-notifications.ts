import "server-only";

import { createSign } from "node:crypto";
import { db } from "@/db";
import { adminDevices, adminNotifications, type Order } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { formatMoney } from "@/lib/money";

/**
 * Private admin notifications (mobile admin app).
 *
 * When a customer order is successfully created the store notifies the
 * REGISTERED ADMIN DEVICE(S) — never customers. The notification carries
 * only what is needed to act on it: the order number and the total amount
 * (customer name, phone and address stay server-side; the full order is
 * fetched by the authenticated admin app from the existing admin APIs).
 *
 * Delivery providers (server-side only — no provider secret ever reaches
 * any client bundle):
 *  - FCM HTTP v1  → set FCM_SERVICE_ACCOUNT_JSON (service account JSON)
 *  - FCM legacy   → set FCM_SERVER_KEY
 *  - neither      → notifications are still recorded and served to the
 *                   admin app's in-app notification history; push delivery
 *                   is skipped (logged, never faked).
 *
 * Duplicates are impossible: one admin_notifications row per (order, type)
 * enforced by a unique index, plus an FCM collapse_key per order.
 */

export const ADMIN_NEW_ORDER_TITLE = "RYVEN DEPT — Nouvelle commande";
export const NOTIFICATION_TYPE_NEW_ORDER = "new_order";

// ---------------------------------------------------------------------------
// Notification content
// ---------------------------------------------------------------------------

export type AdminNotificationPayload = {
  title: string;
  body: string;
  /** Only non-sensitive routing data — no customer PII. */
  data: Record<string, string>;
};

/**
 * Build the alert for a new order. Deliberately minimal: order number,
 * total and order status only. The body never contains the customer's
 * name, phone, address or item details (privacy on lock screens) — full
 * order details stay on the secure admin order page.
 */
export function buildNewOrderPayload(order: Order): AdminNotificationPayload {
  const total = formatMoney(order.total, "fr", order.currency || "DZD");
  const status = order.status || "جديد";
  return {
    title: ADMIN_NEW_ORDER_TITLE,
    body: `${order.orderNumber} · ${total} · ${status}`,
    data: {
      type: NOTIFICATION_TYPE_NEW_ORDER,
      orderId: String(order.id),
      orderNumber: order.orderNumber,
      status,
    },
  };
}

// ---------------------------------------------------------------------------
// Push provider configuration (env-driven, server-only)
// ---------------------------------------------------------------------------

export type PushConfig =
  | { kind: "fcm-v1"; projectId: string; clientEmail: string; privateKey: string }
  | { kind: "fcm-legacy"; serverKey: string }
  | { kind: "none" };

/**
 * Resolve the push provider from server environment variables. Pure and
 * side-effect free so it can be unit-tested. Invalid configuration falls
 * back to "none" (record-only) rather than crashing checkout.
 */
export function getPushConfig(
  env: Record<string, string | undefined> = process.env,
): PushConfig {
  const sa = env.FCM_SERVICE_ACCOUNT_JSON;
  if (sa && sa.trim()) {
    try {
      const parsed = JSON.parse(sa) as {
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };
      if (parsed.project_id && parsed.client_email && parsed.private_key) {
        return {
          kind: "fcm-v1",
          projectId: parsed.project_id,
          clientEmail: parsed.client_email,
          privateKey: parsed.private_key.replace(/\\n/g, "\n"),
        };
      }
      console.warn("[admin-notify] FCM_SERVICE_ACCOUNT_JSON is incomplete — ignoring");
    } catch {
      console.warn("[admin-notify] FCM_SERVICE_ACCOUNT_JSON is not valid JSON — ignoring");
    }
  }
  const legacyKey = env.FCM_SERVER_KEY;
  if (legacyKey && legacyKey.trim()) {
    return { kind: "fcm-legacy", serverKey: legacyKey.trim() };
  }
  return { kind: "none" };
}

// ---------------------------------------------------------------------------
// Device registry (authenticated admins only — routes enforce auth + CSRF)
// ---------------------------------------------------------------------------

const SUPPORTED_PROVIDERS = new Set(["fcm"]);

export async function registerAdminDevice(input: {
  provider?: unknown;
  token?: unknown;
  deviceName?: unknown;
}): Promise<{ id: number; provider: string; tokenMasked: string }> {
  const provider = String(input.provider ?? "fcm").trim().toLowerCase();
  const token = String(input.token ?? "").trim();
  const deviceName = String(input.deviceName ?? "").trim().slice(0, 120);

  if (!SUPPORTED_PROVIDERS.has(provider)) {
    throw new Error("Unsupported push provider");
  }
  if (!token || token.length < 16 || token.length > 4096) {
    throw new Error("Invalid device token");
  }
  if (/[\u0000-\u001f]/.test(token)) {
    throw new Error("Invalid device token");
  }

  const rows = await db
    .insert(adminDevices)
    .values({ provider, token, deviceName })
    .onConflictDoUpdate({
      target: adminDevices.token,
      set: { deviceName, lastSeenAt: new Date() },
    })
    .returning({ id: adminDevices.id, token: adminDevices.token });
  const row = rows[0];
  return { id: row.id, provider, tokenMasked: maskToken(row.token) };
}

export async function unregisterAdminDevice(id: number): Promise<boolean> {
  const deleted = await db
    .delete(adminDevices)
    .where(eq(adminDevices.id, id))
    .returning({ id: adminDevices.id });
  return deleted.length > 0;
}

export async function listAdminDevices(): Promise<
  Array<{
    id: number;
    provider: string;
    tokenMasked: string;
    deviceName: string;
    createdAt: string;
    lastSeenAt: string;
  }>
> {
  const rows = await db
    .select()
    .from(adminDevices)
    .orderBy(desc(adminDevices.lastSeenAt), desc(adminDevices.id));
  return rows.map((r) => ({
    id: r.id,
    provider: r.provider,
    tokenMasked: maskToken(r.token),
    deviceName: r.deviceName,
    createdAt: r.createdAt.toISOString(),
    lastSeenAt: r.lastSeenAt.toISOString(),
  }));
}

function maskToken(token: string): string {
  if (token.length <= 12) return "•".repeat(token.length);
  return `${token.slice(0, 8)}…${token.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Notification creation + fan-out
// ---------------------------------------------------------------------------

export type NotifyResult = {
  created: boolean;
  notificationId: number | null;
  devices: number;
  delivered: number;
};

/**
 * Record a new-order notification and deliver it to every registered admin
 * device. Idempotent per order: a second call for the same order creates
 * nothing and sends nothing (unique (order_id, type) constraint).
 *
 * Never throws: callers (checkout) must not be affected by notification
 * failures — the whole pipeline is defensive by design.
 */
export async function notifyAdminNewOrder(order: Order): Promise<NotifyResult> {
  try {
    const payload = buildNewOrderPayload(order);

    // Dedup-safe insert: conflict (same order, same type) → no row returned.
    const inserted = await db
      .insert(adminNotifications)
      .values({
        orderId: order.id,
        orderNumber: order.orderNumber,
        type: NOTIFICATION_TYPE_NEW_ORDER,
        title: payload.title,
        body: payload.body,
      })
      .onConflictDoNothing({
        target: [adminNotifications.orderId, adminNotifications.type],
      })
      .returning({ id: adminNotifications.id });

    if (!inserted.length) {
      return { created: false, notificationId: null, devices: 0, delivered: 0 };
    }
    const notificationId = inserted[0].id;

    const devices = await db
      .select()
      .from(adminDevices)
      .where(eq(adminDevices.provider, "fcm"));
    if (!devices.length) {
      return { created: true, notificationId, devices: 0, delivered: 0 };
    }

    const config = getPushConfig();
    let delivered = 0;
    if (config.kind === "none") {
      console.info(
        `[admin-notify] notification #${notificationId} recorded (${order.orderNumber}); push skipped — no FCM provider configured`,
      );
    } else {
      delivered = await deliverFcm(
        config,
        payload,
        devices.map((d) => d.token),
        order.id,
      );
    }
    return { created: true, notificationId, devices: devices.length, delivered };
  } catch (err) {
    console.error("[admin-notify] failed:", err);
    return { created: false, notificationId: null, devices: 0, delivered: 0 };
  }
}

// ---------------------------------------------------------------------------
// FCM delivery (HTTP v1 preferred, legacy key supported)
// ---------------------------------------------------------------------------

const FCM_TIMEOUT_MS = 6_000;

/**
 * FCM HTTP v1 message for one admin device token. Pure + exported for unit
 * testing. The generic `notification` + `data` fields cover Android/desktop
 * clients; the `webpush` override makes browsers display the notification
 * even when the admin tab is closed (background web push) and marks the
 * message high-urgency so phones deliver it immediately.
 */
export function buildFcmV1Message(
  payload: AdminNotificationPayload,
  token: string,
  orderId: number,
) {
  return {
    message: {
      token,
      notification: { title: payload.title, body: payload.body },
      data: { ...payload.data, orderId: String(orderId) },
      webpush: {
        headers: { Urgency: "high" },
        notification: { title: payload.title, body: payload.body },
        data: { ...payload.data, orderId: String(orderId) },
        fcm_options: { link: `/admin/orders/${orderId}` },
      },
      android: { collapse_key: `order-${orderId}`, priority: "high" },
    },
  };
}

/**
 * Detect FCM responses meaning the token is gone (app uninstalled, browser
 * cleared, token expired). Such devices are pruned so future orders stop
 * wasting sends on dead tokens.
 */
export function isUnregisteredTokenResponse(
  status: number,
  bodyText: string,
): boolean {
  if (status === 404) return true;
  const lower = bodyText.toLowerCase();
  return (
    lower.includes("unregistered") ||
    lower.includes("invalid-registration-token") ||
    lower.includes("registration token is no longer valid")
  );
}

async function deliverFcm(
  config: Exclude<PushConfig, { kind: "none" }>,
  payload: AdminNotificationPayload,
  tokens: string[],
  orderId: number,
): Promise<number> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FCM_TIMEOUT_MS);
  try {
    if (config.kind === "fcm-legacy") {
      const res = await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          Authorization: `key=${config.serverKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          registration_ids: tokens,
          notification: { title: payload.title, body: payload.body },
          data: payload.data,
          // Per-order collapse key: retries replace the same message instead
          // of stacking duplicates on the admin device.
          collapse_key: `order-${orderId}`,
          priority: "high",
          time_to_live: 60 * 60 * 24 * 28, // offline devices catch up later
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        console.warn(`[admin-notify] FCM legacy responded ${res.status}`);
        return 0;
      }
      const json = (await res.json().catch(() => null)) as {
        success?: number;
      } | null;
      return Number(json?.success ?? 0);
    }

    // FCM HTTP v1: one message per token. Endpoints are overridable via env
    // (test seam for offline stub servers); defaults are the real Google
    // endpoints. Secrets never leave the server.
    const fcmBase = (process.env.FCM_API_BASE || "https://fcm.googleapis.com").replace(/\/$/, "");
    const accessToken = await getFcmAccessToken(config);
    let delivered = 0;
    for (const token of tokens) {
      const res = await fetch(
        `${fcmBase}/v1/projects/${encodeURIComponent(config.projectId)}/messages:send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(buildFcmV1Message(payload, token, orderId)),
          signal: controller.signal,
        },
      );
      if (res.ok) {
        delivered += 1;
        continue;
      }
      const errText = await res.text().catch(() => "");
      if (isUnregisteredTokenResponse(res.status, errText)) {
        // Token is dead (browser cleared / uninstalled): prune the device so
        // it never receives (or blocks) future sends.
        try {
          await db.delete(adminDevices).where(eq(adminDevices.token, token));
          console.info(`[admin-notify] pruned unregistered device token (${maskToken(token)})`);
        } catch (pruneErr) {
          console.warn("[admin-notify] failed to prune device:", pruneErr);
        }
      } else {
        console.warn(`[admin-notify] FCM v1 responded ${res.status}`);
      }
    }
    return delivered;
  } catch (err) {
    console.error("[admin-notify] FCM delivery failed:", err);
    return 0;
  } finally {
    clearTimeout(timer);
  }
}

// ---- OAuth2 access token for FCM HTTP v1 (JWT bearer, RS256) -------------

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getFcmAccessToken(config: {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) return cachedToken.value;

  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: config.clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const b64 = (o: object) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  const signingInput = `${b64(header)}.${b64(claim)}`;
  const signature = createSign("RSA-SHA256")
    .update(signingInput)
    .sign(config.privateKey, "base64url");
  const jwt = `${signingInput}.${signature}`;

  const res = await fetch(
    process.env.FCM_OAUTH_TOKEN_URL || "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    },
  );
  if (!res.ok) throw new Error(`OAuth token request failed (${res.status})`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: json.access_token,
    expiresAt: now + Number(json.expires_in || 3600),
  };
  return json.access_token;
}

// ---------------------------------------------------------------------------
// Notification history (served to the authenticated admin app)
// ---------------------------------------------------------------------------

export async function listAdminNotifications(limit = 50): Promise<
  Array<{
    id: number;
    orderId: number | null;
    orderNumber: string;
    type: string;
    title: string;
    body: string;
    createdAt: string;
  }>
> {
  const safeLimit = Math.min(200, Math.max(1, Math.floor(limit) || 50));
  const rows = await db
    .select()
    .from(adminNotifications)
    .orderBy(desc(adminNotifications.id))
    .limit(safeLimit);
  return rows.map((n) => ({
    id: n.id,
    orderId: n.orderId,
    orderNumber: n.orderNumber,
    type: n.type,
    title: n.title,
    body: n.body,
    createdAt: n.createdAt.toISOString(),
  }));
}
