import { randomBytes, scryptSync } from "node:crypto";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  adminUsers,
  categories,
  deliveryZones,
  orders,
  products,
  reviews,
  settings,
} from "@/db/schema";
import { seedProducts } from "@/lib/seed-data";

export type SeedDb = NodePgDatabase;

// ---------------------------------------------------------------------------
// Schema (kept in sync with src/db/schema.ts). Uses IF NOT EXISTS so the
// bootstrap can run safely on every server start, including on an empty
// production database that has never been migrated.
// ---------------------------------------------------------------------------
const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "admin_sessions" (
    "id" serial PRIMARY KEY NOT NULL,
    "token" text NOT NULL,
    "user_id" integer NOT NULL,
    "expires_at" timestamp NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "admin_sessions_token_unique" UNIQUE("token")
  )`,
  `CREATE TABLE IF NOT EXISTS "admin_users" (
    "id" serial PRIMARY KEY NOT NULL,
    "username" text NOT NULL,
    "password_hash" text NOT NULL,
    "display_name" text DEFAULT 'Administrator' NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "admin_users_username_unique" UNIQUE("username")
  )`,
  `CREATE TABLE IF NOT EXISTS "categories" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "slug" text NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "categories_name_unique" UNIQUE("name"),
    CONSTRAINT "categories_slug_unique" UNIQUE("slug")
  )`,
  `CREATE TABLE IF NOT EXISTS "delivery_zones" (
    "id" serial PRIMARY KEY NOT NULL,
    "code" integer NOT NULL,
    "wilaya" text NOT NULL,
    "price" integer DEFAULT 0 NOT NULL,
    "estimated_time" text DEFAULT '2-4 أيام' NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    CONSTRAINT "delivery_zones_code_unique" UNIQUE("code")
  )`,
  `CREATE TABLE IF NOT EXISTS "orders" (
    "id" serial PRIMARY KEY NOT NULL,
    "order_number" text NOT NULL,
    "email" text DEFAULT '' NOT NULL,
    "full_name" text NOT NULL,
    "phone" text DEFAULT '' NOT NULL,
    "address" text NOT NULL,
    "city" text DEFAULT '' NOT NULL,
    "postal_code" text DEFAULT '' NOT NULL,
    "country" text DEFAULT 'الجزائر' NOT NULL,
    "wilaya" text DEFAULT '' NOT NULL,
    "commune" text DEFAULT '' NOT NULL,
    "subtotal" integer NOT NULL,
    "shipping" integer DEFAULT 0 NOT NULL,
    "delivery_price" integer DEFAULT 0 NOT NULL,
    "total" integer NOT NULL,
    "items" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "status" text DEFAULT 'جديد' NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "orders_order_number_unique" UNIQUE("order_number")
  )`,
  // Mobile admin app: push-provider device handles registered by an
  // authenticated admin (private app only). Additive + idempotent.
  `CREATE TABLE IF NOT EXISTS "admin_devices" (
    "id" serial PRIMARY KEY NOT NULL,
    "provider" text DEFAULT 'fcm' NOT NULL,
    "token" text NOT NULL,
    "device_name" text DEFAULT '' NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "last_seen_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "admin_devices_token_unique" UNIQUE("token")
  )`,
  // Mobile admin app: notification log / history (new-order alerts).
  // One row per (order_id, type) — duplicate alerts are impossible.
  `CREATE TABLE IF NOT EXISTS "admin_notifications" (
    "id" serial PRIMARY KEY NOT NULL,
    "order_id" integer REFERENCES "orders"("id") ON DELETE cascade,
    "order_number" text DEFAULT '' NOT NULL,
    "type" text DEFAULT 'new_order' NOT NULL,
    "title" text DEFAULT '' NOT NULL,
    "body" text DEFAULT '' NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "admin_notifications_order_type_uniq"
    ON "admin_notifications" ("order_id", "type")`,
  `CREATE INDEX IF NOT EXISTS "admin_notifications_created_at_idx"
    ON "admin_notifications" ("created_at" DESC)`,
  `CREATE TABLE IF NOT EXISTS "products" (
    "id" serial PRIMARY KEY NOT NULL,
    "slug" text NOT NULL,
    "name" text NOT NULL,
    "tagline" text DEFAULT '' NOT NULL,
    "description" text DEFAULT '' NOT NULL,
    "price" integer NOT NULL,
    "compare_at_price" integer,
    "category" text NOT NULL,
    "collection" text DEFAULT '' NOT NULL,
    "images" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "sizes" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "colors" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "details" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "featured" boolean DEFAULT false NOT NULL,
    "is_new" boolean DEFAULT false NOT NULL,
    "best_seller" boolean DEFAULT false NOT NULL,
    "on_sale" boolean DEFAULT false NOT NULL,
    "sold_out" boolean DEFAULT false NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "stock" integer DEFAULT 50 NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "products_slug_unique" UNIQUE("slug")
  )`,
  `CREATE TABLE IF NOT EXISTS "reviews" (
    "id" serial PRIMARY KEY NOT NULL,
    "product_id" integer NOT NULL,
    "author" text NOT NULL,
    "rating" integer NOT NULL,
    "title" text DEFAULT '' NOT NULL,
    "body" text DEFAULT '' NOT NULL,
    "verified" boolean DEFAULT true NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "settings" (
    "key" text PRIMARY KEY NOT NULL,
    "value" text DEFAULT '' NOT NULL
  )`,
  // Persistent application markers. Used for one-time initialization flags
  // that must survive restarts, redeploys and serverless cold starts.
  `CREATE TABLE IF NOT EXISTS "app_meta" (
    "key" text PRIMARY KEY NOT NULL,
    "value" text DEFAULT '' NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
  )`,
];

const FOREIGN_KEYS: { name: string; statement: string }[] = [
  {
    name: "admin_sessions_user_id_admin_users_id_fk",
    statement: `ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_user_id_admin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action`,
  },
  {
    name: "reviews_product_id_products_id_fk",
    statement: `ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action`,
  },
];

// ---------------------------------------------------------------------------
// Storefront CMS tables (Phase 2). These are ensured on EVERY bootstrap —
// including databases created before Phase 2 — because ensureSchema()'s fast
// path returns early once the original catalogue tables exist. All statements
// are IF NOT EXISTS, so this is a safe, idempotent, non-destructive additive
// change (no ALTERs on existing tables, no data touched).
// ---------------------------------------------------------------------------
const CMS_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "cms_blocks" (
    "id" serial PRIMARY KEY NOT NULL,
    "type" text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "starts_at" timestamp,
    "ends_at" timestamp,
    "data" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "cms_blocks_type_position_idx" ON "cms_blocks" ("type", "position")`,
  `CREATE TABLE IF NOT EXISTS "media_files" (
    "id" serial PRIMARY KEY NOT NULL,
    "original_name" text NOT NULL,
    "mime_type" text NOT NULL,
    "kind" text NOT NULL,
    "size" integer DEFAULT 0 NOT NULL,
    "data" bytea NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "media_files_kind_idx" ON "media_files" ("kind")`,
];

// ---------------------------------------------------------------------------
// Product management schema (Phase 5). Runs on EVERY bootstrap (like the CMS
// schema) so databases created before Phase 5 are upgraded in place:
//   - new `product_variants` table (unique per product + size + color)
//   - additive products columns: sku, status, sort_order
//   - one-time, non-destructive backfill: every existing product gets one
//     variant per size × color combination, splitting its stock so the
//     catalogue-level total is preserved exactly (no data lost or invented).
// All statements are IF NOT EXISTS / guarded — safe to run repeatedly.
// ---------------------------------------------------------------------------
/** Split `total` across `n` buckets preserving the exact sum. */
function splitStockEvenly(total: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(total / n);
  let remainder = total - base * n;
  return Array.from({ length: n }, () => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return base + extra;
  });
}

