import { getAllCategories } from "@/lib/admin-queries";
import { CategoriesManager } from "./categories-manager";

export const dynamic = "force-dynamic";

export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const cats = await getAllCategories();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Categories</h1>
        <p className="mt-1 text-sm text-slate-500">
          Organize your product catalogue
        </p>
      </div>
      <CategoriesManager
        categories={cats.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          active: c.active,
        }))}
      />
    </div>
  );
}
