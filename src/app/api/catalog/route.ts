import { db } from "@/db";
import { productVariants, products } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { getStoreSettings } from "@/lib/settings";
import { ensureSeeded } from "@/lib/queries";
import {
  buildCatalogRows,
  CATALOG_COLUMNS,
  feedCurrencyCode,
  toCsv,
  type CatalogProduct,
  type CatalogRow,
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
 * Robustness contract: this feed is consumed automatically by Meta, so it
 * must never fail wholesale. The schema is ensured first (self-healing,
 * like every other query path), one malformed product can only ever skip
 * itself, and a hard failure returns a machine-readable 503 with the real
 * error logged server-side — never an opaque 500 and never a secret.
 *
 * Register the URL of this endpoint in Commerce Manager as a scheduled
 * feed source.
 */
export async function GET(request: Request) {
  try {
    const origin = new URL(request.url).origin;

    // Same lazy schema-ensure + seed path every storefront query uses, so a
    // drifted/empty database heals before the feed reads it.
    await ensureSeeded();

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

    // One bad product row must never take down the whole feed — isolate
    // failures per product and keep serving the rest.
    const feedRows: CatalogRow[] = [];
    for (const p of rows as unknown as CatalogProduct[]) {
      try {
        feedRows.push(
          ...buildCatalogRows(
            { ...p, variants: variantsByProduct.get(p.id) },
            { origin, currencyCode, brand },
          ),
        );
      } catch (err) {
        console.error(`[catalog] skipping product ${p.id} (${p.slug}):`, err);
      }
    }

    const csv = toCsv(CATALOG_COLUMNS, feedRows);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'inline; filename="catalog.csv"',
        // Feed is dynamic but changes rarely — let Meta/CDNs cache briefly.
        "Cache-Control": "public, max-age=900, s-maxage=900",
      },
    });
  } catch (err) {
    // Log the real cause server-side (visible in the host's function logs);
    // respond with a clean, machine-readable error — no internals, no 500.
    console.error("[catalog] feed generation failed:", err);
    return Response.json(
      { ok: false, error: "catalog_unavailable" },
      { status: 503 },
    );
  }
}
