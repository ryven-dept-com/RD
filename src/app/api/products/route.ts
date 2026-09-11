import { getProducts, type ProductFilters } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters: ProductFilters = {
    category: searchParams.get("category") ?? undefined,
    collection: searchParams.get("collection") ?? undefined,
    filter: (searchParams.get("filter") as ProductFilters["filter"]) ?? undefined,
    sort: (searchParams.get("sort") as ProductFilters["sort"]) ?? undefined,
  };
  const products = await getProducts(filters);
  return Response.json({ ok: true, count: products.length, products });
}
