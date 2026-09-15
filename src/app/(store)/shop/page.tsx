import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import {
  getActiveCategoryByRef,
  getProducts,
  getShopFilterOptions,
  getStorefrontCategories,
  type ProductFilters,
} from "@/lib/queries";
import { LOCALE_COOKIE, resolveLocale, translate } from "@/i18n/translations";
import { formatMoney, isoCurrencyCode } from "@/lib/money";
import { getStoreSettings } from "@/lib/settings";
import { resolveStorefrontTheme } from "@/lib/theme-server";
import { getStorefront } from "@/storefront/registry";
import type { ShopPresentation } from "@/storefront/types";

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

/**
 * Shop / collection / search results — data + filters only. The ACTIVE
 * THEME renders the surface (header, filter arrangement, grid structure).
 */
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

  const [products, filterOptions, dbCategories, themeRes, store] =
    await Promise.all([
      getProducts(filters),
      getShopFilterOptions(),
      getStorefrontCategories(),
      resolveStorefrontTheme(),
      getStoreSettings().catch(() => null),
    ]);

  // Filters get ACTIVE database categories/collections — no hardcoded lists.
  const options = {
    ...filterOptions,
    categories: dbCategories.map((c) => c.name),
  };

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
  const iso = isoCurrencyCode(store?.currency ?? "دج");
  const fmt = (cents: number) => formatMoney(cents, locale, iso);

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

  const presentation: ShopPresentation = {
    products,
    options,
    heading,
    categoryDescription: activeCategory?.description ?? "",
  };

  const { Shop } = getStorefront(themeRes.rendered.id);
  return <Shop data={presentation} tr={tr} fmt={fmt} />;
}
