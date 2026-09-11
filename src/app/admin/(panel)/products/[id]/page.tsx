import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllCategories, getProductByIdAdmin } from "@/lib/admin-queries";
import { ProductForm, type ProductFormData } from "../product-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Edit Product" };

const centsToStr = (c: number | null) =>
  c == null ? "" : (c / 100).toFixed(2);

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isFinite(productId)) notFound();

  const [product, cats] = await Promise.all([
    getProductByIdAdmin(productId),
    getAllCategories(),
  ]);
  if (!product) notFound();

  const initial: ProductFormData = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    tagline: product.tagline,
    description: product.description,
    price: centsToStr(product.price),
    compareAtPrice: centsToStr(product.compareAtPrice),
    category: product.category,
    collection: product.collection,
    stock: String(product.stock),
    images: product.images.join("\n"),
    sizes: product.sizes.join(", "),
    colors: product.colors.join(", "),
    details: product.details.join("\n"),
    featured: product.featured,
    isNew: product.isNew,
    bestSeller: product.bestSeller,
    onSale: product.onSale,
    soldOut: product.soldOut,
    active: product.active,
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/products"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Back to products
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          Edit: {product.name}
        </h1>
      </div>
      <ProductForm
        mode="edit"
        initial={initial}
        categories={cats.map((c) => c.name)}
      />
    </div>
  );
}
