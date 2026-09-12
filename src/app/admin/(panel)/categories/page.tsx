import { getCategoriesAdmin } from "@/lib/admin-queries";
import { CategoriesManager, type AdminCategory } from "./categories-manager";

export const dynamic = "force-dynamic";

export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const cats = await getCategoriesAdmin();

  const payload: AdminCategory[] = cats.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    image: c.image,
    active: c.active,
    sortOrder: c.sortOrder,
    seoTitle: c.seoTitle,
    seoDescription: c.seoDescription,
    parentId: c.parentId,
    productCount: c.productCount,
    childCount: c.childCount,
  }));

  const activeCount = payload.filter((c) => c.active).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Categories</h1>
        <p className="mt-1 text-sm text-slate-500">
          Organize your product catalogue — {payload.length} categories,{" "}
          {activeCount} active
        </p>
      </div>
      <CategoriesManager categories={payload} />
    </div>
  );
}
