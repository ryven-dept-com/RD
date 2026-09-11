import { db } from "@/db";
import { products } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyRequest } from "@/lib/admin-auth";
import { parseProductInput } from "@/lib/admin-product-input";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = parseProductInput(body);
    if (!parsed.ok) {
      return Response.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    // ensure unique slug
    const existing = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, parsed.data.slug))
      .limit(1);
    if (existing.length) {
      parsed.data.slug = `${parsed.data.slug}-${Date.now().toString(36)}`;
    }

    const [created] = await db
      .insert(products)
      .values(parsed.data)
      .returning({ id: products.id });

    return Response.json({ ok: true, id: created.id }, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/products failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
