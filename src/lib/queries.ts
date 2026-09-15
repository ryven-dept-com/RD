import { db } from "@/db";
import {
  categories,
  productVariants,
  products,
  reviews,
  type Product,
  type ProductVariant,
  type Review,
} from "@/db/schema";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { memoizePerRequest } from "@/lib/cache";
import type { ProductCardData } from "@/components/product-card";

export type RatingMap = Map<number, { avg: number; count: number }>;

// Lazily ensure the schema exists and the catalogue is seeded on first use.
// This guarantees a freshly deployed, empty database is populated without
// relying on a manual seed step (or on the instrumentation hook timing).
let bootstrapPromise: Promise<void> | null = null;

export function ensureSeeded(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      try {
        const { bootstrapIfNeeded } = await import("@/lib/seed-db");
        await bootstrapIfNeeded(db);
      } catch (err) {
        // Allow a later request to retry if this attempt failed.
        bootstrapPromise = null;
        console.error("[queries] bootstrap failed:", err);
      }
    })();
  }
  return bootstrapPromise;
}

/**
 * Rating aggregates for every product. Memoized per request: listing pages
 * combine several card queries (featured / new / CMS lists) plus related
 * products, and each of them needs this map — within ONE server render it is
 * fetched once, never per caller.
 */
const getRatingMap = memoizePerRequest(async (): Promise<RatingMap> => {
  const rows = await db
    .select({
      productId: reviews.productId,
      avg: sql<string>`avg(${reviews.rating})`,
      count: sql<string>`count(*)`,
    })
    .from(reviews)
    .groupBy(reviews.productId);

  const map: RatingMap = new Map();
  for (const r of rows) {
    map.set(r.productId, {
      avg: Math.round(Number(r.avg) * 10) / 10,
      count: Number(r.count),
    });
  }
  return map;
});

export function toCardData(
  p: Product,
  rating?: { avg: number; count: number },
): ProductCardData {
  return {
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    category: p.category,
    images: p.images,
    colors: p.colors,
    isNew: p.isNew,
    bestSeller: p.bestSeller,
    soldOut: p.soldOut,
    avgRating: rating?.avg ?? 0,
    reviewCount: rating?.count ?? 0,
  };
}

/** Serializable variant shape for the storefront (no Date fields). */
export type StorefrontVariant = {
  id: number;
  size: string;
  color: string;
  sku: string;
  stock: number;
  active: boolean;
  position: number;
};

function toStorefrontVariant(v: ProductVariant): StorefrontVariant {
  return {
    id: v.id,
    size: v.size,
    color: v.color,
    sku: v.sku,
    stock: v.stock,
    active: v.active,
    position: v.position,
  };
}

/** Active variants of one product, ordered by position. */
export async function getProductVariants(
  productId: number,
): Promise<StorefrontVariant[]> {
  try {
    const rows = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, productId))
      .orderBy(asc(productVariants.position), asc(productVariants.id));
    return rows.filter((v) => v.active).map(toStorefrontVariant);
  } catch (err) {
    console.error("getProductVariants failed:", err);
    return [];
  }
}

/** Variants for a list of products (used to derive grid sizes per product). */
export async function getVariantsForProducts(
  productIds: number[],
): Promise<Map<number, StorefrontVariant[]>> {
  const map = new Map<number, StorefrontVariant[]>();
  if (!productIds.length) return map;
  try {
    const rows = await db
      .select()
      .from(productVariants)
      .where(inArray(productVariants.productId, productIds))
      .orderBy(asc(productVariants.position), asc(productVariants.id));
    for (const v of rows) {
      if (!v.active) continue;
      const list = map.get(v.productId) ?? [];
      list.push(toStorefrontVariant(v));
      map.set(v.productId, list);
    }
  } catch (err) {
    console.error("getVariantsForProducts failed:", err);
  }
  return map;
}

export type ProductFilters = {
  category?: string;
  collection?: string;
  filter?: "new" | "best" | "sale";
  sort?: "featured" | "new" | "price-asc" | "price-desc" | "rating";
  maxPrice?: number;
  /** Free-text search (name / tagline / category). */
  q?: string;
  /** Only products with an active variant of this size (in stock). */
  size?: string;
  /** Only products with an active variant of this color (in stock). */
  color?: string;
  /** Only products with stock available. */
  inStock?: boolean;
};

/** Distinct sizes/colors across all active variants — options for the shop filters. */
export async function getShopFilterOptions(): Promise<{
  sizes: string[];
  colors: string[];
  /** Distinct collections of ACTIVE products (Phase 6: no hardcoded list). */
  collections: string[];
}> {
  try {
    await ensureSeeded();
    const [variantRows, collectionRows] = await Promise.all([
      db
        .select({ size: productVariants.size, color: productVariants.color })
        .from(productVariants)
        .where(eq(productVariants.active, true)),
      db
        .selectDistinct({ collection: products.collection })
        .from(products)
        .where(and(eq(products.active, true), eq(products.status, "active"))),
    ]);
    const sizes: string[] = [];
    const colors: string[] = [];
    for (const r of variantRows) {
      if (r.size && !sizes.includes(r.size)) sizes.push(r.size);
      if (r.color && !colors.includes(r.color)) colors.push(r.color);
    }
    const collections = collectionRows
      .map((r) => r.collection)
      .filter((c) => c.trim().length > 0);
    return { sizes, colors, collections };
  } catch (err) {
    console.error("getShopFilterOptions failed:", err);
    return { sizes: [], colors: [], collections: [] };
  }
}