const CATEGORY_SCHEMA_STATEMENTS = [
  `ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "description" text DEFAULT '' NOT NULL`,
  `ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "image" text DEFAULT '' NOT NULL`,
  `ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0 NOT NULL`,
  `ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "seo_title" text DEFAULT '' NOT NULL`,
  `ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "seo_description" text DEFAULT '' NOT NULL`,
  `ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "parent_id" integer`,
  `ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL`,
];

/**
 * Phase 6: additive, idempotent category schema upgrade. Existing category
 * rows keep working unchanged (new columns have safe defaults; parent_id
 * stays null = top-level, so no hierarchy is forced on existing data).
 */
export async function ensureCategorySchema(db: SeedDb): Promise<void> {
  for (const statement of CATEGORY_SCHEMA_STATEMENTS) {
    try {
      await db.execute(sql.raw(statement));
    } catch (err) {
      if (!isAlreadyExistsErr(err, collectErrCodes(err), collectErrMessages(err))) throw err;
    }
  }
  // Guard the parent reference for databases where it could not be added
  // with a constraint originally. Tolerated if it already exists.
  try {
    await db.execute(sql.raw(`
      ALTER TABLE "categories"
      ADD CONSTRAINT "categories_parent_id_fkey"
      FOREIGN KEY ("parent_id") REFERENCES "categories"("id")
      ON DELETE SET NULL
    `));
  } catch (err) {
    if (!isAlreadyExistsErr(err, collectErrCodes(err), collectErrMessages(err))) throw err;
  }
}


/** Collect error codes from an error's full cause chain. */
function collectErrCodes(err: unknown): string[] {
  const codes: string[] = [];
  let current: unknown = err;
  for (let depth = 0; current && depth < 5; depth += 1) {
    const e = current as { code?: unknown; cause?: unknown };
    if (typeof e.code === "string") codes.push(e.code);
    current = e.cause;
  }
  return codes;
}

/** Collect error messages from an error's full cause chain (lowercased). */
function collectErrMessages(err: unknown): string {
  const messages: string[] = [];
  let current: unknown = err;
  for (let depth = 0; current && depth < 5; depth += 1) {
    const e = current as { message?: unknown; cause?: unknown };
    if (typeof e.message === "string") messages.push(e.message.toLowerCase());
    current = e.cause;
  }
  return messages.join(" | ");
}

/**
 * Tolerate "object already exists" errors by SQLSTATE when available, with a
 * message fallback for drivers/bridges that strip the code (e.g. the local
 * PGlite test server).
 */
function isAlreadyExistsErr(err: unknown, codes: string[], messages: string): boolean {
  if (codes.some((c) => ["42P07", "42P16", "42710", "42701"].includes(c))) return true;
  return (
    messages.includes("already exists") &&
    /(table|index|column|constraint)/.test(messages)
  );
}

const ORDER_SCHEMA_STATEMENTS = [
  `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_status" text DEFAULT 'pending' NOT NULL`,
  `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_method" text DEFAULT 'cod' NOT NULL`,
  `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT '' NOT NULL`,
  `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "stock_restored" boolean DEFAULT false NOT NULL`,
  `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL`,
  `CREATE TABLE IF NOT EXISTS "order_notes" (
    "id" serial PRIMARY KEY NOT NULL,
    "order_id" integer NOT NULL REFERENCES "orders"("id") ON DELETE cascade,
    "author" text DEFAULT '' NOT NULL,
    "body" text NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "order_notes_order_id_idx" ON "order_notes" ("order_id")`,
  `CREATE TABLE IF NOT EXISTS "order_events" (
    "id" serial PRIMARY KEY NOT NULL,
    "order_id" integer NOT NULL REFERENCES "orders"("id") ON DELETE cascade,
    "kind" text DEFAULT 'status' NOT NULL,
    "from_value" text DEFAULT '' NOT NULL,
    "to_value" text DEFAULT '' NOT NULL,
    "actor" text DEFAULT '' NOT NULL,
    "note" text DEFAULT '' NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "order_events_order_id_idx" ON "order_events" ("order_id")`,
];

/**
 * Phase 7: additive, idempotent order-management schema upgrade. Existing
 * orders keep working unchanged: new columns have safe defaults (payment
 * pending / cod / totals untouched), so historical data is preserved.
 */
