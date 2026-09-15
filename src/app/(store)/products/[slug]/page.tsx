import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getProductBySlug } from "@/lib/queries";
import { getStoreSettings } from "@/lib/settings";
import { resolveStorefrontTheme } from "@/lib/theme-server";
import { formatMoney, formatWholeMoney, isoCurrencyCode } from "@/lib/money";
import { LOCALE_COOKIE, resolveLocale, translate } from "@/i18n/translations";
import { getStorefront } from "@/storefront/registry";
import type { PdpPresentation } from "@/storefront/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const detail = await getProductBySlug(slug);
  if (!detail) return { title: "Product not found" };
  return {
    title: detail.product.name,
    description: detail.product.description.slice(0, 155),
    openGraph: {
      title: detail.product.name,
      images: detail.product.images.slice(0, 1),
    },
  };
}

/**
 * Product detail page — data + locale resolution only. The ACTIVE THEME
 * provides the complete PDP surface (gallery composition, info hierarchy,
 * purchase placement, reviews, related) while every business component
 * (gallery, purchase, review form, stock/variant logic, Meta ViewContent)
 * stays shared and untouched.
 */
export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // resolveStorefrontTheme() shares the memoized per-request settings read —
  // the PDP keeps its optimized query budget (no extra DB round-trips).
  const [detail, store, themeRes] = await Promise.all([
    getProductBySlug(slug),
    getStoreSettings().catch(() => null),
    resolveStorefrontTheme(),
  ]);
  if (!detail) notFound();

  let locale = resolveLocale(undefined);
  try {
    locale = resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  } catch {
    // default locale
  }
  const tr = (key: string, vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
  const iso = isoCurrencyCode(store?.currency ?? "");
  const fmt = (cents: number) => formatMoney(cents, locale, iso);

  const { product, reviews, avgRating, reviewCount, related } = detail;
  const onSale =
    product.compareAtPrice != null && product.compareAtPrice > product.price;
  const badge = product.isNew
    ? tr("product.new")
    : product.bestSeller
      ? tr("product.bestSeller")
      : onSale
        ? tr("product.sale")
        : null;

  const presentation: PdpPresentation = {
    product: {
      id: product.id,
      slug: product.slug,
      name: product.name,
      tagline: product.tagline,
      description: product.description,
      category: product.category,
      collection: product.collection,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      images: product.images,
      sizes: product.sizes,
      colors: product.colors,
      stock: product.stock,
      details: product.details ?? [],
    },
    variants: detail.variants,
    reviews,
    avgRating,
    reviewCount,
    related,
    badge,
    onSale,
    dist: [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: reviews.filter((r) => r.rating === star).length,
    })),
    freeShipAmount: formatWholeMoney(
      store?.freeShippingThreshold ?? 5000,
      locale,
      iso,
    ),
    locale,
  };

  const { Pdp } = getStorefront(themeRes.rendered.id);
  return <Pdp data={presentation} tr={tr} fmt={fmt} />;
}
