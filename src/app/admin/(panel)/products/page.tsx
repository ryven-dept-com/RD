import Link from "next/link";
import { getAllProductsAdmin } from "@/lib/admin-queries";
import { ProductsTable } from "./products-table";

export const dynamic = "force-dynamic";

export const metadata = { title: "Products" };

export default async function AdminProductsPage() {
  const products = await getAllProductsAdmin();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products</h1>
          <p className="mt-1 text-sm text-slate-500">
            {products.length} products in catalogue
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
        >
          + Add Product
        </Link>
      </div>

      <ProductsTable
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          category: p.category,
          price: p.price,
          compareAtPrice: p.compareAtPrice,
          stock: p.stock,
          image: p.images[0] ?? "",
          isNew: p.isNew,
          onSale: p.onSale,
          featured: p.featured,
          soldOut: p.soldOut,
          active: p.active,
        }))}
      />
    </div>
  );
}
