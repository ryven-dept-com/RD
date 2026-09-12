import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { isSafeImageUrl } from "@/lib/admin-product-input";

// ---------------------------------------------------------------------------
// Phase 6 — professional category management. Pure validation helpers are
// exported for unit testing; DB functions are server-only.
// ---------------------------------------------------------------------------

export type CategoryInput = {
  name: string;
  slug: string;
  description: string;
  image: string;
  active: boolean;
  sortOrder: number;
  seoTitle: string;
  seoDescription: string;
  parentId: number | null;
};

export type CategoryParseResult =
  | { ok: true; data: CategoryInput }
  | { ok: false; error: string };

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Same slug rules as products: lowercase alphanumerics joined by dashes. */
export function slugifyCategory(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const MAX_NAME = 80;
const MAX_DESCRIPTION = 1000;
const MAX_SEO_TITLE = 160;
const MAX_SEO_DESCRIPTION = 300;
const MAX_SORT = 1_000_000;

/**
 * Server-side validation for category create/update payloads. Every field is
 * validated; malformed input never reaches the database.
 */
export function parseCategoryInput(body: unknown): CategoryParseResult {
  const record = (body ?? {}) as Record<string, unknown>;

  const name = String(record.name ?? "").trim().slice(0, MAX_NAME);
  if (!name) return { ok: false, error: "Name is required" };

  // Slug: explicit value wins, otherwise derive from the name.
  const rawSlug = String(record.slug ?? "").trim();
  const slug = slugifyCategory(rawSlug || name);
  if (!slug || !SLUG_PATTERN.test(slug)) {
    return { ok: false, error: "Invalid slug — use lowercase letters, numbers and dashes" };
  }

  const description = String(record.description ?? "")
    .trim()
    .slice(0, MAX_DESCRIPTION);

  const image = String(record.image ?? "").trim();
  if (image && !isSafeImageUrl(image)) {
    return {
      ok: false,
      error: "Image must come from the media library (no arbitrary external URLs)",
    };
  }

  const sortOrderRaw = record.sortOrder;
  const sortOrder = Number(
    typeof sortOrderRaw === "string" && sortOrderRaw.trim() !== ""
      ? sortOrderRaw
      : sortOrderRaw ?? 0,
  );
  if (!Number.isFinite(sortOrder) || Math.floor(sortOrder) !== sortOrder) {
    return { ok: false, error: "Sort order must be a whole number" };
  }
  if (Math.abs(sortOrder) > MAX_SORT) {
    return { ok: false, error: "Sort order is out of range" };
  }

  const seoTitle = String(record.seoTitle ?? "").trim().slice(0, MAX_SEO_TITLE);
  const seoDescription = String(record.seoDescription ?? "")
    .trim()
    .slice(0, MAX_SEO_DESCRIPTION);

  const parentRaw = record.parentId;
  let parentId: number | null = null;
  if (parentRaw !== undefined && parentRaw !== null && parentRaw !== "") {
    const n = Number(parentRaw);
    if (!Number.isFinite(n) || n <= 0 || Math.floor(n) !== n) {
      return { ok: false, error: "Invalid parent category" };
    }
    parentId = Math.floor(n);
  }

  const active =
    record.active === undefined ? true : Boolean(record.active);

  return {
    ok: true,
    data: {
      name,
      slug,
      description,
      image,
      active,
      sortOrder: Math.floor(sortOrder),
      seoTitle,
      seoDescription,
      parentId,
    },
  };
}

/**
 * Pure cycle detection. `parents` maps category id → parent id (null for
 * top-level). Returns true when making `categoryId` a child of
 * `newParentId` would create a cycle (including self-parenting).
 */
export function wouldCreateCycle(
  parents: Map<number, number | null>,
  categoryId: number | null,
  newParentId: number | null,
): boolean {
  if (categoryId == null || newParentId == null) return false;
  if (categoryId === newParentId) return true;
  let cursor: number | null | undefined = newParentId;
  for (let depth = 0; depth < 64; depth += 1) {
    if (cursor == null) return false;
    if (cursor === categoryId) return true;
    cursor = parents.get(cursor);
    if (cursor === undefined) return false;
  }
  // Pathological depth — treat as unsafe.
  return true;
}

/** Load the full parent map (small table — one query). */
export async function getParentMap(
  excludeId?: number,
): Promise<Map<number, number | null>> {
  const rows = await db
    .select({ id: categories.id, parentId: categories.parentId })
    .from(categories);
  const map = new Map<number, number | null>();
  for (const r of rows) {
    if (excludeId !== undefined && r.id === excludeId) continue;
    map.set(r.id, r.parentId);
  }
  return map;
}

/** Product count per category name — one grouped query (no N+1). */
export async function getProductCountsByCategory(): Promise<Map<string, number>> {
  const rows = await db
    .select({
      category: products.category,
      count: sql<number>`count(*)::int`,
    })
    .from(products)
    .groupBy(products.category);
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.category, Number(r.count));
  return map;
}

/** Child-category count per parent id — one grouped query. */
export async function getChildCounts(): Promise<Map<number, number>> {
  const rows = await db
    .select({
      parentId: categories.parentId,
      count: sql<number>`count(*)::int`,
    })
    .from(categories)
    .where(sql`${categories.parentId} IS NOT NULL`)
    .groupBy(categories.parentId);
  const map = new Map<number, number>();
  for (const r of rows) {
    if (r.parentId != null) map.set(r.parentId, Number(r.count));
  }
  return map;
}

/**
 * Check name/slug uniqueness against the database. Returns an error string
 * or null when both are free.
 */
export async function findCategoryConflict(
  data: Pick<CategoryInput, "name" | "slug">,
  excludeId?: number,
): Promise<string | null> {
  const nameClash = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        sql`lower(${categories.name}) = lower(${data.name})`,
        excludeId !== undefined ? ne(categories.id, excludeId) : undefined,
      ),
    )
    .limit(1);
  if (nameClash.length) return `A category named "${data.name}" already exists`;

  const slugClash = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.slug, data.slug),
        excludeId !== undefined ? ne(categories.id, excludeId) : undefined,
      ),
    )
    .limit(1);
  if (slugClash.length) return `Slug "${data.slug}" is already in use`;

  return null;
}

/**
 * Validate a parent assignment: parent must exist, must not be the category
 * itself and must not create a circular relationship.
 */
export async function validateParent(
  categoryId: number | null,
  parentId: number | null,
): Promise<string | null> {
  if (parentId == null) return null;
  if (categoryId != null && parentId === categoryId) {
    return "A category cannot be its own parent";
  }
  const [parent] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.id, parentId))
    .limit(1);
  if (!parent) return "Parent category does not exist";

  const parents = await getParentMap();
  if (wouldCreateCycle(parents, categoryId, parentId)) {
    return "This would create a circular category relationship";
  }
  return null;
}
