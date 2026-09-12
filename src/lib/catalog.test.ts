import { describe, expect, it } from "vitest";
import {
  buildCatalogRows,
  CATALOG_COLUMNS,
  feedCurrencyCode,
  formatFeedPrice,
  toCsv,
  type CatalogProduct,
} from "./catalog";

const baseProduct: CatalogProduct = {
  id: 1,
  slug: "vault-heavyweight-hoodie-black",
  name: "Vault Heavyweight Hoodie",
  description: "Heavyweight fleece hoodie",
  price: 12550,
  compareAtPrice: null,
  images: ["/images/hero.jpg", "https://images.example/x.jpg"],
  sizes: ["S", "M"],
  colors: ["Black"],
  onSale: false,
  soldOut: false,
  active: true,
  stock: 50,
};

const opts = { origin: "https://shop.example", currencyCode: "DZD", brand: "RUVEN DEPT" };

describe("feedCurrencyCode", () => {
  it("keeps ISO-like codes and falls back to DZD for symbols", () => {
    expect(feedCurrencyCode("DZD")).toBe("DZD");
    expect(feedCurrencyCode("usd")).toBe("USD");
    expect(feedCurrencyCode("دج")).toBe("DZD");
    expect(feedCurrencyCode("")).toBe("DZD");
    expect(feedCurrencyCode("DA ")).toBe("DZD"); // two letters: not ISO
  });
});

describe("formatFeedPrice", () => {
  it("renders Meta's 'amount CODE' price format", () => {
    expect(formatFeedPrice(12550, "DZD")).toBe("125.50 DZD");
    expect(formatFeedPrice(995, "USD")).toBe("9.95 USD");
  });
});

describe("buildCatalogRows", () => {
  it("emits one row per size × color variant with stable ids", () => {
    const rows = buildCatalogRows(baseProduct, opts);
    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe("vault-heavyweight-hoodie-black_s_black");
    expect(rows[1].id).toBe("vault-heavyweight-hoodie-black_m_black");
    for (const row of rows) {
      expect(row.item_group_id).toBe(baseProduct.slug);
      expect(row.title).toBe(baseProduct.name);
      expect(row.availability).toBe("in stock");
      expect(row.condition).toBe("new");
      expect(row.link).toBe(
        "https://shop.example/products/vault-heavyweight-hoodie-black",
      );
      expect(row.image_link).toBe("https://shop.example/images/hero.jpg");
      expect(row.brand).toBe("RUVEN DEPT");
      expect(row.price).toBe("125.50 DZD");
      expect(row.sale_price).toBe("");
    }
  });

  it("marks sold-out and zero-stock products as out of stock", () => {
    const soldOut = buildCatalogRows({ ...baseProduct, soldOut: true }, opts);
    expect(soldOut[0].availability).toBe("out of stock");
    const noStock = buildCatalogRows({ ...baseProduct, stock: 0 }, opts);
    expect(noStock[0].availability).toBe("out of stock");
  });

  it("uses compare-at as price and real price as sale_price when on sale", () => {
    const rows = buildCatalogRows(
      { ...baseProduct, onSale: true, compareAtPrice: 15000 },
      opts,
    );
    expect(rows[0].price).toBe("150.00 DZD");
    expect(rows[0].sale_price).toBe("125.50 DZD");
  });

  it("handles products without variants as a single row", () => {
    const rows = buildCatalogRows({ ...baseProduct, sizes: [], colors: [] }, opts);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(baseProduct.slug);
    expect(rows[0].size).toBe("");
    expect(rows[0].color).toBe("");
  });

  it("keeps absolute image URLs untouched", () => {
    const rows = buildCatalogRows(
      { ...baseProduct, images: ["https://images.pexels.com/x.jpg"] },
      opts,
    );
    expect(rows[0].image_link).toBe("https://images.pexels.com/x.jpg");
  });
});

describe("buildCatalogRows — Phase 5 variant rows", () => {
  it("emits one row per real variant with per-variant availability", () => {
    const withVariants: CatalogProduct = {
      ...baseProduct,
      variants: [
        { id: 1, size: "S", color: "Black", sku: "V-S", stock: 4, active: true },
        { id: 2, size: "M", color: "Black", sku: "V-M", stock: 0, active: true },
        { id: 3, size: "L", color: "Black", sku: "V-L", stock: 2, active: false },
      ],
    };
    const rows = buildCatalogRows(withVariants, opts);
    // Inactive variant (L) is excluded entirely.
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.id)).toEqual([
      "vault-heavyweight-hoodie-black_s_black",
      "vault-heavyweight-hoodie-black_m_black",
    ]);
    expect(rows[0].availability).toBe("in stock");
    expect(rows[1].availability).toBe("out of stock");
  });

  it("keeps deterministic ids stable across the legacy and variant models", () => {
    const legacy = buildCatalogRows(baseProduct, opts).map((r) => r.id);
    const variantBacked = buildCatalogRows(
      {
        ...baseProduct,
        variants: [
          { id: 1, size: "S", color: "Black", sku: "", stock: 5, active: true },
          { id: 2, size: "M", color: "Black", sku: "", stock: 5, active: true },
        ],
      },
      opts,
    ).map((r) => r.id);
    // Same product, both models → identical feed item ids, so Commerce
    // Manager matches items instead of duplicating them.
    expect(variantBacked).toEqual(legacy);
  });
});

describe("toCsv", () => {
  it("writes the Meta header and escapes quotes/commas/newlines", () => {
    const row = buildCatalogRows(
      { ...baseProduct, description: 'Has "quotes", commas,\nand newlines' },
      opts,
    )[0];
    const csv = toCsv(CATALOG_COLUMNS, [row]);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe(CATALOG_COLUMNS.join(","));
    expect(lines[1]).toContain('"Has ""quotes"", commas, and newlines"');
    expect(lines[1].split(",").length).toBeGreaterThanOrEqual(
      CATALOG_COLUMNS.length,
    );
  });
});
