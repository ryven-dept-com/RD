import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { db } from "@/db";
import { adminDevices, adminNotifications, orders, type Order } from "@/db/schema";
import type { orders as ordersTable } from "@/db/schema";
import { bootstrapIfNeeded } from "./seed-db";
import {
  ADMIN_NEW_ORDER_TITLE,
  buildNewOrderPayload,
  getPushConfig,
  listAdminDevices,
  listAdminNotifications,
  notifyAdminNewOrder,
  registerAdminDevice,
  unregisterAdminDevice,
} from "./admin-notifications";

const require = createRequire(import.meta.url);
const { PGlite } = require("@electric-sql/pglite");
const { createServer } = require("pglite-server");

/**
 * Regression tests for the private mobile admin app backend:
 * device registry, notification dedup, privacy of notification content,
 * and provider configuration. Uses a real database (PGlite).
 */

// The embedded database listens on 5432 — the port the app-level pool from
// "@/db" connects to under vitest (see vitest.config.ts). Every function
// under test uses that real app pool, exactly like production code.
const PORT = 5432;

let pglite: { waitReady: Promise<void> };
let server: {
  listen: (options: { host: string; port: number }, cb?: () => void) => void;
  close: () => void;
};

let orderSeq = 0;
async function insertOrder(
  overrides: Partial<typeof ordersTable.$inferInsert> = {},
): Promise<Order> {
  orderSeq += 1;
  const rows = await db
    .insert(orders)
    .values({
      orderNumber: `RVN-NOTIF-${String(orderSeq).padStart(4, "0")}`,
      fullName: "Private Customer",
      phone: "0555000111",
      address: "Rue Test, Commune Test",
      wilaya: "Alger",
      commune: "Bab El Oued",
      subtotal: 250000,
      shipping: 995,
      deliveryPrice: 995,
      total: 250995,
      currency: "DZD",
      items: [],
      ...overrides,
    })
    .returning();
  return rows[0];
}

beforeAll(async () => {
  pglite = new PGlite(); // in-memory database
  await pglite.waitReady;
  server = createServer(pglite);
  await new Promise<void>((resolve) =>
    server.listen({ host: "127.0.0.1", port: PORT }, () => resolve()),
  );
  await bootstrapIfNeeded(db);
}, 30_000);

afterAll(async () => {
  try {
    server?.close();
  } catch {
    // ignore
  }
});

describe("getPushConfig (env-driven provider selection)", () => {
  it("defaults to record-only when nothing is configured", () => {
    expect(getPushConfig({})).toEqual({ kind: "none" });
  });

  it("uses the legacy key when FCM_SERVER_KEY is set", () => {
    expect(getPushConfig({ FCM_SERVER_KEY: " AAAAkey " })).toEqual({
      kind: "fcm-legacy",
      serverKey: "AAAAkey",
    });
  });

  it("prefers HTTP v1 when a valid service account is provided", () => {
    const sa = JSON.stringify({
      project_id: "ryven-dept",
      client_email: "fcm@ryven-dept.iam.gserviceaccount.com",
      private_key: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n",
    });
    const config = getPushConfig({ FCM_SERVICE_ACCOUNT_JSON: sa });
    expect(config.kind).toBe("fcm-v1");
    if (config.kind === "fcm-v1") {
      expect(config.projectId).toBe("ryven-dept");
      expect(config.privateKey).toContain("BEGIN PRIVATE KEY");
      expect(config.privateKey).not.toContain("\\n");
    }
  });

  it("falls back to record-only on invalid service account JSON", () => {
    expect(getPushConfig({ FCM_SERVICE_ACCOUNT_JSON: "{oops" })).toEqual({
      kind: "none",
    });
    expect(getPushConfig({ FCM_SERVICE_ACCOUNT_JSON: "{}" })).toEqual({
      kind: "none",
    });
  });
});