export async function ensureOrderSchema(db: SeedDb): Promise<void> {
  for (const statement of ORDER_SCHEMA_STATEMENTS) {
    try {
      await db.execute(sql.raw(statement));
    } catch (err) {
      if (!isAlreadyExistsErr(err, collectErrCodes(err), collectErrMessages(err))) throw err;
    }
  }
}

// ---------------- Phase 8: delivery & shipping schema ----------------------
// Additive, idempotent upgrade of delivery_zones (home/pickup methods per
// zone + metadata) and orders (immutable shipping snapshot + delivery
// status). All new columns have safe defaults, so existing zones and orders
// keep working unchanged.

const DELIVERY_SCHEMA_STATEMENTS = [
  `ALTER TABLE "delivery_zones" ADD COLUMN IF NOT EXISTS "slug" text DEFAULT '' NOT NULL`,
  `ALTER TABLE "delivery_zones" ADD COLUMN IF NOT EXISTS "city" text DEFAULT '' NOT NULL`,
  `ALTER TABLE "delivery_zones" ADD COLUMN IF NOT EXISTS "home_enabled" boolean DEFAULT true NOT NULL`,
  `ALTER TABLE "delivery_zones" ADD COLUMN IF NOT EXISTS "home_price" integer DEFAULT 0 NOT NULL`,
  `ALTER TABLE "delivery_zones" ADD COLUMN IF NOT EXISTS "home_estimated_time" text DEFAULT '' NOT NULL`,
  `ALTER TABLE "delivery_zones" ADD COLUMN IF NOT EXISTS "pickup_enabled" boolean DEFAULT false NOT NULL`,
  `ALTER TABLE "delivery_zones" ADD COLUMN IF NOT EXISTS "pickup_price" integer DEFAULT 0 NOT NULL`,
  `ALTER TABLE "delivery_zones" ADD COLUMN IF NOT EXISTS "pickup_estimated_time" text DEFAULT '' NOT NULL`,
  `ALTER TABLE "delivery_zones" ADD COLUMN IF NOT EXISTS "notes" text DEFAULT '' NOT NULL`,
  `ALTER TABLE "delivery_zones" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0 NOT NULL`,
  `ALTER TABLE "delivery_zones" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL`,
  `ALTER TABLE "delivery_zones" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL`,
  `CREATE INDEX IF NOT EXISTS "delivery_zones_enabled_sort_idx" ON "delivery_zones" ("enabled", "sort_order", "code")`,
  `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_method" text DEFAULT 'home' NOT NULL`,
  `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_zone_code" integer DEFAULT 0 NOT NULL`,
  `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_estimate" text DEFAULT '' NOT NULL`,
  `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_status" text DEFAULT 'not_ready' NOT NULL`,
];

/**
 * Phase 8: additive, idempotent delivery schema upgrade + one-shot backfill.
 *
 * The backfill runs EXACTLY ONCE per database (gated by a settings flag):
 * it copies the legacy single price/estimate into the home-delivery method
 * columns, derives a slug and sort order from the wilaya code, and leaves
 * pickup disabled until an admin configures it. Existing orders are never
 * touched — their shipping snapshots stay exactly as written.
 */
export async function ensureDeliverySchema(db: SeedDb): Promise<void> {
  for (const statement of DELIVERY_SCHEMA_STATEMENTS) {
    try {
      await db.execute(sql.raw(statement));
    } catch (err) {
      if (!isAlreadyExistsErr(err, collectErrCodes(err), collectErrMessages(err))) throw err;
    }
  }

  const BACKFILL_FLAG = "delivery.backfill.v1";
  const inserted = await db.execute(
    sql`INSERT INTO "settings" ("key", "value") VALUES (${BACKFILL_FLAG}, 'done')
        ON CONFLICT ("key") DO NOTHING`,
  );
  const alreadyDone = inserted.rowCount === 0;
  if (alreadyDone) return;

  // Only touch rows that were never configured with Phase 8 fields — an
  // admin-edited zone is never overwritten, even if this runs twice.
  await db.execute(sql`
    UPDATE "delivery_zones" SET
      "home_price" = "price",
      "home_estimated_time" = "estimated_time",
      "slug" = 'wilaya-' || "code",
      "sort_order" = "code"
    WHERE "home_price" = 0 AND "home_estimated_time" = '' AND "slug" = ''
  `);
  console.log("[bootstrap] delivery zones backfilled with Phase 8 methods.");
}

const PRODUCT_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "product_variants" (
    "id" serial PRIMARY KEY NOT NULL,
    "product_id" integer NOT NULL REFERENCES "products"("id") ON DELETE cascade,
    "size" text DEFAULT '' NOT NULL,
    "color" text DEFAULT '' NOT NULL,
    "sku" text DEFAULT '' NOT NULL,
    "stock" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "product_variants_product_size_color_uniq"
     ON "product_variants" ("product_id", "size", "color")`,
  `CREATE INDEX IF NOT EXISTS "product_variants_product_id_idx"
     ON "product_variants" ("product_id")`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sku" text DEFAULT '' NOT NULL`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active' NOT NULL`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0 NOT NULL`,
  // Self-heal drifted rows: the schema declares these NOT NULL with empty
  // defaults, so a NULL can only appear through out-of-band writes. Restore
  // the schema default instead of letting one bad row break feeds/pages.
  `UPDATE "products" SET
     "images" = COALESCE("images", '[]'::jsonb),
     "sizes" = COALESCE("sizes", '[]'::jsonb),
     "colors" = COALESCE("colors", '[]'::jsonb),
     "details" = COALESCE("details", '[]'::jsonb),
     "description" = COALESCE("description", ''),
     "tagline" = COALESCE("tagline", '')
   WHERE "images" IS NULL OR "sizes" IS NULL OR "colors" IS NULL
      OR "details" IS NULL OR "description" IS NULL OR "tagline" IS NULL`,
  `UPDATE "product_variants" SET
     "size" = COALESCE("size", ''),
     "color" = COALESCE("color", ''),
     "sku" = COALESCE("sku", '')
   WHERE "size" IS NULL OR "color" IS NULL OR "sku" IS NULL`,
];

