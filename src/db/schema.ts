import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";

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
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

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
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
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

export type OrderItem = {
  productId: number;
  slug: string;
  name: string;
  price: number;
  quantity: number;
  size: string;
  color: string;
  image: string;
};

export type Product = typeof products.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type AdminUser = typeof adminUsers.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type DeliveryZone = typeof deliveryZones.$inferSelect;
export type Setting = typeof settings.$inferSelect;

export const ORDER_STATUSES = [
  "جديد",
  "تم التأكيد",
  "قيد التحضير",
  "تم الشحن",
  "تم التسليم",
  "ملغى",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
