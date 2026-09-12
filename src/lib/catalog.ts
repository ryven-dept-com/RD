/**
 * Meta Commerce Manager catalog feed (CSV).
 *
 * Pure builders so the feed format is unit-testable without a database or
 * HTTP layer. The route (/api/catalog) loads REAL products from the
 * database — this module never invents data.
 *
 * Columns follow Meta's product feed specification: id, title, description,
 * availability, condition, price, link, image_link, brand, plus variant
 * columns (item_group_id, color, size) and sale_price. One row is emitted
 * per size × color variant so Commerce Manager can create proper variant
 * groups.
 */

import { isoCurrencyCode } from "@/lib/money";

export type CatalogVariant = {
  id: number;
  size: string;
  color: string;
  sku: string;
  stock: number;
  active: boolean;
};

export type CatalogProduct = {
  id: number;
  slug: string;
  name: string;
  description: string;
  price: number; // cents
  compareAtPrice: number | null; // cents
  images: string[];
  sizes: string[];
  colors: string[];
  onSale: boolean;
  soldOut: boolean;
  active: boolean;
  stock: number;
  /** Phase 5: real variant rows. When present, one feed row per variant. */
  variants?: CatalogVariant[];
};

export const CATALOG_COLUMNS = [
  "id",
  "title",
  "description",
  "availability",
  "condition",
  "price",
  "sale_price",
  "link",
  "image_link",
  "brand",
  "item_group_id",
  "color",
  "size",
] as const;

/**
 * Meta requires an ISO-4217 currency code in feed prices. Delegates to the
 * centralized money module (Phase 9) so the catalog, Meta events and orders
 * all share one normalization rule.
 */
export function feedCurrencyCode(currency: string): string {
  return isoCurrencyCode(currency);
}

export function formatFeedPrice(cents: number, currencyCode: string): string {
  return `${(cents / 100).toFixed(2)} ${currencyCode}`;
}

function slugifyVariant(part: string): string {
  return part.trim().toLowerCase().replace(/\s+/g, "-") || "default";
}

function absoluteUrl(url: string, origin: string): string {
  if (!url) return "";
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `${origin}${url}`;
  return url;
}

export type CatalogRow = Record<string, string>;

/**
 * Build all feed rows for one product — one per variant.
 *
 * Phase 5: when the product has real variant rows they drive the feed
 * (per-variant availability from live stock). Feed item ids keep the same
 * deterministic `${slug}_${size}_${color}` format used before Phase 5, so
 * existing Commerce Manager items match instead of duplicating. Products
 * without variants fall back to the denormalized size × color matrix.
 */
export function buildCatalogRows(
  product: CatalogProduct,
  opts: { origin: string; currencyCode: string; brand: string },
): CatalogRow[] {
  const currency = opts.currencyCode;

  // Null-tolerant reads. The schema declares these NOT NULL with defaults,
  // but a feed consumed by Meta must never 500 because ONE drifted row
  // carries a NULL — coerce to the schema default instead.
  const description =
    typeof product.description === "string" ? product.description : "";
  const images = Array.isArray(product.images) ? product.images : [];
  const sizes = Array.isArray(product.sizes) ? product.sizes : [];
  const colors = Array.isArray(product.colors) ? product.colors : [];
  const priceCents = Number.isFinite(product.price) ? product.price : 0;
  const compareCents = Number.isFinite(product.compareAtPrice ?? Number.NaN)
    ? (product.compareAtPrice as number)
    : null;

  const hasSale =
    product.onSale && compareCents != null && compareCents > priceCents;

  const price = hasSale
    ? formatFeedPrice(compareCents as number, currency)
    : formatFeedPrice(priceCents, currency);
  const salePrice = hasSale ? formatFeedPrice(priceCents, currency) : "";

  const imageLink = images[0] ? absoluteUrl(images[0], opts.origin) : "";

  const activeVariants = (product.variants ?? []).filter((v) => v.active);
  const combinations: Array<{ size: string; color: string; inStock: boolean }> =
    activeVariants.length
      ? activeVariants.map((v) => ({
          size: typeof v.size === "string" ? v.size : "",
          color: typeof v.color === "string" ? v.color : "",
          inStock: v.stock > 0,
        }))
      : (sizes.length ? sizes : [""]).flatMap((size) =>
          (colors.length ? colors : [""]).map((color) => ({
            size,
            color,
            inStock: !product.soldOut && product.stock > 0,
          })),
        );

  const rows: CatalogRow[] = [];
  for (const combo of combinations) {
    const variantId =
      combo.size || combo.color
        ? `${product.slug}_${slugifyVariant(combo.size)}_${slugifyVariant(combo.color)}`
        : product.slug;
    rows.push({
      id: variantId,
      title: product.name,
      description: description.trim().slice(0, 5000),
      availability: combo.inStock ? "in stock" : "out of stock",
      condition: "new",
      price,
      sale_price: salePrice,
      link: `${opts.origin}/products/${product.slug}`,
      image_link: imageLink,
      brand: opts.brand,
      item_group_id: product.slug,
      color: combo.color,
      size: combo.size,
    });
  }
  return rows;
}

/** RFC-4180 CSV serialization (quotes/escapes embedded commas and quotes). */
export function toCsv(columns: readonly string[], rows: CatalogRow[]): string {
  const escape = (value: string): string => {
    const v = value.replace(/\r?\n/g, " ");
    return /[",]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => escape(row[c] ?? "")).join(","));
  }
  return `${lines.join("\n")}\n`;
}
