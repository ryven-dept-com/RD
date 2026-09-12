import { db } from "@/db";
import { categories } from "@/db/schema";
import { asc, sql } from "drizzle-orm";
import { verifyRequest } from "@/lib/admin-auth";
import {
  findCategoryConflict,
  getChildCounts,
  getProductCountsByCategory,
  parseCategoryInput,
  validateParent,
} from "@/lib/category-admin";

export const dynamic = "force-dynamic";

/**
 * List categories for the admin (Phase 6) — includes per-category product
 * counts and child counts computed with grouped queries (no N+1).
 */
export async function GET(request: Request) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim().toLowerCase() || "";
    const status = searchParams.get("status");

    const [rows, productCounts, childCounts] = await Promise.all([
      db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name)),
      getProductCountsByCategory(),
      getChildCounts(),
    ]);

    let list = rows.map((c) => ({
      ...c,
      productCount: productCounts.get(c.name) ?? 0,
      childCount: childCounts.get(c.id) ?? 0,
    }));
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q),
      );
    }
    if (status === "active") list = list.filter((c) => c.active);
    if (status === "inactive") list = list.filter((c) => !c.active);

    return Response.json({ ok: true, count: list.length, categories: list });
  } catch (err) {
    console.error("GET /api/admin/categories failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}

/**
 * Create a category (Phase 6). Server-side validation for every field:
 * name/slug uniqueness, slug format, parent existence + cycle check, safe
 * media URL, bounded SEO fields and sort order.
 */
export async function POST(request: Request) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = parseCategoryInput(body);
    if (!parsed.ok) {
      return Response.json({ ok: false, error: parsed.error }, { status: 400 });
    }
    const data = parsed.data;

    const conflict = await findCategoryConflict(data);
    if (conflict) {
      return Response.json({ ok: false, error: conflict }, { status: 409 });
    }

    const parentError = await validateParent(null, data.parentId);
    if (parentError) {
      return Response.json({ ok: false, error: parentError }, { status: 400 });
    }

    const [created] = await db
      .insert(categories)
      .values(data)
      .returning({ id: categories.id, slug: categories.slug });

    return Response.json({ ok: true, id: created.id, slug: created.slug }, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/categories failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
