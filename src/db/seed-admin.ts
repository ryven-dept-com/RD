import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { randomBytes, scryptSync } from "node:crypto";
import {
  adminUsers,
  categories,
  deliveryZones,
  settings,
  products,
} from "./schema.ts";
import { sql } from "drizzle-orm";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5432/app_db";

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

async function main() {
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  // --- admin user ---
  const username = (process.env.ADMIN_USERNAME ?? "admin").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "ruven2026";
  await db
    .insert(adminUsers)
    .values({
      username,
      passwordHash: hashPassword(password),
      displayName: "Store Admin",
    })
    .onConflictDoUpdate({
      target: adminUsers.username,
      set: { passwordHash: hashPassword(password) },
    });
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
    await db
      .insert(deliveryZones)
      .values({
        code,
        wilaya: `${code} - ${wilaya}`,
        price,
        estimatedTime: "2-4 أيام",
        enabled: true,
      })
      .onConflictDoUpdate({
        target: deliveryZones.code,
        set: { wilaya: `${code} - ${wilaya}` },
      });
  }
  console.log(`Seeded ${WILAYAS.length} delivery zones.`);

  // --- default settings ---
  const defaults: Record<string, string> = {
    storeName: "RUVEN DEPT",
    contactEmail: "hello@ruvendept.dz",
    contactPhone: "+213 555 00 00 00",
    address: "Algiers, Algeria",
    freeShippingThreshold: "15000",
    currency: "دج",
    announcement: "Free shipping over $150",
  };
  for (const [key, value] of Object.entries(defaults)) {
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value: sql`excluded.value` } });
  }
  console.log("Seeded default settings.");

  await pool.end();
  console.log("Admin seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
