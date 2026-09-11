import { db } from "@/db";
import { products, reviews } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const productId = Number(body.productId);
    const rating = Math.max(1, Math.min(5, Number(body.rating) || 5));
    const author = String(body.author ?? "").trim().slice(0, 60);
    const title = String(body.title ?? "").trim().slice(0, 120);
    const text = String(body.body ?? "").trim().slice(0, 2000);

    if (!productId || !author || !text) {
      return Response.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    const [product] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) {
      return Response.json(
        { ok: false, error: "Product not found" },
        { status: 404 },
      );
    }

    const [review] = await db
      .insert(reviews)
      .values({
        productId,
        rating,
        author,
        title,
        body: text,
        verified: false,
      })
      .returning();

    return Response.json({ ok: true, review }, { status: 201 });
  } catch (err) {
    console.error("POST /api/reviews failed:", err);
    return Response.json(
      { ok: false, error: "Server error" },
      { status: 500 },
    );
  }
}
