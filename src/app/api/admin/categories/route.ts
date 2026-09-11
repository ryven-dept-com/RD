import { db } from "@/db";
import { categories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyRequest } from "@/lib/admin-auth";
import { slugify } from "@/lib/admin-product-input";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim().slice(0, 60);
    if (!name) {
      return Response.json({ ok: false, error: "Name is required" }, { status: 400 });
    }
    const slug = slugify(name);
    if (!slug) {
      return Response.json({ ok: false, error: "Invalid name" }, { status: 400 });
    }

    const existing = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, slug))
      .limit(1);
    if (existing.length) {
      return Response.json(
        { ok: false, error: "Category already exists" },
        { status: 409 },
      );
    }

    await db.insert(categories).values({ name, slug });
    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/categories failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
