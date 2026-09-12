import { describe, expect, it } from "vitest";
import {
  parseVariantInputs,
  splitStockEvenly,
  variantOptionLists,
} from "./product-admin";

describe("splitStockEvenly", () => {
  it("preserves the exact sum across buckets", () => {
    for (const total of [0, 1, 7, 50, 101]) {
      for (const n of [1, 2, 3, 4, 8]) {
        const split = splitStockEvenly(total, n);
        expect(split).toHaveLength(n);
        expect(split.reduce((a, b) => a + b, 0)).toBe(total);
        split.forEach((s) => expect(s).toBeGreaterThanOrEqual(0));
      }
    }
  });

  it("distributes the remainder one unit at a time", () => {
    expect(splitStockEvenly(7, 3)).toEqual([3, 2, 2]);
    expect(splitStockEvenly(1, 3)).toEqual([1, 0, 0]);
  });

  it("handles zero/negative buckets gracefully", () => {
    expect(splitStockEvenly(10, 0)).toEqual([]);
    expect(splitStockEvenly(-5, 3)).toEqual([0, 0, 0]);
  });
});

describe("parseVariantInputs", () => {
  it("accepts an empty/missing list", () => {
    expect(parseVariantInputs(undefined)).toEqual({ ok: true, variants: [] });
    expect(parseVariantInputs([])).toEqual({ ok: true, variants: [] });
  });

  it("accepts valid variants and normalizes values", () => {
    const res = parseVariantInputs([
      { size: " M ", color: "Onyx", sku: "SKU-1", stock: "4", active: true },
      { size: "L", color: "Onyx", stock: 3 },
    ]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.variants[0]).toMatchObject({
      size: "M",
      color: "Onyx",
      sku: "SKU-1",
      stock: 4,
      active: true,
    });
    expect(res.variants[1]).toMatchObject({ stock: 3, active: true });
  });

  it("rejects duplicate size × color combinations (case-insensitive)", () => {
    const res = parseVariantInputs([
      { size: "M", color: "Onyx", stock: 1 },
      { size: "m", color: "onyx", stock: 2 },
    ]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Duplicate variant/i);
  });

  it("rejects negative stock", () => {
    const res = parseVariantInputs([{ size: "M", color: "A", stock: -1 }]);
    expect(res.ok).toBe(false);
  });

  it("rejects fractional stock", () => {
    const res = parseVariantInputs([{ size: "M", color: "A", stock: 1.5 }]);
    expect(res.ok).toBe(false);
  });

  it("rejects non-list input", () => {
    expect(parseVariantInputs({ size: "M" }).ok).toBe(false);
    expect(parseVariantInputs("nope").ok).toBe(false);
  });

  it("rejects too many variants", () => {
    const many = Array.from({ length: 201 }, (_, i) => ({
      size: `S${i}`,
      color: "C",
      stock: 0,
    }));
    const res = parseVariantInputs(many);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Too many variants/i);
  });
});

describe("variantOptionLists", () => {
  it("derives ordered unique sizes and colors", () => {
    const lists = variantOptionLists([
      { size: "L", color: "Bone", sku: "", stock: 1, active: true },
      { size: "M", color: "Onyx", sku: "", stock: 1, active: true },
      { size: "M", color: "Bone", sku: "", stock: 1, active: true },
    ]);
    expect(lists.sizes).toEqual(["L", "M"]);
    expect(lists.colors).toEqual(["Bone", "Onyx"]);
  });

  it("skips empty option values", () => {
    const lists = variantOptionLists([
      { size: "", color: "", sku: "", stock: 1, active: true },
    ]);
    expect(lists).toEqual({ sizes: [], colors: [] });
  });
});
