import { db } from "@/db";
import { productVariants, products } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyRequest } from "@/lib/admin-auth";
import { searchProductsAdmin } from "@/lib/admin-queries";
import { parseProductInput } from "@/lib/admin-product-input";
import {
  parseVariantInputs,
  replaceProductVariants,
  splitStockEvenly,
  variantOptionLists,
} from "@/lib/product-admin";

export const dynamic = "force-dynamic";

/**
 * Create a product (Phase 5).
 * - Server-side validation for every field (auth + CSRF via verifyRequest).
 * - Slug must be unique — collisions are rejected (400), never renamed.
 * - Variants are validated (no duplicate size × color, non-negative stock).
 * - When no explicit variants are sent, they are generated from the
 *   size × color matrix with the initial stock split evenly (sum preserved).
 */
export async function POST(request: Request) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = parseProductInput(body);
    if (!parsed.ok) {
      return Response.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    const variantParse = parseVariantInputs(body.variants);
    if (!variantParse.ok) {
      return Response.json({ ok: false, error: variantParse.error }, { status: 400 });
    }
    let variants = variantParse.variants;

    const existing = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, parsed.data.slug))
      .limit(1);
    if (existing.length) {
      return Response.json(
        { ok: false, error: `Slug "${parsed.data.slug}" is already in use` },
        { status: 400 },
      );
    }

    // No explicit variants → derive them from the size × color matrix so the
    // product behaves exactly like the pre-Phase-5 catalogue.
    if (!variants.length && (parsed.data.sizes.length || parsed.data.colors.length)) {
      const sizes = parsed.data.sizes.length ? parsed.data.sizes : [""];
      const colors = parsed.data.colors.length ? parsed.data.colors : [""];
      const split = splitStockEvenly(parsed.data.stock, sizes.length * colors.length);
      let i = 0;
      variants = sizes.flatMap((size) =>
        colors.map((color) => ({
          size,
          color,
          sku: "",
          stock: split[i++],
          active: true,
        })),
      );
    }

    // Denormalized option lists always mirror the variant matrix.
    const options = variantOptionLists(variants);
    const data = {
      ...parsed.data,
      sizes: variants.length ? options.sizes : parsed.data.sizes,
      colors: variants.length ? options.colors : parsed.data.colors,
    };

    const createdId = await db.transaction(async (tx) => {
      const [created] = await tx.insert(products).values(data).returning({ id: products.id });
      if (variants.length) {
        await tx.insert(productVariants).values(
          variants.map((v, i) => ({
            productId: created.id,
            size: v.size,
            color: v.color,
            sku: v.sku,
            stock: v.stock,
            active: v.active,
            position: i,
          })),
        );
        // Stock total = sum of variants.
        const total = variants.reduce((sum, v) => sum + v.stock, 0);
        await tx
          .update(products)
          .set({ stock: total, soldOut: total <= 0 })
          .where(eq(products.id, created.id));
      }
      return created.id;
    });

    return Response.json({ ok: true, id: createdId }, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/products failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}

/**
 * Product list for the private mobile admin app (and any authenticated
 * client). Reuses the exact same server-side search used by the web admin
 * panel — auth + CSRF enforced, stock and variant aggregates come from the
 * real database. Read-only: no data is ever mutated here.
 */
export async function GET(request: Request) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? undefined;
    const products = await searchProductsAdmin({
      q: searchParams.get("q") ?? undefined,
      status:
        status === "draft" || status === "active" || status === "archived"
          ? status
          : undefined,
      category: searchParams.get("category") ?? undefined,
      sort: (searchParams.get("sort") as
        | "newest"
        | "oldest"
        | "name"
        | "stock-asc"
        | "stock-desc"
        | "manual"
        | undefined) ?? "newest",
    });
    return Response.json({ ok: true, products });
  } catch (err) {
    console.error("GET /api/admin/products failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
