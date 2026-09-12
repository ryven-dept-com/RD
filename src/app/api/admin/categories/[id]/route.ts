import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { verifyRequest } from "@/lib/admin-auth";
import {
  findCategoryConflict,
  getChildCounts,
  getProductCountsByCategory,
  parseCategoryInput,
  validateParent,
} from "@/lib/category-admin";

export const dynamic = "force-dynamic";

function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

async function getCategory(id: number) {
  const [row] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);
  return row ?? null;
}

/** Category detail + counts for the admin editor. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const catId = parseId(id);
  if (!catId) {
    return Response.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  const [category, productCounts, childCounts] = await Promise.all([
    getCategory(catId),
    getProductCountsByCategory(),
    getChildCounts(),
  ]);
  if (!category) {
    return Response.json({ ok: false, error: "Category not found" }, { status: 404 });
  }

  return Response.json({
    ok: true,
    category: {
      ...category,
      productCount: productCounts.get(category.name) ?? 0,
      childCount: childCounts.get(category.id) ?? 0,
    },
  });
}

/**
 * Update a category (Phase 6). Renaming a category re-points existing
 * products (products store the category NAME), so associations are never
 * silently lost. Slug/name uniqueness, parent validity and cycle protection
 * are enforced server-side.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const catId = parseId(id);
  if (!catId) {
    return Response.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = parseCategoryInput(body);
    if (!parsed.ok) {
      return Response.json({ ok: false, error: parsed.error }, { status: 400 });
    }
    const data = parsed.data;

    const existing = await getCategory(catId);
    if (!existing) {
      return Response.json({ ok: false, error: "Category not found" }, { status: 404 });
    }

    const conflict = await findCategoryConflict(data, catId);
    if (conflict) {
      return Response.json({ ok: false, error: conflict }, { status: 409 });
    }

    const parentError = await validateParent(catId, data.parentId);
    if (parentError) {
      return Response.json({ ok: false, error: parentError }, { status: 400 });
    }

    await db.transaction(async (tx) => {
      await tx
        .update(categories)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(categories.id, catId));

      // Keep product associations intact across renames.
      if (existing.name !== data.name) {
        await tx
          .update(products)
          .set({ category: data.name })
          .where(eq(products.category, existing.name));
      }
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/admin/categories/[id] failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}

/**
 * Safe category deletion (Phase 6).
 *
 * Deletion is BLOCKED (409) when products are assigned to the category or
 * when it has child categories — with a message explaining what must be
 * resolved. An explicit reassignment flow is available:
 *
 *   DELETE /api/admin/categories/5?reassignTo=2
 *
 * moves the category's products to the target category and re-parents its
 * children to the target's parent, so nothing is ever silently orphaned.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const catId = parseId(id);
  if (!catId) {
    return Response.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  try {
    const category = await getCategory(catId);
    if (!category) {
      return Response.json({ ok: false, error: "Category not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const reassignRaw = searchParams.get("reassignTo");
    const reassignTo = reassignRaw ? parseId(reassignRaw) : null;

    if (reassignRaw && reassignTo == null) {
      return Response.json(
        { ok: false, error: "Invalid reassignTo target" },
        { status: 400 },
      );
    }

    const [productCounts, childCounts] = await Promise.all([
      getProductCountsByCategory(),
      getChildCounts(),
    ]);
    const productCount = productCounts.get(category.name) ?? 0;
    const childCount = childCounts.get(catId) ?? 0;

    if (!reassignTo) {
      const blockers: string[] = [];
      if (productCount > 0) {
        blockers.push(
          `${productCount} product${productCount === 1 ? "" : "s"} assigned to it`,
        );
      }
      if (childCount > 0) {
        blockers.push(
          `${childCount} subcategor${childCount === 1 ? "y" : "ies"} under it`,
        );
      }
      if (blockers.length) {
        return Response.json(
          {
            ok: false,
            error: `Cannot delete "${category.name}": ${blockers.join(
              " and ",
            )}. Reassign them first or use the reassignment option.`,
            code: "CATEGORY_IN_USE",
            productCount,
            childCount,
          },
          { status: 409 },
        );
      }
      await db.delete(categories).where(eq(categories.id, catId));
      return Response.json({ ok: true });
    }

    // Explicit reassignment flow.
    const target = await getCategory(reassignTo);
    if (!target) {
      return Response.json(
        { ok: false, error: "Reassignment target category not found" },
        { status: 404 },
      );
    }
    if (target.id === catId) {
      return Response.json(
        { ok: false, error: "Cannot reassign a category to itself" },
        { status: 400 },
      );
    }

    await db.transaction(async (tx) => {
      if (productCount > 0) {
        await tx
          .update(products)
          .set({ category: target.name })
          .where(eq(products.category, category.name));
      }
      if (childCount > 0) {
        // Children move up to the deleted category's own parent.
        await tx
          .update(categories)
          .set({ parentId: category.parentId, updatedAt: new Date() })
          .where(eq(categories.parentId, catId));
      }
      await tx.delete(categories).where(eq(categories.id, catId));
    });

    return Response.json({ ok: true, reassignedTo: target.name });
  } catch (err) {
    console.error("DELETE /api/admin/categories/[id] failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
