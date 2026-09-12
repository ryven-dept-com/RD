import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import Link from "next/link";
import {
  getActiveCategoryByRef,
  getProducts,
  getShopFilterOptions,
  getStorefrontCategories,
  type ProductFilters,
} from "@/lib/queries";
import { ProductCard } from "@/components/product-card";
import {
  DesktopFilters,
  MobileFilters,
  SearchBar,
  SortSelect,
} from "./shop-controls";
import { LOCALE_COOKIE, resolveLocale, translate } from "@/i18n/translations";

export const dynamic = "force-dynamic";

const DEFAULT_SHOP_DESCRIPTION =
  "Browse the full Ruven Dept. catalogue — heavyweight hoodies, tees, utility jackets, cargo pants, headwear and footwear.";

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

/** Site origin for canonical URLs (proxied preview hosts included). */
async function siteOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

/**
 * Phase 6: category landing pages are SEO-ready. Title/description come from
 * the category's SEO fields (falling back to name/description); canonical
 * points at the stable /shop?category=… URL. Global robots/index settings
 * from the root layout still apply.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const sp = await searchParams;

  if (sp.category) {
    const category = await getActiveCategoryByRef(sp.category);
    if (category) {
      const canonical = `${await siteOrigin()}/shop?category=${encodeURIComponent(category.name)}`;
      return {
        title: category.seoTitle || category.name,
        description:
          category.seoDescription || category.description || DEFAULT_SHOP_DESCRIPTION,
        alternates: { canonical },
        openGraph: {
          title: category.seoTitle || category.name,
          description: category.seoDescription || category.description || undefined,
          ...(category.image ? { images: [category.image] } : {}),
        },
      };
    }
  }

  if (sp.q) {
    return { title: `Search: ${sp.q}` };
  }
  if (sp.collection) {
    return {
      title: sp.collection,
      description: DEFAULT_SHOP_DESCRIPTION,
    };
  }
  return { title: "Shop All", description: DEFAULT_SHOP_DESCRIPTION };
}

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

  const [products, filterOptions, dbCategories] = await Promise.all([
    getProducts(filters),
    getShopFilterOptions(),
    getStorefrontCategories(),
  ]);

  // Filters get ACTIVE database categories/collections — no hardcoded lists.
  const options = {
    ...filterOptions,
    categories: dbCategories.map((c) => c.name),
  };

  // The category landing text uses the real category record (Phase 6).
  const activeCategory = filters.category
    ? dbCategories.find(
        (c) => c.name.toLowerCase() === filters.category!.toLowerCase(),
      ) ?? null
    : null;

  // Phase 9: system headings follow the visitor's language; category and
  // collection names are admin DATA and stay exactly as stored.
  let locale = resolveLocale(undefined);
  try {
    locale = resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  } catch {
    // default locale
  }
  const tr = (key: string, vars?: Record<string, string | number>) =>
    translate(locale, key, vars);

  const heading = filters.q
    ? tr("shop.searchResults", { q: filters.q })
    : activeCategory
      ? activeCategory.name
      : filters.category
        ? filters.category
        : filters.collection
          ? filters.collection
          : filters.filter === "new"
            ? tr("shop.newArrivals")
            : filters.filter === "best"
              ? tr("shop.bestSellers")
              : filters.filter === "sale"
                ? tr("shop.onSale")
                : tr("nav.shopAll");

  return (
    <div className="bg-bone pt-16">
      {/* header band */}
      <div className="border-b border-black/10 bg-brand-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <nav className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-black/40">
            <Link href="/" className="hover:text-ink">
              {tr("shop.home")}
            </Link>
            <span>/</span>
            <span className="text-ink">{heading}</span>
          </nav>
          <h1 className="font-display text-5xl uppercase tracking-tight sm:text-6xl">
            {heading}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-black/50">
            {tr("shop.subtitle", { count: products.length })}
          </p>
          {activeCategory?.description && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-black/60">
              {activeCategory.description}
            </p>
          )}
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
                {tr("shop.nothingHere")}
              </p>
              <p className="max-w-sm text-sm text-black/50">
                {tr("shop.noResults")}
              </p>
              <Link
                href="/shop"
                className="rounded-full bg-ink px-6 py-3 text-xs font-semibold uppercase tracking-widest text-bone"
              >
                {tr("shop.viewAll")}
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
