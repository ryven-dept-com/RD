import { db } from "@/db";
import { productVariants, products } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { getStoreSettings } from "@/lib/settings";
import {
  buildCatalogRows,
  CATALOG_COLUMNS,
  feedCurrencyCode,
  toCsv,
  type CatalogProduct,
  type CatalogVariant,
} from "@/lib/catalog";

export const dynamic = "force-dynamic";

/**
 * Product catalog feed for Meta Commerce Manager (CSV).
 *
 * Public endpoint (Meta's ingestion servers fetch it), but it only exposes
 * public catalogue data — exactly what the storefront shows. Rows come from
 * the real products table; inactive products are excluded, out-of-stock
 * items are marked "out of stock" so availability stays accurate.
 *
 * Register the URL of this endpoint in Commerce Manager as a scheduled
 * feed source.
 */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  const [rows, variantRows, store] = await Promise.all([
    db
      .select()
      .from(products)
      .where(and(eq(products.active, true), eq(products.status, "active"))),
    db
      .select()
      .from(productVariants)
      .orderBy(asc(productVariants.position), asc(productVariants.id)),
    getStoreSettings().catch(() => null),
  ]);

  // Group real variant rows per product for variant-aware feed rows.
  const variantsByProduct = new Map<number, CatalogVariant[]>();
  for (const v of variantRows) {
    const list = variantsByProduct.get(v.productId) ?? [];
    list.push({
      id: v.id,
      size: v.size,
      color: v.color,
      sku: v.sku,
      stock: v.stock,
      active: v.active,
    });
    variantsByProduct.set(v.productId, list);
  }

  const currencyCode = feedCurrencyCode(store?.currency ?? "");
  const brand = store?.storeName || "RUVEN DEPT";

  const feedRows = (rows as unknown as CatalogProduct[]).flatMap((p) =>
    buildCatalogRows(
      { ...p, variants: variantsByProduct.get(p.id) },
      { origin, currencyCode, brand },
    ),
  );

  const csv = toCsv(CATALOG_COLUMNS, feedRows);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'inline; filename="catalog.csv"',
      // Feed is dynamic but changes rarely — let Meta/CDNs cache briefly.
      "Cache-Control": "public, max-age=900, s-maxage=900",
    },
  });
}
