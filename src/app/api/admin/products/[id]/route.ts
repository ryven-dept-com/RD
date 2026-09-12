import { db } from "@/db";
import { products } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { verifyRequest } from "@/lib/admin-auth";
import { parseProductInput } from "@/lib/admin-product-input";
import {
  getVariantsForProduct,
  parseVariantInputs,
  replaceProductVariants,
  variantOptionLists,
} from "@/lib/product-admin";

export const dynamic = "force-dynamic";

function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Product + variants for the admin editor. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyRequest(_request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const productId = parseId(id);
  if (!productId) {
    return Response.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!product) {
    return Response.json({ ok: false, error: "Product not found" }, { status: 404 });
  }

  const variants = await getVariantsForProduct(productId);
  return Response.json({ ok: true, product, variants });
}

/**
 * Update a product (Phase 5). Full-product + full-variant-list semantics:
 * the variant array in the body becomes the product's exact variant set
 * (validated first — duplicates and negative stock are rejected). The
 * product-level stock total and sold-out flag are re-synced from the new
 * variants so legacy storefront/checkout code stays correct.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const productId = parseId(id);
  if (!productId) {
    return Response.json({ ok: false, error: "Invalid id" }, { status: 400 });
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
    const variants = variantParse.variants;

    // slug uniqueness (excluding this product) — reject, never auto-rename
    const clash = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.slug, parsed.data.slug), ne(products.id, productId)))
      .limit(1);
    if (clash.length) {
      return Response.json(
        { ok: false, error: `Slug "${parsed.data.slug}" is already in use` },
        { status: 400 },
      );
    }

    const exists = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    if (!exists.length) {
      return Response.json({ ok: false, error: "Product not found" }, { status: 404 });
    }

    const options = variantOptionLists(variants);
    const data = {
      ...parsed.data,
      sizes: variants.length ? options.sizes : parsed.data.sizes,
      colors: variants.length ? options.colors : parsed.data.colors,
    };

    await db.update(products).set(data).where(eq(products.id, productId));

    // Only touch variants when the client managed them explicitly; a missing
    // variants key (legacy callers) leaves the existing set intact.
    if (body.variants !== undefined) {
      await replaceProductVariants(productId, variants);
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/admin/products/[id] failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const productId = parseId(id);
  if (!productId) {
    return Response.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  try {
    // Variants cascade; reviews cascade. Past orders keep their denormalized
    // item snapshots, so order history stays intact.
    await db.delete(products).where(eq(products.id, productId));
    return Response.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/products/[id] failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
