import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { products, reviews, orders } from "./schema.ts";
import { seedProducts } from "../lib/seed-data.ts";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5432/app_db";

async function main() {
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  console.log("Clearing existing catalogue...");
  await db.delete(reviews);
  await db.delete(orders);
  await db.delete(products);

  console.log(`Seeding ${seedProducts.length} products...`);
  for (const p of seedProducts) {
    const [inserted] = await db
      .insert(products)
      .values({
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
      })
      .returning();

    if (p.reviews.length) {
      await db.insert(reviews).values(
        p.reviews.map((r) => ({
          productId: inserted.id,
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
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
