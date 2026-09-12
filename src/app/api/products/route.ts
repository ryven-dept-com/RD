import { getProducts, type ProductFilters } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const maxPriceRaw = Number(searchParams.get("maxPrice"));
  const filters: ProductFilters = {
    category: searchParams.get("category") ?? undefined,
    collection: searchParams.get("collection") ?? undefined,
    filter: (searchParams.get("filter") as ProductFilters["filter"]) ?? undefined,
    sort: (searchParams.get("sort") as ProductFilters["sort"]) ?? undefined,
    // Phase 5 search/filter parity with the shop page.
    q: searchParams.get("q") ?? undefined,
    size: searchParams.get("size") ?? undefined,
    color: searchParams.get("color") ?? undefined,
    inStock: searchParams.get("inStock") === "1" ? true : undefined,
    maxPrice:
      Number.isFinite(maxPriceRaw) && maxPriceRaw > 0 ? maxPriceRaw : undefined,
  };
  const products = await getProducts(filters);
  return Response.json({ ok: true, count: products.length, products });
}
