import { db } from "@/db";
import { products } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { verifyRequest } from "@/lib/admin-auth";
import { parseProductInput } from "@/lib/admin-product-input";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const productId = Number(id);
  if (!Number.isFinite(productId)) {
    return Response.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = parseProductInput(body);
    if (!parsed.ok) {
      return Response.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    // slug uniqueness (excluding this product)
    const clash = await db
      .select({ id: products.id })
      .from(products)
      .where(
        and(eq(products.slug, parsed.data.slug), ne(products.id, productId)),
      )
      .limit(1);
    if (clash.length) {
      parsed.data.slug = `${parsed.data.slug}-${Date.now().toString(36)}`;
    }

    const updated = await db
      .update(products)
      .set(parsed.data)
      .where(eq(products.id, productId))
      .returning({ id: products.id });

    if (!updated.length) {
      return Response.json(
        { ok: false, error: "Product not found" },
        { status: 404 },
      );
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/admin/products/[id] failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const productId = Number(id);
  if (!Number.isFinite(productId)) {
    return Response.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  try {
    await db.delete(products).where(eq(products.id, productId));
    return Response.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/products/[id] failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