/** Serializable category shape for the storefront (Phase 6). */
export type StorefrontCategory = {
  id: number;
  name: string;
  slug: string;
  description: string;
  image: string;
  seoTitle: string;
  seoDescription: string;
  parentId: number | null;
  sortOrder: number;
};

/**
 * Active categories for the storefront (navigation + filters), ordered by
 * the admin-configured sort position. Disabled categories never reach the
 * public site. Memoized per request: the navbar, shop filters and category
 * landings all need it within one page load.
 */
async function loadStorefrontCategories(): Promise<StorefrontCategory[]> {
  try {
    await ensureSeeded();
    const rows = await db
      .select()
      .from(categories)
      .where(eq(categories.active, true))
      .orderBy(asc(categories.sortOrder), asc(categories.name));
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      image: c.image,
      seoTitle: c.seoTitle,
      seoDescription: c.seoDescription,
      parentId: c.parentId,
      sortOrder: c.sortOrder,
    }));
  } catch (err) {
    console.error("getStorefrontCategories failed:", err);
    return [];
  }
}

export const getStorefrontCategories = memoizePerRequest(loadStorefrontCategories);

/** Find one ACTIVE category by name or slug (case-insensitive on name). */
export async function getActiveCategoryByRef(
  ref: string,
): Promise<StorefrontCategory | null> {
  if (!ref) return null;
  const all = await getStorefrontCategories();
  const needle = ref.trim().toLowerCase();
  return (
    all.find(
      (c) => c.name.toLowerCase() === needle || c.slug === needle.toLowerCase(),
    ) ?? null
  );
}

export async function getProducts(
  filters: ProductFilters = {},
): Promise<ProductCardData[]> {
  try {
    await ensureSeeded();
    const conditions = [
      eq(products.active, true),
      eq(products.status, "active"), // Phase 5: drafts/archived stay hidden
    ];
    if (filters.category) conditions.push(eq(products.category, filters.category));
    if (filters.collection)
      conditions.push(eq(products.collection, filters.collection));
    if (filters.filter === "new") conditions.push(eq(products.isNew, true));
    if (filters.filter === "best")
      conditions.push(eq(products.bestSeller, true));

    let rows = await db
      .select()
      .from(products)
      .where(and(...conditions))
      .orderBy(asc(products.sortOrder), desc(products.createdAt));

    // Phase 5: free-text search
    if (filters.q) {
      const needle = filters.q.trim().toLowerCase();
      if (needle) {
        rows = rows.filter((p) =>
          [p.name, p.tagline, p.category, p.collection, p.sku]
            .some((field) => field.toLowerCase().includes(needle)),
        );
      }
    }

    // Phase 5: size/color filters match against real variant rows that
    // actually have stock (a size with zero stock doesn't match).
    if (filters.size || filters.color) {
      const variantMap = await getVariantsForProducts(rows.map((r) => r.id));
      rows = rows.filter((p) => {
        const vs = variantMap.get(p.id) ?? [];
        if (filters.size) {
          const has = vs.some(
            (v) => v.size.toLowerCase() === filters.size!.toLowerCase() && v.stock > 0,
          );
          if (!has) return false;
        }
        if (filters.color) {
          const has = vs.some(
            (v) => v.color.toLowerCase() === filters.color!.toLowerCase() && v.stock > 0,
          );
          if (!has) return false;
        }
        return true;
      });
    }

    // Phase 5: availability filter
    if (filters.inStock) {
      rows = rows.filter((p) => p.stock > 0 && !p.soldOut);
    }

    const ratingMap = await getRatingMap();
    let cards = rows.map((p) => toCardData(p, ratingMap.get(p.id)));

    if (filters.filter === "sale") {
      cards = cards.filter(
        (c) => c.compareAtPrice != null && c.compareAtPrice > c.price,
      );
    }
    if (typeof filters.maxPrice === "number") {
      cards = cards.filter((c) => c.price <= filters.maxPrice!);
    }

    // Sorting
    const rowOrder = new Map(rows.map((r, i) => [r.slug, i]));
    switch (filters.sort) {
      case "price-asc":
        cards.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        cards.sort((a, b) => b.price - a.price);
        break;
      case "rating":
        cards.sort((a, b) => b.avgRating - a.avgRating);
        break;
      case "new":
        cards.sort(
          (a, b) => Number(b.isNew) - Number(a.isNew),
        );
        break;
      default:
        // featured: bestsellers first, then new, then original order
        cards.sort((a, b) => {
          const score = (c: ProductCardData) =>
            (c.bestSeller ? 2 : 0) + (c.isNew ? 1 : 0);
          const diff = score(b) - score(a);
          if (diff !== 0) return diff;
          return (rowOrder.get(a.slug) ?? 0) - (rowOrder.get(b.slug) ?? 0);
        });
    }

    return cards;
  } catch (err) {
    console.error("getProducts failed:", err);
    return [];
  }
}

