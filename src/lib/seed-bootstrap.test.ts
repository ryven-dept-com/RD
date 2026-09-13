import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, sql } from "drizzle-orm";
import { orders, productVariants, products } from "@/db/schema";
import { seedProducts } from "@/lib/seed-data";
import { bootstrapIfNeeded, seedCatalogue } from "./seed-db";

const require = createRequire(import.meta.url);
const { PGlite } = require("@electric-sql/pglite");
const { createServer } = require("pglite-server");

/**
 * Regression tests for permanent product deletion.
 *
 * Reproduces the production bug: bootstrap used to "top up" the catalogue
 * whenever the product count dropped below the seed count, silently
 * resurrecting products an admin had deleted. The fixed model seeds the
 * catalogue exactly once per database (persistent app_meta marker) and never
 * reconciles products afterwards.
 *
 * A real database (PGlite) is used and bootstrapIfNeeded is invoked multiple
 * times against the same database — each invocation models a server restart /
 * serverless cold start.
 */

const PORT = 55437;
const DELETED_SLUG = "vault-heavyweight-hoodie-black";
const KEPT_SLUG = "core-boxy-tee-bone";

let pglite: { waitReady: Promise<void> };
let server: {
  listen: (options: { host: string; port: number }, cb?: () => void) => void;
  close: () => void;
};
let pool: Pool;
let db: any; // drizzle instance over the PGlite-backed pool

async function productBySlug(slug: string) {
  const rows = await db.select().from(products).where(eq(products.slug, slug));
  return rows[0] ?? null;
}

async function productCount() {
  return db.$count(products);
}

async function markerValue() {
  const res = await db.execute(
    sql`SELECT "value" FROM "app_meta" WHERE "key" = 'catalogSeeded.v1'`,
  );
  return String((res.rows[0] as any)?.value ?? "");
}

beforeAll(async () => {
  pglite = new PGlite(); // in-memory database
  await pglite.waitReady;
  server = createServer(pglite);
  await new Promise<void>((resolve) =>
    server.listen({ host: "127.0.0.1", port: PORT }, () => resolve()),
  );
  pool = new Pool({
    connectionString: `postgresql://postgres:postgres@127.0.0.1:${PORT}/app_db`,
    max: 4,
  });
  db = drizzle(pool);
}, 30_000);

afterAll(async () => {
  await pool?.end();
  try {
    server?.close();
  } catch {
    // ignore
  }
});

describe("bootstrap: one-time catalogue initialization", () => {
  it("fresh database: seeds the demo catalogue once and writes the marker", async () => {
    // On a pristine database the schema does not exist yet; bootstrap creates
    // it and performs the one-time seed in the same call.
    await bootstrapIfNeeded(db);
    expect(await productCount()).toBe(seedProducts.length);
    const marker = markerValue();
    await expect(marker).resolves.toContain('"at"');
  }, 30_000);

  it("a deleted product is NOT recreated by subsequent startups", async () => {
    const victim = await productBySlug(DELETED_SLUG);
    expect(victim).not.toBeNull();

    await db.delete(products).where(eq(products.id, victim.id));
    expect(await productBySlug(DELETED_SLUG)).toBeNull();

    // Simulate restarts: every cold start runs bootstrapIfNeeded again.
    await bootstrapIfNeeded(db);
    await bootstrapIfNeeded(db);

    expect(await productBySlug(DELETED_SLUG)).toBeNull();
    expect(await productCount()).toBe(seedProducts.length - 1);

    // Variants of the deleted product are gone too (FK cascade).
    const variants = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, victim.id));
    expect(variants).toHaveLength(0);
  }, 30_000);

  it("existing products remain untouched by bootstrap", async () => {
    const before = await productBySlug(KEPT_SLUG);
    expect(before).not.toBeNull();

    await bootstrapIfNeeded(db);

    const after = await productBySlug(KEPT_SLUG);
    expect(after).not.toBeNull();
    expect(after.id).toBe(before.id);
    expect(after.name).toBe(before.name);
    expect(after.price).toBe(before.price);
    expect(after.description).toBe(before.description);
  }, 30_000);

  it("historical orders survive product deletion and later bootstraps", async () => {
    const victim = await productBySlug("terrain-cargo-pant-olive");
    expect(victim).not.toBeNull();

    await db.insert(orders).values({
      orderNumber: "RGN-DELETE-TEST-001",
      fullName: "History Test",
      address: "Anywhere",
      subtotal: victim.price,
      total: victim.price,
      items: [
        {
          slug: victim.slug,
          name: victim.name,
          price: victim.price,
          quantity: 1,
          size: "M",
          color: "Field Olive",
        },
      ],
      currency: "DZD",
    });

    await db.delete(products).where(eq(products.id, victim.id));
    await bootstrapIfNeeded(db); // restart after deletion

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.orderNumber, "RGN-DELETE-TEST-001"));
    expect(order).toBeDefined();
    expect(order.items).toHaveLength(1);
    // Snapshot integrity: the order keeps the product's data as purchased.
    expect(order.items[0].slug).toBe("terrain-cargo-pant-olive");
    expect(order.items[0].name).toBe(victim.name);
    expect(order.items[0].price).toBe(victim.price);
    expect(await productBySlug("terrain-cargo-pant-olive")).toBeNull();
  }, 30_000);

  it("never applies a 'count < N' top-up: an emptied catalogue stays empty", async () => {
    await db.delete(products);
    expect(await productCount()).toBe(0);

    await bootstrapIfNeeded(db); // would have resurrected everything pre-fix

    expect(await productCount()).toBe(0);
    await expect(markerValue()).resolves.not.toBe("");
  }, 30_000);

  it("explicit manual seeding stays separate and still works when invoked", async () => {
    // Normal startup must NOT seed...
    await bootstrapIfNeeded(db);
    expect(await productCount()).toBe(0);

    // ...but the explicit/manual seed routine still can (used by /api/seed
    // and setup tooling only — never by normal startup reconciliation).
    await seedCatalogue(db, { clear: false });
    expect(await productCount()).toBe(seedProducts.length);

    // And it never duplicates existing products.
    await seedCatalogue(db, { clear: false });
    expect(await productCount()).toBe(seedProducts.length);
  }, 60_000);
});
