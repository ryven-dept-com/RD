import Link from "next/link";
import { getAllCategories } from "@/lib/admin-queries";
import { EMPTY_PRODUCT, ProductForm } from "../product-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Add Product" };

export default async function NewProductPage() {
  const cats = await getAllCategories();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/products"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Back to products
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Add Product</h1>
      </div>
      <ProductForm
        mode="create"
        initial={EMPTY_PRODUCT}
        categories={cats.map((c) => c.name)}
      />
    </div>
  );
}