export async function getFeaturedProducts(
  limit = 8,
): Promise<ProductCardData[]> {
  try {
    await ensureSeeded();
    const rows = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.featured, true),
          eq(products.active, true),
          eq(products.status, "active"),
        ),
      )
      .orderBy(asc(products.sortOrder), desc(products.createdAt))
      .limit(limit);
    const ratingMap = await getRatingMap();
    return rows.map((p) => toCardData(p, ratingMap.get(p.id)));
  } catch (err) {
    console.error("getFeaturedProducts failed:", err);
    return [];
  }
}

export async function getNewProducts(limit = 4): Promise<ProductCardData[]> {
  try {
    await ensureSeeded();
    const rows = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.isNew, true),
          eq(products.active, true),
          eq(products.status, "active"),
        ),
      )
      .orderBy(asc(products.sortOrder), desc(products.createdAt))
      .limit(limit);
    const ratingMap = await getRatingMap();
    return rows.map((p) => toCardData(p, ratingMap.get(p.id)));
  } catch (err) {
    console.error("getNewProducts failed:", err);
    return [];
  }
}

/**
 * Resolve an ordered list of product ids (from the storefront CMS) to card
 * data. Inactive products are skipped; the requested order is preserved.
 */
export async function getProductsByIds(
  ids: number[],
): Promise<ProductCardData[]> {
  try {
    if (!ids.length) return [];
    await ensureSeeded();
    const rows = await db
      .select()
      .from(products)
      .where(
        and(
          inArray(products.id, ids),
          eq(products.active, true),
          eq(products.status, "active"),
        ),
      );
    const byId = new Map(rows.map((r) => [r.id, r]));
    const ordered = ids
      .map((id) => byId.get(id))
      .filter((p): p is Product => Boolean(p));
    const ratingMap = await getRatingMap();
    return ordered.map((p) => toCardData(p, ratingMap.get(p.id)));
  } catch (err) {
    console.error("getProductsByIds failed:", err);
    return [];
  }
}

export type ProductDetail = {
  product: Product;
  variants: StorefrontVariant[];
  reviews: Review[];
  avgRating: number;
  reviewCount: number;
  related: ProductCardData[];
};

/**
 * Full product detail for the PDP.
 *
 * Performance contract (mobile navigation):
 *  - Memoized per request: `generateMetadata` and the page component both
 *    call this during ONE server render, so the whole chain executes once —
 *    never twice.
 *  - After the product row resolves, variants / reviews / related products /
 *    rating aggregates run IN PARALLEL (one round-trip batch instead of four
 *    serial ones). On the remote production database this cuts the PDP
 *    server-render latency that mobile visitors wait on between the tap and
 *    the page appearing.
 *  - Still `force-dynamic` at the route level: no cross-request caching, so
 *    admin product edits are visible on the very next render.
 */
export const getProductBySlug = memoizePerRequest(
  async (slug: string): Promise<ProductDetail | null> => {
    try {
      await ensureSeeded();
      const [product] = await db
        .select()
        .from(products)
        .where(
          and(
            eq(products.slug, slug),
            eq(products.active, true),
            eq(products.status, "active"), // Phase 5: drafts/archived are hidden
          ),
        )
        .limit(1);
      if (!product) return null;

      const [variants, productReviews, relatedRows, ratingMap] =
        await Promise.all([
          getProductVariants(product.id),
          db
            .select()
            .from(reviews)
            .where(eq(reviews.productId, product.id))
            .orderBy(desc(reviews.createdAt)),
          db
            .select()
            .from(products)
            .where(
              and(
                eq(products.category, product.category),
                eq(products.active, true),
                eq(products.status, "active"),
              ),
            )
            .limit(5),
          getRatingMap(),
        ]);

      const avgRating = productReviews.length
        ? Math.round(
            (productReviews.reduce((a, r) => a + r.rating, 0) /
              productReviews.length) *
              10,
          ) / 10
        : 0;

      const related = relatedRows
        .filter((p) => p.id !== product.id)
        .slice(0, 4)
        .map((p) => toCardData(p, ratingMap.get(p.id)));

      return {
        product,
        variants,
        reviews: productReviews,
        avgRating,
        reviewCount: productReviews.length,
        related,
      };
    } catch (err) {
      console.error("getProductBySlug failed:", err);
      return null;
    }
  },
);

export async function getAllSlugs(): Promise<string[]> {
  try {
    await ensureSeeded();
    const rows = await db.select({ slug: products.slug }).from(products);
    return rows.map((r) => r.slug);
  } catch {
    return [];
  }
}
