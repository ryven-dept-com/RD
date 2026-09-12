import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; notNull: true; default: never }>({
  dataType() {
    return "bytea";
  },
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  tagline: text("tagline").notNull().default(""),
  description: text("description").notNull().default(""),
  price: integer("price").notNull(), // stored in cents
  compareAtPrice: integer("compare_at_price"), // cents, optional "was" price
  category: text("category").notNull(),
  collection: text("collection").notNull().default(""),
  images: jsonb("images").$type<string[]>().notNull().default([]),
  sizes: jsonb("sizes").$type<string[]>().notNull().default([]),
  colors: jsonb("colors").$type<string[]>().notNull().default([]),
  details: jsonb("details").$type<string[]>().notNull().default([]),
  featured: boolean("featured").notNull().default(false),
  isNew: boolean("is_new").notNull().default(false),
  bestSeller: boolean("best_seller").notNull().default(false),
  onSale: boolean("on_sale").notNull().default(false),
  soldOut: boolean("sold_out").notNull().default(false),
  active: boolean("active").notNull().default(true),
  stock: integer("stock").notNull().default(50),
  // ---- Phase 5 (product management). Additive columns.
  sku: text("sku").notNull().default(""),
  status: text("status").notNull().default("active"), // draft | active | archived
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  author: text("author").notNull(),
  rating: integer("rating").notNull(),
  title: text("title").notNull().default(""),
  body: text("body").notNull().default(""),
  verified: boolean("verified").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  email: text("email").notNull().default(""),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull().default(""),
  address: text("address").notNull(),
  city: text("city").notNull().default(""),
  postalCode: text("postal_code").notNull().default(""),
  country: text("country").notNull().default("الجزائر"),
  wilaya: text("wilaya").notNull().default(""),
  commune: text("commune").notNull().default(""),
  subtotal: integer("subtotal").notNull(),
  shipping: integer("shipping").notNull().default(0),
  deliveryPrice: integer("delivery_price").notNull().default(0),
  total: integer("total").notNull(),
  items: jsonb("items").$type<OrderItem[]>().notNull().default([]),
  status: text("status").notNull().default("جديد"),
  /** Phase 7: payment lifecycle (separate from fulfillment). */
  paymentStatus: text("payment_status").notNull().default("pending"),
  /** Phase 7: checkout is cash-on-delivery; stored per order as a snapshot. */
  paymentMethod: text("payment_method").notNull().default("cod"),
  /** Phase 7: currency snapshot ('' = fall back to the store currency). */
  currency: text("currency").notNull().default(""),
  /** Phase 7: true once a cancel/refund has restored stock (idempotency). */
  stockRestored: boolean("stock_restored").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------------- ORDER NOTES + AUDIT TRAIL (Phase 7) ----------------
// Internal admin notes, never exposed on public endpoints.
export const orderNotes = pgTable("order_notes", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  author: text("author").notNull().default(""),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Lightweight status/payment/stock history so admins can see what happened.
export const orderEvents = pgTable("order_events", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  kind: text("kind").notNull().default("status"), // status | payment | stock | note
  fromValue: text("from_value").notNull().default(""),
  toValue: text("to_value").notNull().default(""),
  actor: text("actor").notNull().default(""),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------- PRODUCT VARIANTS (Phase 5) ----------------
// One row per size × color combination. Unique per product so duplicate
// variants are impossible at the database level. `products.stock` remains
// the catalogue-level total and is kept in sync with the sum of variant
// stocks for backwards compatibility.
export const productVariants = pgTable(
  "product_variants",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    size: text("size").notNull().default(""),
    color: text("color").notNull().default(""),
    sku: text("sku").notNull().default(""),
    stock: integer("stock").notNull().default(0),
    active: boolean("active").notNull().default(true),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    {
      productSizeColorUnique: uniqueIndex("product_variants_product_size_color_uniq").on(
        t.productId,
        t.size,
        t.color,
      ),
      productIdIdx: index("product_variants_product_id_idx").on(t.productId),
    },
  ],
);

// ---------------- ADMIN / MANAGEMENT ----------------

export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull().default("Administrator"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const adminSessions = pgTable("admin_sessions", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  userId: integer("user_id")
    .notNull()
    .references(() => adminUsers.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  image: text("image").notNull().default(""),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  seoTitle: text("seo_title").notNull().default(""),
  seoDescription: text("seo_description").notNull().default(""),
  /** Optional parent for hierarchy; null = top-level. ON DELETE SET NULL. */
  parentId: integer("parent_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const deliveryZones = pgTable("delivery_zones", {
  id: serial("id").primaryKey(),
  code: integer("code").notNull().unique(), // wilaya number
  wilaya: text("wilaya").notNull(),
  price: integer("price").notNull().default(0), // in DZD
  estimatedTime: text("estimated_time").notNull().default("2-4 أيام"),
  enabled: boolean("enabled").notNull().default(true),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
});

// ---------------- STOREFRONT CMS (Phase 2) --------------------------------
// Block-based content store. Singleton sections (hero, brand story,
// announcement, newsletter, footer) use a single row; list sections
// (collections, featured products, new arrivals, promo banners) use one row
// per item ordered by `position`, with optional starts_at/ends_at scheduling.

export const cmsBlocks = pgTable(
  "cms_blocks",
  {
    id: serial("id").primaryKey(),
    type: text("type").notNull(),
    position: integer("position").notNull().default(0),
    enabled: boolean("enabled").notNull().default(true),
    startsAt: timestamp("starts_at"),
    endsAt: timestamp("ends_at"),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("cms_blocks_type_position_idx").on(t.type, t.position)],
);

export const CMS_BLOCK_TYPES = [
  "hero",
  "collection",
  "featured",
  "new_arrival",
  "brand_story",
  "promo",
  "announcement",
  "newsletter",
  "footer",
] as const;

export type CmsBlockType = (typeof CMS_BLOCK_TYPES)[number];

// Uploaded media (images / video / audio). Files are stored as BYTEA so they
// persist in the same production database as everything else — the project
// has no external object-storage service configured. Strict size limits are
// enforced at upload time (see /api/admin/media).

export const mediaFiles = pgTable(
  "media_files",
  {
    id: serial("id").primaryKey(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    kind: text("kind").notNull(), // image | video | audio
    size: integer("size").notNull().default(0),
    data: bytea("data").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("media_files_kind_idx").on(t.kind)],
);

export type OrderItem = {
  productId: number;
  slug: string;
  name: string;
  price: number;
  quantity: number;
  size: string;
  color: string;
  image: string;
  /** Phase 5: exact variant purchased (present when the product has variants). */
  variantId?: number;
  sku?: string;
};

export type Product = typeof products.$inferSelect;
export type ProductVariant = typeof productVariants.$inferSelect;
export const PRODUCT_STATUSES = ["draft", "active", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export type Review = typeof reviews.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderNote = typeof orderNotes.$inferSelect;
export type OrderEvent = typeof orderEvents.$inferSelect;
export type AdminUser = typeof adminUsers.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type DeliveryZone = typeof deliveryZones.$inferSelect;
export type Setting = typeof settings.$inferSelect;
export type CmsBlock = typeof cmsBlocks.$inferSelect;
export type MediaFile = typeof mediaFiles.$inferSelect;

export const ORDER_STATUSES = [
  "جديد",
  "تم التأكيد",
  "قيد التحضير",
  "تم الشحن",
  "تم التسليم",
  "ملغى",
  // Phase 7: refunded — reachable from delivered via the explicit refund flow.
  "مرجع",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Phase 7: payment lifecycle is separate from fulfillment status. */
export const PAYMENT_STATUSES = [
  "pending",
  "paid",
  "failed",
  "refunded",
  "partially_refunded",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
