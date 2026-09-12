import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { productVariants, products } from "@/db/schema";
import type { ProductVariant } from "@/db/schema";

// ---------------------------------------------------------------------------
// Phase 5 product management — validation + persistence helpers shared by the
// admin API. Pure helpers are exported for unit testing; DB functions are
// server-only.
// ---------------------------------------------------------------------------

export type VariantInput = {
  size: string;
  color: string;
  sku: string;
  stock: number;
  active: boolean;
};

export type VariantParseResult =
  | { ok: true; variants: VariantInput[] }
  | { ok: false; error: string };

const MAX_SIZE = 60;
const MAX_COLOR = 60;
const MAX_SKU = 64;
const MAX_VARIANTS = 200;

function cleanPart(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

/**
 * Validate a list of variants from an admin request. Rejects:
 * - duplicate size × color combinations
 * - negative or non-numeric stock
 * - oversized SKUs / options
 * - too many variants
 * An empty list is valid (a product may legitimately have no variants yet).
 */
export function parseVariantInputs(raw: unknown): VariantParseResult {
  if (raw === undefined || raw === null) return { ok: true, variants: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "Variants must be a list" };
  if (raw.length > MAX_VARIANTS) {
    return { ok: false, error: `Too many variants (max ${MAX_VARIANTS})` };
  }

  const seen = new Set<string>();
  const variants: VariantInput[] = [];

  for (let i = 0; i < raw.length; i += 1) {
    const entry = (raw[i] ?? {}) as Record<string, unknown>;
    const size = cleanPart(entry.size, MAX_SIZE);
    const color = cleanPart(entry.color, MAX_COLOR);
    const sku = cleanPart(entry.sku, MAX_SKU);

    const stockRaw = entry.stock;
    const stock = Number(
      typeof stockRaw === "string" && stockRaw.trim() !== "" ? stockRaw : stockRaw ?? 0,
    );
    if (!Number.isFinite(stock) || stock < 0 || Math.floor(stock) !== stock) {
      return {
        ok: false,
        error: `Variant ${i + 1}: stock must be a whole number of 0 or more`,
      };
    }

    const key = `${size.toLowerCase()}\u0000${color.toLowerCase()}`;
    if (seen.has(key)) {
      return {
        ok: false,
        error: `Duplicate variant: size "${size || "—"}" / color "${color || "—"}" appears more than once`,
      };
    }
    seen.add(key);

    variants.push({
      size,
      color,
      sku,
      stock: Math.floor(stock),
      active: entry.active === undefined ? true : Boolean(entry.active),
    });
  }

  return { ok: true, variants };
}

/** Split `total` across `n` buckets preserving the exact sum. */
export function splitStockEvenly(total: number, n: number): number[] {
  if (n <= 0) return [];
  const safe = Math.max(0, Math.floor(total));
  const base = Math.floor(safe / n);
  let remainder = safe - base * n;
  return Array.from({ length: n }, () => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return base + extra;
  });
}

/** Derive the denormalized size/color option lists from a variant set. */
export function variantOptionLists(variants: VariantInput[]): {
  sizes: string[];
  colors: string[];
} {
  const sizes: string[] = [];
  const colors: string[] = [];
  for (const v of variants) {
    if (v.size && !sizes.includes(v.size)) sizes.push(v.size);
    if (v.color && !colors.includes(v.color)) colors.push(v.color);
  }
  return { sizes, colors };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/**
 * Replace all variants of a product atomically, then re-sync the
 * product-level stock total and sold-out flag from the new variant set.
 */
export async function replaceProductVariants(
  productId: number,
  variants: VariantInput[],
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(productVariants).where(eq(productVariants.productId, productId));
    if (variants.length) {
      await tx.insert(productVariants).values(
        variants.map((v, i) => ({
          productId,
          size: v.size,
          color: v.color,
          sku: v.sku,
          stock: v.stock,
          active: v.active,
          position: i,
        })),
      );
    }
    await syncProductStockFlagsTx(tx, productId);
  });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Recompute products.stock (sum) and products.soldOut from variants. */
async function syncProductStockFlagsTx(tx: Tx, productId: number): Promise<void> {
  const [agg] = await tx
    .select({
      total: sql<number>`coalesce(sum(${productVariants.stock}), 0)::int`,
    })
    .from(productVariants)
    .where(eq(productVariants.productId, productId));
  const total = Number(agg?.total ?? 0);
  await tx
    .update(products)
    .set({ stock: total, soldOut: total <= 0 })
    .where(eq(products.id, productId));
}

export async function syncProductStockFlags(productId: number): Promise<void> {
  await db.transaction(async (tx) => {
    await syncProductStockFlagsTx(tx, productId);
  });
}

/** Ordered variants for a product (storefront + admin). */
export async function getVariantsForProduct(
  productId: number,
): Promise<ProductVariant[]> {
  return db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, productId))
    .orderBy(asc(productVariants.position), asc(productVariants.id));
}

/** Aggregate stock info for admin listing. */
export async function getVariantAggregates(): Promise<
  Map<number, { totalStock: number; variantCount: number; activeVariants: number }>
> {
  const rows = await db
    .select({
      productId: productVariants.productId,
      total: sql<number>`coalesce(sum(${productVariants.stock}), 0)::int`,
      count: sql<number>`count(*)::int`,
      activeCount: sql<number>`count(*) filter (where ${productVariants.active} = true)::int`,
    })
    .from(productVariants)
    .groupBy(productVariants.productId);
  const map = new Map<
    number,
    { totalStock: number; variantCount: number; activeVariants: number }
  >();
  for (const r of rows) {
    map.set(r.productId, {
      totalStock: Number(r.total),
      variantCount: Number(r.count),
      activeVariants: Number(r.activeCount),
    });
  }
  return map;
}

/**
 * Resolve a variant for checkout. Returns null when the product has
 * variants but none matches the requested size/color combination.
 * `hasVariants=false` signals a legacy product with no variant rows.
 */
export async function resolveVariantForCheckout(
  productId: number,
  size: string,
  color: string,
): Promise<{ hasVariants: boolean; variant: ProductVariant | null }> {
  const rows = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, productId))
    .limit(1);
  if (!rows.length) return { hasVariants: false, variant: null };

  const [match] = await db
    .select()
    .from(productVariants)
    .where(
      and(
        eq(productVariants.productId, productId),
        eq(productVariants.size, size),
        eq(productVariants.color, color),
      ),
    )
    .limit(1);
  return { hasVariants: true, variant: match ?? null };
}

/**
 * Atomically decrement variant stock. Returns false when insufficient stock
 * is available (nothing is changed in that case).
 */
export async function decrementVariantStock(
  variantId: number,
  quantity: number,
): Promise<boolean> {
  const updated = await db
    .update(productVariants)
    .set({ stock: sql`${productVariants.stock} - ${quantity}` })
    .where(
      and(
        eq(productVariants.id, variantId),
        sql`${productVariants.stock} >= ${quantity}`,
      ),
    )
    .returning({ id: productVariants.id });
  return updated.length > 0;
}