/**
 * Backfill variants for products that predate Phase 5. Idempotent: only
 * products with ZERO variants are touched. The product's existing stock is
 * split across its generated variants so the sum is preserved exactly.
 */
async function backfillProductVariants(db: SeedDb): Promise<void> {
  const missing = await db.execute(
    sql.raw(`
      SELECT p.id, p.sizes, p.colors, p.stock
      FROM products p
      WHERE NOT EXISTS (
        SELECT 1 FROM product_variants v WHERE v.product_id = p.id
      )
      ORDER BY p.id
    `),
  );
  const rows = missing.rows as Array<{
    id: number;
    sizes: string[] | string | null;
    colors: string[] | string | null;
    stock: number | null;
  }>;
  for (const row of rows) {
    const sizes = Array.isArray(row.sizes) && row.sizes.length ? row.sizes : [""];
    const colors = Array.isArray(row.colors) && row.colors.length ? row.colors : [""];
    const total = Math.max(0, Math.floor(Number(row.stock) || 0));
    const combos = sizes.length * colors.length;
    const split = splitStockEvenly(total, combos);
    let i = 0;
    for (const size of sizes) {
      for (const color of colors) {
        await db.execute(sql.raw(`
          INSERT INTO product_variants (product_id, size, color, sku, stock, active, position)
          VALUES (${row.id}, '${String(size).replace(/'/g, "''")}', '${String(color).replace(/'/g, "''")}', '', ${split[i]}, true, ${i})
          ON CONFLICT DO NOTHING
        `));
        i += 1;
      }
    }
  }
  // Reconcile the status column for rows created before it existed:
  // inactive products become drafts; anything the admin already set stays.
  await db.execute(sql.raw(`
    UPDATE products SET status = 'draft'
    WHERE active = false AND status = 'active'
  `));
  if (rows.length) {
    console.log(`[bootstrap] backfilled variants for ${rows.length} products.`);
  }
}

export async function ensureProductSchema(db: SeedDb): Promise<void> {
  for (const statement of PRODUCT_SCHEMA_STATEMENTS) {
    try {
      await db.execute(sql.raw(statement));
    } catch (err) {
      if (!isAlreadyExistsErr(err, collectErrCodes(err), collectErrMessages(err))) throw err;
    }
  }
  // NOTE: deliberately NO product/variant reconciliation here. Schema
  // initialization must never mutate catalogue data — deleted products must
  // stay deleted. Variant backfill happens only inside the one-time
  // catalogue initialization (see bootstrapIfNeeded).
}

// ---------------------------------------------------------------------------
// One-time initialization marker (app_meta table).
//
// The demo catalogue must be seeded exactly once per database. After this
// marker exists, normal startup NEVER recreates missing products — a product
// an admin deleted stays deleted through refreshes, logouts, restarts,
// redeploys and storefront traffic.
// ---------------------------------------------------------------------------
const CATALOG_SEEDED_KEY = "catalogSeeded.v1";

async function getAppMeta(db: SeedDb, key: string): Promise<string> {
  const res = await db.execute(
    sql`SELECT "value" FROM "app_meta" WHERE "key" = ${key}`,
  );
  return String(res.rows[0]?.value ?? "");
}

async function setAppMeta(
  db: SeedDb,
  key: string,
  value: string,
): Promise<void> {
  await db.execute(sql`
    INSERT INTO "app_meta" ("key", "value", "updated_at")
    VALUES (${key}, ${value}, now())
    ON CONFLICT ("key")
    DO UPDATE SET "value" = EXCLUDED."value", "updated_at" = now()
  `);
}

export async function ensureCmsSchema(db: SeedDb): Promise<void> {
  for (const statement of CMS_SCHEMA_STATEMENTS) {
    try {
      await db.execute(sql.raw(statement));
    } catch (err) {
      // Concurrent instances may race on CREATE INDEX; treat "already exists"
      // as success (42P07 duplicate_table / 42P16 duplicate_object).
      if (!isAlreadyExistsErr(err, collectErrCodes(err), collectErrMessages(err))) throw err;
    }
  }
}