describe("admin device registry", () => {
  it("registers a device and refreshes it on re-registration", async () => {
    const token = "fcm-token-aaaa-bbbb-cccc-dddd-0001";
    const first = await registerAdminDevice({
      provider: "fcm",
      token,
      deviceName: "Owner Pixel",
    });
    expect(first.id).toBeGreaterThan(0);
    expect(first.tokenMasked).not.toContain(token); // masked in responses

    const again = await registerAdminDevice({
      provider: "FCM", // normalized
      token,
      deviceName: "Owner Pixel (renamed)",
    });
    expect(again.id).toBe(first.id); // upsert, not duplicate

    const devices = await listAdminDevices();
    const mine = devices.filter((d) => d.id === first.id);
    expect(mine).toHaveLength(1);
    expect(mine[0].deviceName).toBe("Owner Pixel (renamed)");
    expect(await db.$count(adminDevices)).toBe(1);
  });

  it("rejects invalid registrations server-side", async () => {
    await expect(
      registerAdminDevice({ provider: "apns", token: "whatever-long-token-here" }),
    ).rejects.toThrow("Unsupported push provider");
    await expect(
      registerAdminDevice({ provider: "fcm", token: "short" }),
    ).rejects.toThrow("Invalid device token");
    await expect(
      registerAdminDevice({ provider: "fcm", token: "" }),
    ).rejects.toThrow("Invalid device token");
    await expect(
      registerAdminDevice({ provider: "fcm", token: "bad\u0001token-0000000000" }),
    ).rejects.toThrow("Invalid device token");
  });

  it("unregisters a device", async () => {
    const token = "fcm-token-aaaa-bbbb-cccc-dddd-0002";
    const device = await registerAdminDevice({ provider: "fcm", token });
    expect(await unregisterAdminDevice(device.id)).toBe(true);
    expect(await unregisterAdminDevice(device.id)).toBe(false);
    expect(await unregisterAdminDevice(999999)).toBe(false);
  });
});

describe("new-order notifications", () => {
  it("builds a privacy-safe payload (order number + total only)", async () => {
    const order = await insertOrder();
    const payload = buildNewOrderPayload(order);

    expect(payload.title).toBe("RYVEN DEPT — New Order");
    expect(payload.body).toContain(order.orderNumber);
    expect(payload.body).toContain("2 509,95"); // formatted total
    expect(payload.body).not.toContain(order.fullName);
    expect(payload.body).not.toContain(order.phone);
    expect(payload.body).not.toContain(order.address);

    expect(payload.data).toEqual({
      type: "new_order",
      orderId: String(order.id),
      orderNumber: order.orderNumber,
    });
  });

  it("creates exactly one notification per order (dedup)", async () => {
    // State-independent: clear any devices registered by earlier tests.
    await db.delete(adminDevices);
    const order = await insertOrder();

    const first = await notifyAdminNewOrder(order);
    expect(first.created).toBe(true);
    expect(first.notificationId).toBeGreaterThan(0);
    expect(first.devices).toBe(0); // no registered devices in this test DB

    const second = await notifyAdminNewOrder(order); // retry / duplicate
    expect(second.created).toBe(false);
    expect(second.notificationId).toBeNull();

    const rows = await db.select().from(adminNotifications);
    const mine = rows.filter(
      (r: { orderId: number | null }) => r.orderId === order.id,
    );
    expect(mine).toHaveLength(1);
    expect(mine[0].title).toBe(ADMIN_NEW_ORDER_TITLE);
    expect(mine[0].body).toContain(order.orderNumber);
    // Never any customer PII in the stored alert.
    expect(JSON.stringify(mine[0])).not.toContain("Private Customer");
    expect(JSON.stringify(mine[0])).not.toContain("0555000111");
  });

  it("serves history newest-first", async () => {
    const a = await insertOrder();
    const b = await insertOrder();
    await notifyAdminNewOrder(a);
    await notifyAdminNewOrder(b);

    const history = await listAdminNotifications(10);
    expect(history.length).toBeGreaterThanOrEqual(2);
    expect(history[0].orderNumber).toBe(b.orderNumber);
    const ids = history.map((n) => n.id);
    expect([...ids].sort((x, y) => y - x)).toEqual(ids);
  });
});
