import { db } from "@/db";
import { products } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getStoreSettings } from "@/lib/settings";
import {
  buildCatalogRows,
  CATALOG_COLUMNS,
  feedCurrencyCode,
  toCsv,
  type CatalogProduct,
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

  const [rows, store] = await Promise.all([
    db.select().from(products).where(eq(products.active, true)),
    getStoreSettings().catch(() => null),
  ]);

  const currencyCode = feedCurrencyCode(store?.currency ?? "");
  const brand = store?.storeName || "RUVEN DEPT";

  const feedRows = (rows as unknown as CatalogProduct[]).flatMap((p) =>
    buildCatalogRows(p, { origin, currencyCode, brand }),
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
