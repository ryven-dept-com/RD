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
 * Meta requires an ISO-4217 currency code in feed prices. The store's
 * configured currency may be a symbol (دج) — fall back to DZD in that case.
 */
export function feedCurrencyCode(currency: string): string {
  const c = currency.trim();
  return /^[a-zA-Z]{3}$/.test(c) ? c.toUpperCase() : "DZD";
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

/** Build all feed rows for one product (one per size × color variant). */
export function buildCatalogRows(
  product: CatalogProduct,
  opts: { origin: string; currencyCode: string; brand: string },
): CatalogRow[] {
  const sizes = product.sizes.length ? product.sizes : [""];
  const colors = product.colors.length ? product.colors : [""];
  const currency = opts.currencyCode;

  const hasSale =
    product.onSale &&
    product.compareAtPrice != null &&
    product.compareAtPrice > product.price;

  const price = hasSale
    ? formatFeedPrice(product.compareAtPrice as number, currency)
    : formatFeedPrice(product.price, currency);
  const salePrice = hasSale ? formatFeedPrice(product.price, currency) : "";

  const availability =
    product.soldOut || product.stock <= 0 ? "out of stock" : "in stock";
  const imageLink = product.images[0]
    ? absoluteUrl(product.images[0], opts.origin)
    : "";

  const rows: CatalogRow[] = [];
  for (const size of sizes) {
    for (const color of colors) {
      const variantId =
        size || color
          ? `${product.slug}_${slugifyVariant(size)}_${slugifyVariant(color)}`
          : product.slug;
      rows.push({
        id: variantId,
        title: product.name,
        description: product.description.trim().slice(0, 5000),
        availability,
        condition: "new",
        price,
        sale_price: salePrice,
        link: `${opts.origin}/products/${product.slug}`,
        image_link: imageLink,
        brand: opts.brand,
        item_group_id: product.slug,
        color,
        size,
      });
    }
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
