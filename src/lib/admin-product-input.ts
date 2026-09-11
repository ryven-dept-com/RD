export type ParsedProduct = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  price: number;
  compareAtPrice: number | null;
  category: string;
  collection: string;
  images: string[];
  sizes: string[];
  colors: string[];
  details: string[];
  featured: boolean;
  isNew: boolean;
  bestSeller: boolean;
  onSale: boolean;
  soldOut: boolean;
  active: boolean;
  stock: number;
};

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function toCents(value: unknown): number | null {
  if (value === "" || value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function toList(value: unknown, sep: "line" | "comma"): string[] {
  if (typeof value !== "string") return [];
  const parts = sep === "line" ? value.split("\n") : value.split(",");
  return parts.map((s) => s.trim()).filter(Boolean);
}

export type ParseResult =
  | { ok: true; data: ParsedProduct }
  | { ok: false; error: string };

export function parseProductInput(body: Record<string, unknown>): ParseResult {
  const name = String(body.name ?? "").trim();
  const category = String(body.category ?? "").trim();
  const price = toCents(body.price);

  if (!name) return { ok: false, error: "Name is required" };
  if (!category) return { ok: false, error: "Category is required" };
  if (price == null) return { ok: false, error: "A valid price is required" };

  const slugRaw = String(body.slug ?? "").trim();
  const slug = slugRaw ? slugify(slugRaw) : slugify(name);
  if (!slug) return { ok: false, error: "Could not generate a valid slug" };

  const stockN = Number(body.stock);
  const stock = Number.isFinite(stockN) && stockN >= 0 ? Math.floor(stockN) : 0;

  return {
    ok: true,
    data: {
      slug,
      name: name.slice(0, 160),
      tagline: String(body.tagline ?? "").trim().slice(0, 200),
      description: String(body.description ?? "").trim().slice(0, 4000),
      price,
      compareAtPrice: toCents(body.compareAtPrice),
      category: category.slice(0, 80),
      collection: String(body.collection ?? "").trim().slice(0, 80),
      images: toList(body.images, "line").slice(0, 12),
      sizes: toList(body.sizes, "comma").slice(0, 24),
      colors: toList(body.colors, "comma").slice(0, 24),
      details: toList(body.details, "line").slice(0, 24),
      featured: Boolean(body.featured),
      isNew: Boolean(body.isNew),
      bestSeller: Boolean(body.bestSeller),
      onSale: Boolean(body.onSale),
      soldOut: Boolean(body.soldOut),
      active: body.active === undefined ? true : Boolean(body.active),
      stock,
    },
  };
}
