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
  await backfillProductVariants(db);
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

const WILAYAS: [number, string, number][] = [
  [1, "أدرار", 800], [2, "الشلف", 600], [3, "الأغواط", 700], [4, "أم البواقي", 700],
  [5, "باتنة", 700], [6, "بجاية", 600], [7, "بسكرة", 700], [8, "بشار", 900],
  [9, "البليدة", 500], [10, "البويرة", 600], [11, "تمنراست", 1000], [12, "تبسة", 750],
  [13, "تلمسان", 700], [14, "تيارت", 650], [15, "تيزي وزو", 600], [16, "الجزائر", 400],
  [17, "الجلفة", 700], [18, "جيجل", 650], [19, "سطيف", 650], [20, "سعيدة", 700],
  [21, "سكيكدة", 650], [22, "سيدي بلعباس", 700], [23, "عنابة", 650], [24, "قالمة", 700],
  [25, "قسنطينة", 650], [26, "المدية", 600], [27, "مستغانم", 650], [28, "المسيلة", 700],
  [29, "معسكر", 700], [30, "ورقلة", 850], [31, "وهران", 600], [32, "البيض", 800],
  [33, "إليزي", 1000], [34, "برج بوعريريج", 650], [35, "بومرداس", 500], [36, "الطارف", 700],
  [37, "تندوف", 1000], [38, "تيسمسيلت", 700], [39, "الوادي", 800], [40, "خنشلة", 750],
  [41, "سوق أهراس", 750], [42, "تيبازة", 500], [43, "ميلة", 650], [44, "عين الدفلى", 600],
  [45, "النعامة", 850], [46, "عين تموشنت", 700], [47, "غرداية", 800], [48, "غليزان", 650],
  [49, "تيميمون", 900], [50, "برج باجي مختار", 1000], [51, "أولاد جلال", 750],
  [52, "بني عباس", 950], [53, "عين صالح", 1000], [54, "عين قزام", 1000],
  [55, "تقرت", 850], [56, "جانت", 1000], [57, "المغير", 800], [58, "المنيعة", 850],
];

const DEFAULT_SETTINGS: Record<string, string> = {
  storeName: "RUVEN DEPT",
  contactEmail: "hello@ruvendept.dz",
  contactPhone: "+213 555 00 00 00",
  address: "Algiers, Algeria",
  freeShippingThreshold: "15000",
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
  pixelEventAddToCart: "true",
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

  // --- delivery zones ---
  for (const [code, wilaya, price] of WILAYAS) {
    const zone = {
      code,
      wilaya: `${code} - ${wilaya}`,
      slug: `wilaya-${code}`,
      price,
      estimatedTime: "2-4 أيام",
      // Phase 8: home delivery inherits the legacy price on fresh databases.
      homeEnabled: true,
      homePrice: price,
      homeEstimatedTime: "2-4 أيام",
      sortOrder: code,
      enabled: true,
    };
    if (reset) {
      await db
        .insert(deliveryZones)
        .values(zone)
        .onConflictDoUpdate({
          target: deliveryZones.code,
          set: { wilaya: `${code} - ${wilaya}` },
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

  // Top the catalogue up to the full seed set (handles empty databases and
  // partial ones left by earlier concurrent/aborted seeding attempts).
  const productCount = await db.$count(products);
  if (productCount < seedProducts.length) {
    console.log(
      `[bootstrap] catalogue incomplete (${productCount}/${seedProducts.length}) — seeding...`,
    );
    await seedCatalogue(db, { clear: false });
  }

  // Idempotent: give any product still lacking variant rows a variant set
  // (covers freshly seeded catalogues on empty databases).
  await backfillProductVariants(db);

  const adminCount = await db.$count(adminUsers);
  const hasCategories = (await db.$count(categories)) > 0;
  const hasZones = (await db.$count(deliveryZones)) > 0;
  const hasSettings = (await db.$count(settings)) > 0;

  if (adminCount === 0 || !hasCategories || !hasZones || !hasSettings) {
    console.log("[bootstrap] seeding admin reference data...");
    await seedAdminData(db, { reset: false });
  }
}