export async function ensureSchema(db: SeedDb): Promise<void> {
  // Fast path: if the products table already exists, assume the schema is in
  // place and skip the DDL (avoids ~10 round-trips on every cold start).
  const check = await db.execute(
    sql.raw(`SELECT to_regclass('public.products') IS NOT NULL AS exists`),
  );
  const alreadyExists = Boolean(
    (check.rows as { exists: boolean }[])[0]?.exists,
  );
  if (alreadyExists) return;

  for (const statement of SCHEMA_STATEMENTS) {
    await db.execute(sql.raw(statement));
  }
  for (const fk of FOREIGN_KEYS) {
    const existing = await db.execute(
      sql.raw(
        `SELECT 1 FROM pg_constraint WHERE conname = '${fk.name}' LIMIT 1`,
      ),
    );
    if (existing.rows.length === 0) {
      try {
        await db.execute(sql.raw(fk.statement));
      } catch (err) {
        // Another instance may have created the constraint concurrently.
        // drizzle wraps the driver error, so the SQLSTATE lives on `cause`.
        const e = err as { code?: string; cause?: { code?: string } };
        const code = e.code ?? e.cause?.code;
        if (code !== "42P07" && code !== "42710") throw err;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Seeding (products + reviews).
// - clear: true (default, used by the CLI script) wipes the catalogue first,
//   matching the original src/db/seed.ts behaviour.
// - clear: false (used by the startup bootstrap) is non-destructive and race
//   safe: products are upserted with ON CONFLICT DO NOTHING, so concurrent
//   instances converge on the full catalogue without deleting each other.
// ---------------------------------------------------------------------------
export async function seedCatalogue(
  db: SeedDb,
  opts: { clear?: boolean } = {},
): Promise<void> {
  const clear = opts.clear ?? true;

  if (clear) {
    console.log("Clearing existing catalogue...");
    await db.delete(reviews);
    await db.delete(orders);
    await db.delete(products);
  }

  console.log(`Seeding ${seedProducts.length} products...`);
  for (const p of seedProducts) {
    const values = {
      slug: p.slug,
      name: p.name,
      tagline: p.tagline,
      description: p.description,
      price: p.price,
      compareAtPrice: p.compareAtPrice ?? null,
      category: p.category,
      collection: p.collection,
      images: p.images,
      sizes: p.sizes,
      colors: p.colors,
      details: p.details,
      featured: p.featured ?? false,
      isNew: p.isNew ?? false,
      bestSeller: p.bestSeller ?? false,
      stock: p.stock ?? 60,
    };

    const inserted = clear
      ? await db.insert(products).values(values).returning()
      : await db
          .insert(products)
          .values(values)
          .onConflictDoNothing({ target: products.slug })
          .returning();

    // In non-destructive mode, onConflictDoNothing returns no rows for
    // products that already exist, so reviews are only added once per product.
    const newId = inserted[0]?.id;
    if (p.reviews.length && newId != null) {
      await db.insert(reviews).values(
        p.reviews.map((r) => ({
          productId: newId,
          author: r.author,
          rating: r.rating,
          title: r.title,
          body: r.body,
          verified: r.verified,
          createdAt: new Date(Date.now() - r.daysAgo * 24 * 60 * 60 * 1000),
        })),
      );
    }
  }

  const count = await db.$count(products);
  console.log(`Done. ${count} products in catalogue.`);
}

// ---------------------------------------------------------------------------
// Admin / reference data. Matches the original src/db/seed-admin.ts behaviour.
// Pass { reset: true } to restore the original overwrite semantics (used by
// the CLI script). The startup bootstrap uses the default non-destructive
// mode so re-deploys never clobber admin credentials or edited settings.
// ---------------------------------------------------------------------------
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

// Official wilaya delivery price list (business-mandated). Prices are WHOLE
// DZD (DA) and are stored exactly as listed — the Admin panel shows/edits
// the same numbers, and the storefront converts to cents at the quote
// boundary. `null` means the shipping method is not offered for that
// wilaya; wilayas with no price for either method are seeded as fully
// disabled. Tuple: [code, Arabic name, à domicile DA|null, STOP DESK DA|null].
const WILAYAS: [number, string, number | null, number | null][] = [
  [1, "أدرار", 1100, 600], [2, "الشلف", 700, 400], [3, "الأغواط", 900, 500],
  [4, "أم البواقي", 650, 400], [5, "باتنة", 700, 500], [6, "بجاية", 700, 400],
  [7, "بسكرة", 900, 500], [8, "بشار", 1100, 600], [9, "البليدة", 500, 250],
  [10, "البويرة", 700, 400], [11, "تمنراست", 1300, 600], [12, "تبسة", 700, 400],
  [13, "تلمسان", 800, 500], [14, "تيارت", 800, 400], [15, "تيزي وزو", 700, 400],
  [16, "الجزائر", 500, 250], [17, "الجلفة", 900, 500], [18, "جيجل", 600, 400],
  [19, "سطيف", 700, 400], [20, "سعيدة", 800, 400], [21, "سكيكدة", 600, 400],
  [22, "سيدي بلعباس", 700, 400], [23, "عنابة", 700, 400], [24, "قالمة", 600, 400],
  [25, "قسنطينة", 500, 350], [26, "المدية", 700, 400], [27, "مستغانم", 700, 400],
  [28, "المسيلة", 800, 500], [29, "معسكر", 700, 400], [30, "ورقلة", 900, 500],
  [31, "وهران", 800, 400], [32, "البيض", 800, 500], [33, "إليزي", 1300, 600],
  [34, "برج بوعريريج", 700, 400], [35, "بومرداس", 700, 400], [36, "الطارف", 700, 400],
  [37, "تندوف", 1300, 600], [38, "تيسمسيلت", 800, 400], [39, "الوادي", 900, 500],
  [40, "خنشلة", 700, 500], [41, "سوق أهراس", 700, 500], [42, "تيبازة", 700, 400],
  [43, "ميلة", 600, 400], [44, "عين الدفلى", 700, 400], [45, "النعامة", 800, 500],
  [46, "عين تموشنت", 800, 400], [47, "غرداية", 1000, 500], [48, "غليزان", 700, 400],
  [49, "تيميمون", 1100, 600], [50, "برج باجي مختار", null, null],
  [51, "أولاد جلال", 900, 500], [52, "بني عباس", 1100, null],
  [53, "عين صالح", 1300, 600], [54, "عين قزام", null, null],
  [55, "تقرت", 900, 500], [56, "جانت", 1100, null], [57, "المغير", 900, null],
  [58, "المنيعة", 1100, 500],
];

/**
 * Security hardening: server-side ownership of admin push devices.
 *
 * Self-contained, idempotent schema guarantee for the whole push subsystem
 * (device registry + notification log + `admin_id` ownership). Every consumer
 * (bootstrap AND the /api/admin/devices route AND the new-order fan-out)
 * calls this first, so a production database that never ran the global
 * bootstrap — or where an unrelated earlier migration statement failed —
 * still self-heals on the first push-related request.
 *
 * `admin_id` stores the admin account that registered the device. New
 * registrations always stamp the live session's admin id server-side.
 * Existing databases get a ONE-TIME backfill (marker-gated) attributing
 * pre-existing rows to the first admin account — safe because those rows
 * could only ever have been created through the authenticated +
 * CSRF-protected /api/admin/devices route.
 */
const ADMIN_DEVICE_OWNERSHIP_STATEMENTS = [
  // Full definition (incl. admin_id) for databases creating the table now.
  `CREATE TABLE IF NOT EXISTS "admin_devices" (
    "id" serial PRIMARY KEY NOT NULL,
    "provider" text DEFAULT 'fcm' NOT NULL,
    "token" text NOT NULL,
    "device_name" text DEFAULT '' NOT NULL,
    "admin_id" integer REFERENCES "admin_users"("id"),
    "created_at" timestamp DEFAULT now() NOT NULL,
    "last_seen_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "admin_devices_token_unique" UNIQUE("token")
  )`,
  // Legacy tables created before ownership existed gain the column.
  `ALTER TABLE "admin_devices" ADD COLUMN IF NOT EXISTS "admin_id" integer REFERENCES "admin_users"("id")`,
  `CREATE INDEX IF NOT EXISTS "admin_devices_admin_id_idx" ON "admin_devices" ("admin_id")`,
  // Notification log (dedup by (order, type) makes duplicates impossible).
  `CREATE TABLE IF NOT EXISTS "admin_notifications" (
    "id" serial PRIMARY KEY NOT NULL,
    "order_id" integer REFERENCES "orders"("id") ON DELETE cascade,
    "order_number" text DEFAULT '' NOT NULL,
    "type" text DEFAULT 'new_order' NOT NULL,
    "title" text DEFAULT '' NOT NULL,
    "body" text DEFAULT '' NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "admin_notifications_order_type_uniq"
    ON "admin_notifications" ("order_id", "type")`,
  `CREATE INDEX IF NOT EXISTS "admin_notifications_created_at_idx"
    ON "admin_notifications" ("created_at")`,
];

export async function ensureAdminDeviceOwnership(db: SeedDb): Promise<void> {
  for (const statement of ADMIN_DEVICE_OWNERSHIP_STATEMENTS) {
    try {
      await db.execute(sql.raw(statement));
    } catch (err) {
      if (!isAlreadyExistsErr(err, collectErrCodes(err), collectErrMessages(err))) throw err;
    }
  }

  const BACKFILL_FLAG = "adminDevices.ownership.v1";
  const inserted = await db.execute(
    sql`INSERT INTO "settings" ("key", "value") VALUES (${BACKFILL_FLAG}, 'done')
        ON CONFLICT ("key") DO NOTHING`,
  );
  if (inserted.rowCount === 0) return; // already backfilled

  // Attribute legacy ownerless rows to the first admin account (they were
  // necessarily registered by an authenticated admin via the protected API).
  await db.execute(sql`
    UPDATE "admin_devices" SET "admin_id" = (
      SELECT MIN("id") FROM "admin_users"
    )
    WHERE "admin_id" IS NULL
  `);
  console.log("[bootstrap] admin push devices backfilled with ownership.");
}

/** app_meta marker: the one-time official pricing sync already ran. */
export const DELIVERY_PRICING_SYNC_KEY = "deliveryPricing.official.v1";

/**
 * Build an insertable delivery-zone row from the official price table.
 * Zone prices are stored as WHOLE DZD (DA) — the exact numbers the Admin
 * Delivery panel displays and edits; the storefront converts to cents at
 * the quote boundary (see delivery-admin.ts).
 */
function zoneValuesFromOfficial(
  code: number,
  wilaya: string,
  homeDa: number | null,
  pickupDa: number | null,
) {
  const homePrice = homeDa === null ? 0 : homeDa;
  const pickupPrice = pickupDa === null ? 0 : pickupDa;
  return {
    code,
    wilaya: `${code} - ${wilaya}`,
    slug: `wilaya-${code}`,
    // Legacy single-price column: keep readable for old readers.
    price: homePrice || pickupPrice,
    estimatedTime: "2-4 أيام",
    homeEnabled: homeDa !== null,
    homePrice,
    homeEstimatedTime: homeDa === null ? "" : "2-4 أيام",
    pickupEnabled: pickupDa !== null,
    pickupPrice,
    pickupEstimatedTime: pickupDa === null ? "" : "2-4 أيام",
    sortOrder: code,
    // Wilayas with no offered method (e.g. 50, 54) are fully disabled.
    enabled: homeDa !== null || pickupDa !== null,
  };
}

/**
 * One-time official pricing sync for EXISTING databases.
 *
 * Fresh databases get the official prices directly from the seed loop
 * above; databases that were seeded with the older placeholder prices keep
 * them forever under `onConflictDoNothing` unless we sync once. This runs
 * exactly once per database (app_meta marker) and upserts the official
 * per-wilaya prices/availability by zone code. Admins can still customize
 * prices afterwards in the delivery admin — those edits are never touched
 * again because the marker prevents reruns.
 */
export async function syncOfficialDeliveryPricing(db: SeedDb): Promise<void> {
  const done = await getAppMeta(db, DELIVERY_PRICING_SYNC_KEY);
  if (done) return;

  for (const [code, wilaya, homeDa, pickupDa] of WILAYAS) {
    const zone = zoneValuesFromOfficial(code, wilaya, homeDa, pickupDa);
    await db
      .insert(deliveryZones)
      .values(zone)
      .onConflictDoUpdate({
        target: deliveryZones.code,
        set: {
          price: zone.price,
          estimatedTime: zone.estimatedTime,
          homeEnabled: zone.homeEnabled,
          homePrice: zone.homePrice,
          homeEstimatedTime: zone.homeEstimatedTime,
          pickupEnabled: zone.pickupEnabled,
          pickupPrice: zone.pickupPrice,
          pickupEstimatedTime: zone.pickupEstimatedTime,
          enabled: zone.enabled,
        },
      });
  }
  await setAppMeta(
    db,
    DELIVERY_PRICING_SYNC_KEY,
    JSON.stringify({ at: new Date().toISOString(), wilayas: WILAYAS.length }),
  );
  console.log(`[bootstrap] official delivery pricing synced (${WILAYAS.length} wilayas).`);
}

/** app_meta marker: the one-time zone-price unit normalization already ran. */
export const DELIVERY_UNITS_NORMALIZED_KEY = "deliveryPricing.unitsNormalized.v1";

/**
 * One-time unit normalization for delivery zone prices.
 *
 * History: an earlier revision of the official sync stored zone prices as
 * CENTS (value × 100) while the Admin Delivery panel always displayed and
 * accepted WHOLE DZD. Databases that ran that revision therefore carry
 * prices 100× larger than what Admin shows and than what customers must be
 * charged. The canonical stored unit is WHOLE DZD (matching the Admin
 * panel). Any stored price >= 10,000 can only be a legacy cents artifact —
 * the most expensive official home delivery is 1,300 DA, and no real
 * courier price in this store approaches 10,000 DA — so those values are
 * divided by 100 exactly once to restore the intended price. Values below
 * the cutoff are already whole DZD and are left untouched. Marker-gated,
 * idempotent, never reruns.
 */
export async function normalizeDeliveryZoneUnits(db: SeedDb): Promise<void> {
  const done = await getAppMeta(db, DELIVERY_UNITS_NORMALIZED_KEY);
  if (done) return;

  const result = await db.execute(sql`
    UPDATE "delivery_zones"
    SET
      "home_price"   = CASE WHEN "home_price"   >= 10000 THEN "home_price"   / 100 ELSE "home_price"   END,
      "pickup_price" = CASE WHEN "pickup_price" >= 10000 THEN "pickup_price" / 100 ELSE "pickup_price" END,
      "price"        = CASE WHEN "price"        >= 10000 THEN "price"        / 100 ELSE "price"        END
    WHERE "home_price" >= 10000 OR "pickup_price" >= 10000 OR "price" >= 10000
  `);
  await setAppMeta(
    db,
    DELIVERY_UNITS_NORMALIZED_KEY,
    JSON.stringify({ at: new Date().toISOString() }),
  );
  console.log(
    `[bootstrap] delivery zone price units normalized to whole DZD (rows touched: ${
      (result as { rowCount?: number | null }).rowCount ?? "?"
    }).`,
  );
}

/** app_meta marker: the DHT tariff enforcement already ran. */
export const DELIVERY_DHT_ENFORCED_KEY = "deliveryPricing.dhtEnforced.v1";

/**
 * One-time enforcement of the business-mandated DHT tariff table.
 *
 * The uploaded DHT tariff images are the ONLY source of truth for wilaya
 * delivery prices; they are already encoded verbatim in `WILAYAS` above
 * (verified programmatically against the exact 58-row list). This pass
 * re-applies those exact prices + availability to every zone code on
 * databases where an earlier sync stored legacy values (e.g. cents, or an
 * older placeholder table), so the Admin Delivery panel and the storefront
 * quote from the identical, correct table. Prices are written as whole DZD
 * (the canonical admin unit). Marker-gated and idempotent; admin edits
 * made AFTER this ran are respected because the marker prevents reruns.
 */
export async function enforceDhtDeliveryPricing(db: SeedDb): Promise<void> {
  const done = await getAppMeta(db, DELIVERY_DHT_ENFORCED_KEY);
  if (done) return;

  for (const [code, wilaya, homeDa, pickupDa] of WILAYAS) {
    const zone = zoneValuesFromOfficial(code, wilaya, homeDa, pickupDa);
    await db
      .insert(deliveryZones)
      .values(zone)
      .onConflictDoUpdate({
        target: deliveryZones.code,
        set: {
          price: zone.price,
          estimatedTime: zone.estimatedTime,
          homeEnabled: zone.homeEnabled,
          homePrice: zone.homePrice,
          homeEstimatedTime: zone.homeEstimatedTime,
          pickupEnabled: zone.pickupEnabled,
          pickupPrice: zone.pickupPrice,
          pickupEstimatedTime: zone.pickupEstimatedTime,
          enabled: zone.enabled,
        },
      });
  }
  await setAppMeta(
    db,
    DELIVERY_DHT_ENFORCED_KEY,
    JSON.stringify({ at: new Date().toISOString(), wilayas: WILAYAS.length }),
  );
  console.log(
    `[bootstrap] DHT tariff enforced for ${WILAYAS.length} wilayas (whole DZD).`,
  );
}

/** app_meta marker: the bureau-only free-shipping threshold already moved to 5000 DA. */
export const FREE_SHIP_BUREAU_5000_KEY = "freeShipping.bureauOnly5000.v1";

/**
 * One-time migration of the free-shipping threshold to the new business
 * rule: EXACTLY 5,000 DA, and it applies to STOP DESK / BUREAU only (see
 * quoteShipping). The old default was 15,000 DA and applied to every
 * method; that made real orders quote "Free" incorrectly. Existing stores
 * keep whatever value they have ONLY if it is already 5000; any other
 * stored value (including the legacy 15000 default) is corrected once.
 */
export async function migrateBureauFreeThreshold(db: SeedDb): Promise<void> {
  const done = await getAppMeta(db, FREE_SHIP_BUREAU_5000_KEY);
  if (done) return;

  await db.execute(sql`
    UPDATE "settings"
    SET "value" = '5000'
    WHERE "key" = 'freeShippingThreshold' AND "value" <> '5000'
  `);
  await setAppMeta(
    db,
    FREE_SHIP_BUREAU_5000_KEY,
    JSON.stringify({ at: new Date().toISOString(), thresholdDa: 5000 }),
  );
  console.log(
    "[bootstrap] free-shipping threshold set to 5,000 DA (bureau-only).",
  );
}

const DEFAULT_SETTINGS: Record<string, string> = {
  storeName: "RUVEN DEPT",
  contactEmail: "hello@ruvendept.dz",
  contactPhone: "+213 555 00 00 00",
  address: "Algiers, Algeria",
  freeShippingThreshold: "5000",
  currency: "دج",
  announcement: "Free shipping over $150",
  // --- Phase 3 (professional settings). Additive only: existing databases
  // keep their stored values; missing rows fall back to these defaults at
  // read time via src/lib/settings.ts anyway.
  checkoutEnabled: "true",
  codEnabled: "true",
  minOrderAmount: "0",
  requirePhone: "false",
  requireAddress: "true",
  seoTitle: "",
  seoDescription: "",
  seoKeywords: "",
  canonicalUrl: "",
  robotsIndex: "true",
  logoUrl: "",
  faviconUrl: "",
  ogImageUrl: "",
  instagramUrl: "",
  tiktokUrl: "",
  facebookUrl: "",
  metaPixelId: "",
  metaPixelEnabled: "false",
  pixelEventPageView: "true",
  pixelEventViewContent: "true",
  pixelEventAddToCart: "false",
  pixelEventInitiateCheckout: "true",
  pixelEventPurchase: "true",
  // --- Phase 4 (Meta Ads & Conversions). Additive only.
  metaCapiEnabled: "false",
  metaCapiAccessToken: "",
  metaCapiTestEventCode: "",
};

export async function seedAdminData(
  db: SeedDb,
  opts: { reset?: boolean } = {},
): Promise<void> {
  const reset = opts.reset ?? false;

  // --- admin user ---
  const username = (process.env.ADMIN_USERNAME ?? "admin").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "ruven2026";
  const adminValues = {
    username,
    passwordHash: hashPassword(password),
    displayName: "Store Admin",
  };
  if (reset) {
    await db
      .insert(adminUsers)
      .values(adminValues)
      .onConflictDoUpdate({
        target: adminUsers.username,
        set: { passwordHash: hashPassword(password) },
      });
  } else {
    await db
      .insert(adminUsers)
      .values(adminValues)
      .onConflictDoNothing({ target: adminUsers.username });
  }
  console.log(`Admin ready → username: "${username}"  password: "${password}"`);

  // --- categories from existing products ---
  const cats = await db
    .selectDistinct({ category: products.category })
    .from(products);
  for (const { category } of cats) {
    const slug = category
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");
    await db
      .insert(categories)
      .values({ name: category, slug })
      .onConflictDoNothing();
  }
  console.log(`Seeded ${cats.length} categories.`);

  // --- delivery zones (official per-wilaya pricing, stored in cents) ---
  for (const [code, wilaya, homeDa, pickupDa] of WILAYAS) {
    const zone = zoneValuesFromOfficial(code, wilaya, homeDa, pickupDa);
    if (reset) {
      await db
        .insert(deliveryZones)
        .values(zone)
        .onConflictDoUpdate({
          target: deliveryZones.code,
          set: zone,
        });
    } else {
      await db
        .insert(deliveryZones)
        .values(zone)
        .onConflictDoNothing({ target: deliveryZones.code });
    }
  }
  console.log(`Seeded ${WILAYAS.length} delivery zones.`);

  // --- default settings ---
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (reset) {
      await db
        .insert(settings)
        .values({ key, value })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: sql`excluded.value` },
        });
    } else {
      await db
        .insert(settings)
        .values({ key, value })
        .onConflictDoNothing({ target: settings.key });
    }
  }
  console.log("Seeded default settings.");
}

