import type { Metadata } from "next";
import Link from "next/link";
import {
  getProducts,
  getShopFilterOptions,
  type ProductFilters,
} from "@/lib/queries";
import { ProductCard } from "@/components/product-card";
import {
  DesktopFilters,
  MobileFilters,
  SearchBar,
  SortSelect,
} from "./shop-controls";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shop All",
  description:
    "Browse the full Ruven Dept. catalogue — heavyweight hoodies, tees, utility jackets, cargo pants, headwear and footwear.",
};

type SearchParams = Promise<{
  category?: string;
  collection?: string;
  filter?: string;
  sort?: string;
  q?: string;
  size?: string;
  color?: string;
  inStock?: string;
  maxPrice?: string;
}>;

const VALID_FILTERS = new Set(["new", "best", "sale"]);
const VALID_SORTS = new Set([
  "featured",
  "new",
  "price-asc",
  "price-desc",
  "rating",
]);

export default async function ShopPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  const maxPriceRaw = Number(sp.maxPrice);
  const filters: ProductFilters = {
    category: sp.category || undefined,
    collection: sp.collection || undefined,
    filter:
      sp.filter && VALID_FILTERS.has(sp.filter)
        ? (sp.filter as ProductFilters["filter"])
        : undefined,
    sort:
      sp.sort && VALID_SORTS.has(sp.sort)
        ? (sp.sort as ProductFilters["sort"])
        : undefined,
    q: sp.q?.trim() || undefined,
    size: sp.size?.trim() || undefined,
    color: sp.color?.trim() || undefined,
    inStock: sp.inStock === "1" ? true : undefined,
    maxPrice:
      Number.isFinite(maxPriceRaw) && maxPriceRaw > 0 ? maxPriceRaw : undefined,
  };

  const products = await getProducts(filters);
  const options = await getShopFilterOptions();

  const heading = filters.q
    ? `Search: “${filters.q}”`
    : filters.category
      ? filters.category
      : filters.collection
        ? filters.collection
        : filters.filter === "new"
          ? "New Arrivals"
          : filters.filter === "best"
            ? "Best Sellers"
            : filters.filter === "sale"
              ? "On Sale"
              : "Shop All";

  return (
    <div className="bg-bone pt-16">
      {/* header band */}
      <div className="border-b border-black/10 bg-brand-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <nav className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-black/40">
            <Link href="/" className="hover:text-ink">
              Home
            </Link>
            <span>/</span>
            <span className="text-ink">{heading}</span>
          </nav>
          <h1 className="font-display text-5xl uppercase tracking-tight sm:text-6xl">
            {heading}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-black/50">
            {products.length} {products.length === 1 ? "piece" : "pieces"} — heavyweight
            construction, refined fits, built to last.
          </p>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:px-8">
        <DesktopFilters options={options} />

        <div className="min-w-0 flex-1">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:flex-1">
              <MobileFilters options={options} />
              <SearchBar className="max-w-md flex-1" />
            </div>
            <SortSelect resultCount={products.length} />
          </div>

          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-black/15 py-24 text-center">
              <p className="font-display text-3xl uppercase tracking-wide">
                Nothing here yet
              </p>
              <p className="max-w-sm text-sm text-black/50">
                No products match these filters. Try clearing them to see the
                full range.
              </p>
              <Link
                href="/shop"
                className="rounded-full bg-ink px-6 py-3 text-xs font-semibold uppercase tracking-widest text-bone"
              >
                View all products
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3">
              {products.map((p, i) => (
                <ProductCard
                  key={p.slug}
                  product={p}
                  index={i}
                  priority={i < 3}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
