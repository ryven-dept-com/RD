import { describe, expect, it } from "vitest";
import {
  parseCategoryInput,
  slugifyCategory,
  wouldCreateCycle,
} from "./category-admin";

describe("slugifyCategory", () => {
  it("lowercases and joins words with dashes", () => {
    expect(slugifyCategory("Winter Wear")).toBe("winter-wear");
    expect(slugifyCategory("  Hoodies & Tees ")).toBe("hoodies-tees");
  });
  it("strips apostrophes and invalid characters", () => {
    expect(slugifyCategory("Men's Caps")).toBe("mens-caps");
    expect(slugifyCategory("café_édité")).toBe("caf-dit");
  });
  it("caps length at 80", () => {
    expect(slugifyCategory("a".repeat(200)).length).toBeLessThanOrEqual(80);
  });
});

describe("parseCategoryInput", () => {
  it("accepts a minimal payload and derives the slug", () => {
    const res = parseCategoryInput({ name: "Accessories" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.slug).toBe("accessories");
    expect(res.data.active).toBe(true);
    expect(res.data.sortOrder).toBe(0);
    expect(res.data.parentId).toBeNull();
  });

  it("accepts full SEO/media fields", () => {
    const res = parseCategoryInput({
      name: "Hoodies",
      slug: "hoodies",
      description: "Heavyweight fleece",
      image: "/media/hoodies.jpg",
      active: false,
      sortOrder: "3",
      seoTitle: "Shop Hoodies",
      seoDescription: "The heaviest hoodies.",
      parentId: 2,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toMatchObject({
      slug: "hoodies",
      image: "/media/hoodies.jpg",
      active: false,
      sortOrder: 3,
      seoTitle: "Shop Hoodies",
      parentId: 2,
    });
  });

  it("rejects missing name", () => {
    expect(parseCategoryInput({}).ok).toBe(false);
    expect(parseCategoryInput({ name: "   " }).ok).toBe(false);
  });

  it("rejects invalid slugs", () => {
    const res = parseCategoryInput({ name: "X", slug: "Not A Slug!" });
    // slugify normalizes "Not A Slug!" to "not-a-slug" — valid after cleanup
    expect(res.ok).toBe(true);
    const raw = parseCategoryInput({ name: "X", slug: "---" });
    expect(raw.ok).toBe(false);
    if (!raw.ok) expect(raw.error).toMatch(/Invalid slug/i);
  });

  it("rejects fractional or out-of-range sort order", () => {
    expect(parseCategoryInput({ name: "A", sortOrder: 1.5 }).ok).toBe(false);
    expect(parseCategoryInput({ name: "A", sortOrder: 2_000_000 }).ok).toBe(false);
    expect(parseCategoryInput({ name: "A", sortOrder: "abc" }).ok).toBe(false);
  });

  it("rejects invalid parent ids", () => {
    expect(parseCategoryInput({ name: "A", parentId: -1 }).ok).toBe(false);
    expect(parseCategoryInput({ name: "A", parentId: 1.5 }).ok).toBe(false);
    expect(parseCategoryInput({ name: "A", parentId: "xx" }).ok).toBe(false);
  });

  it("rejects unsafe image URLs", () => {
    const res = parseCategoryInput({
      name: "A",
      image: "javascript:alert(1)",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/media library/i);
  });

  it("accepts safe internal and https images", () => {
    expect(parseCategoryInput({ name: "A", image: "/media/x.jpg" }).ok).toBe(true);
    expect(
      parseCategoryInput({ name: "A", image: "https://cdn.example/x.jpg" }).ok,
    ).toBe(true);
  });
});

describe("wouldCreateCycle", () => {
  // 1 ← 2 ← 3 (3's parent is 2, 2's parent is 1)
  const parents = new Map<number, number | null>([
    [1, null],
    [2, 1],
    [3, 2],
  ]);

  it("detects self-parenting", () => {
    expect(wouldCreateCycle(parents, 2, 2)).toBe(true);
  });

  it("detects assigning an ancestor as parent", () => {
    // Making 1 a child of 3 creates 1 ← 2 ← 3 ← 1
    expect(wouldCreateCycle(parents, 1, 3)).toBe(true);
  });

  it("allows valid moves", () => {
    expect(wouldCreateCycle(parents, 3, 1)).toBe(false); // 3 under 1 (already via 2, still fine)
    expect(wouldCreateCycle(parents, 3, null)).toBe(false); // to top level
    expect(wouldCreateCycle(parents, null, 3)).toBe(false); // new category
  });

  it("treats unknown chains as safe", () => {
    expect(wouldCreateCycle(new Map([[1, 99]]), 1, 2)).toBe(false);
  });
});