// ---------------------------------------------------------------------------
// Idempotent startup bootstrap: create the schema if needed, then fill any
// empty tables with the demo catalogue and admin reference data. Safe to run
// on every server start.
// ---------------------------------------------------------------------------
export async function bootstrapIfNeeded(db: SeedDb): Promise<void> {
  await ensureSchema(db);
  await ensureCmsSchema(db);
  await ensureProductSchema(db);
  await ensureCategorySchema(db);
  await ensureOrderSchema(db);
  await ensureDeliverySchema(db);
  await ensureAdminDeviceOwnership(db);

  // ---- One-time official delivery pricing sync -------------------------
  // Existing databases keep whatever prices they were seeded with unless
  // this runs; it applies the business-mandated wilaya price table exactly
  // once (idempotent marker in app_meta) and never again.
  await syncOfficialDeliveryPricing(db);

  // ---- One-time zone price unit normalization ---------------------------
  // Repairs databases where an older sync stored zone prices as cents
  // (×100): canonical storage is whole DZD, matching what the Admin
  // Delivery panel shows and edits. Idempotent, marker-gated.
  await normalizeDeliveryZoneUnits(db);

  // ---- One-time DHT tariff enforcement ----------------------------------
  // Re-applies the exact business-mandated 58-wilaya DHT table (whole DZD)
  // so Admin and the storefront always quote from it. Marker-gated.
  await enforceDhtDeliveryPricing(db);

  // ---- One-time free-shipping rule migration ----------------------------
  // Threshold becomes EXACTLY 5,000 DA and applies to bureau/stop-desk
  // only; home delivery always keeps its wilaya price. Marker-gated.
  await migrateBureauFreeThreshold(db);

  // ---- One-time catalogue initialization -------------------------------
  // The demo catalogue is seeded exactly once per database, ever — recorded
  // by a persistent marker in app_meta that survives restarts and redeploys.
  // After the marker exists, normal startup never recreates missing
  // products: no "count < N" top-ups, no per-slug resurrection. Deleting a
  // product is permanent.
  const catalogSeeded = await getAppMeta(db, CATALOG_SEEDED_KEY);
  if (!catalogSeeded) {
    const productCount = await db.$count(products);
    if (productCount === 0) {
      console.log("[bootstrap] empty catalogue — running one-time seed...");
      await seedCatalogue(db, { clear: false });
    } else {
      // Store already has real/admin-managed products (e.g. upgraded from a
      // version without the marker): adopt it as-is, seed nothing.
      console.log(
        `[bootstrap] catalogue already managed (${productCount} products) — marking initialized`,
      );
    }
    // One-time variant reconciliation for products that predate Phase 5.
    await backfillProductVariants(db);
    await setAppMeta(
      db,
      CATALOG_SEEDED_KEY,
      JSON.stringify({
        at: new Date().toISOString(),
        products: await db.$count(products),
      }),
    );
  }

  const adminCount = await db.$count(adminUsers);
  const hasCategories = (await db.$count(categories)) > 0;
  const hasZones = (await db.$count(deliveryZones)) > 0;
  const hasSettings = (await db.$count(settings)) > 0;

  if (adminCount === 0 || !hasCategories || !hasZones || !hasSettings) {
    console.log("[bootstrap] seeding admin reference data...");
    await seedAdminData(db, { reset: false });
  }
}
