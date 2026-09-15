import { cookies } from "next/headers";
import {
  getFeaturedProducts,
  getNewProducts,
  getProducts,
  getProductsByIds,
  getStorefrontCategories,
} from "@/lib/queries";
import {
  DEFAULT_COLLECTIONS,
  activeAnnouncement,
  activeBanners,
  getCmsData,
  marqueeItems,
} from "@/lib/cms";
import { LOCALE_COOKIE, resolveLocale, translate } from "@/i18n/translations";
import { getStoreSettings } from "@/lib/settings";
import { resolveStorefrontTheme } from "@/lib/theme-server";
import { formatMoney, formatWholeMoney, isoCurrencyCode } from "@/lib/money";
import { getStorefront } from "@/storefront/registry";
import type { CardProduct, HomePresentation } from "@/storefront/types";
import { getBuilderStore } from "@/lib/builder/storage";
import { BUILDER_PREVIEW_PARAM, getBuilderPreviewDoc } from "@/lib/builder/preview";
import type { BuilderDoc } from "@/lib/builder/types";
import { renderHome, type BuilderData } from "@/storefront/builder/render";

export const dynamic = "force-dynamic";

/**
 * Homepage — data + locale resolution only.
 *
 * Rendering priority:
 *   1. admin builder live-preview draft (token-gated, never leaked)
 *   2. PUBLISHED builder configuration (owner-controlled structure)
 *   3. the ACTIVE THEME's bespoke home (zero-config stores)
 *
 * The builder pipeline adds no business behavior: same loaders, same CMS,
 * same queries budget (settings read is shared/memoized).
 */
export default async function HomePage() {
  // Phase 9: visitor language from the rd-locale cookie.
  let locale = resolveLocale(undefined);
  try {
    locale = resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  } catch {
    // default locale
  }
  const tr = (key: string, vars?: Record<string, string | number>) =>
    translate(locale, key, vars);

  // Theme registry: resolves active theme / admin preview (memoized
  // settings read — no extra DB work).
  const { rendered: theme } = await resolveStorefrontTheme();

  const [cms, store, builderStore, previewParam] = await Promise.all([
    getCmsData(),
    getStoreSettings().catch(() => null),
    getBuilderStore(),
    (async () => {
      try {
        return (await cookies()).get(BUILDER_PREVIEW_PARAM)?.value ?? null;
      } catch {
        return null;
      }
    })(),
  ]);

  const iso = isoCurrencyCode(store?.currency ?? "دج");
  const fmt = (cents: number) => formatMoney(cents, locale, iso);
  const freeShipAmount = formatWholeMoney(
    store?.freeShippingThreshold ?? 5000,
    locale,
    iso,
  );

  const builderDoc: BuilderDoc | null =
    getBuilderPreviewDoc(previewParam ?? undefined) ?? builderStore.published;

  const [cmsFeatured, cmsNewArrivals] = await Promise.all([
    getProductsByIds(cms.featured.map((f) => f.productId)),
    getProductsByIds(cms.newArrivals.map((n) => n.productId)),
  ]);
  const [flagFeatured, flagNewArrivals] = await Promise.all([
    cmsFeatured.length ? [] : getFeaturedProducts(8),
    cmsNewArrivals.length ? [] : getNewProducts(4),
  ]);

  const announcement = cms.announcement;
  const activeAnn = activeAnnouncement(announcement);
  const enabledCollections = cms.collections.filter((c) => c.enabled);

  const presentation: HomePresentation = {
    hero: cms.hero,
    brandStory: cms.brandStory,
    banners: activeBanners(cms.banners),
    collections: enabledCollections.length ? enabledCollections : DEFAULT_COLLECTIONS,
    marquee: marqueeItems(announcement),
    announcementLink: activeAnn?.link ?? "",
    featured: cmsFeatured.length ? cmsFeatured : flagFeatured,
    newArrivals: cmsNewArrivals.length ? cmsNewArrivals : flagNewArrivals,
    freeShipAmount,
  };

  if (builderDoc) {
    const data = await buildBuilderData(builderDoc, presentation, store, tr, fmt, theme.id, cms.newsletter.title);
    return <>{renderHome(builderDoc, data)}</>;
  }

  const { Home } = getStorefront(theme.id);
  return <Home data={presentation} tr={tr} fmt={fmt} />;
}

/* ------------------------- builder data resolution ------------------------ */

async function buildBuilderData(
  doc: BuilderDoc,
  p: HomePresentation,
  store: Awaited<ReturnType<typeof getStoreSettings>> | null,
  tr: (k: string, v?: Record<string, string | number>) => string,
  fmt: (cents: number) => string,
  themeId: Parameters<typeof getStorefront>[0],
  newsletterTitle: string,
): Promise<BuilderData> {
  const sections = doc.home;
  const sources = new Map<string, number>();
  let spotlightSource = "";
  for (const s of sections) {
    if (!s.enabled) continue;
    if (["featured_products", "product_grid", "product_carousel", "new_arrivals", "best_sellers"].includes(s.type)) {
      const key = `${s.props.source}|${s.props.sort}`;
      sources.set(key, Math.max(sources.get(key) ?? 0, s.props.limit));
    }
    if (s.type === "product_spotlight") spotlightSource = s.props.source;
  }

  const cats = await getStorefrontCategories().catch(() => []);

  const fetchSource = async (src: string, limit: number): Promise<CardProduct[]> => {
    let list: CardProduct[] = [];
    if (src === "new") list = await getNewProducts(limit);
    else if (src === "best") list = (await getProducts({ filter: "best" })).slice(0, limit);
    else if (src.startsWith("category:")) list = (await getProducts({ category: src.slice(9).trim() })).slice(0, limit);
    else if (src.startsWith("collection:")) list = (await getProducts({ collection: src.slice(11).trim() })).slice(0, limit);
    else if (src.startsWith("ids:")) {
      const ids = src.slice(4).split(",").map((x) => Number(x.trim())).filter((n) => Number.isFinite(n) && n > 0);
      list = await getProductsByIds(ids);
    } else list = p.featured.slice(0, limit);
    const sort = src.includes("|") ? src.split("|")[1] : "default";
    if (sort === "newest") list = [...list].sort((a, b) => Number(b.isNew) - Number(a.isNew));
    if (sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
    if (sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
    return list;
  };

  const entries = await Promise.all(
    [...sources.entries()].map(async ([key, limit]) => {
      const [src] = key.split("|");
      const list = await fetchSource(key, limit);
      return [src, list] as const;
    }),
  );
  const products = new Map<string, CardProduct[]>(entries);
  if (!products.has("featured")) products.set("featured", p.featured);
  if (!products.has("new")) products.set("new", p.newArrivals);

  let spotlight: CardProduct | null = null;
  if (spotlightSource) {
    if (spotlightSource.startsWith("ids:")) {
      const id = Number(spotlightSource.slice(4).split(",")[0]);
      if (Number.isFinite(id)) spotlight = (await getProductsByIds([id]))[0] ?? null;
    } else if (spotlightSource.startsWith("slug:")) {
      const slug = spotlightSource.slice(5).trim();
      const all = await getProducts({});
      spotlight = all.find((x) => x.slug === slug) ?? null;
    }
  }

  return {
    themeId,
    tr,
    fmt,
    marquee: p.marquee,
    announcementLink: p.announcementLink,
    hero: {
      enabled: p.hero.enabled,
      eyebrow: p.hero.eyebrow,
      title: p.hero.title,
      subtitle: p.hero.subtitle,
      primaryText: p.hero.primaryText,
      primaryLink: p.hero.primaryLink,
      secondaryText: p.hero.secondaryText,
      secondaryLink: p.hero.secondaryLink,
      backgroundImage: p.hero.backgroundImage,
      backgroundImageMobile: p.hero.backgroundImageMobile,
    },
    brandStory: {
      enabled: p.brandStory.enabled,
      title: p.brandStory.title,
      description: p.brandStory.description,
      ctaText: p.brandStory.ctaText,
      ctaLink: p.brandStory.ctaLink,
      image: p.brandStory.image,
    },
    banners: p.banners.map((b, i) => ({ id: b.id ?? i, title: b.title, text: b.text, image: b.image, ctaLink: b.ctaLink })),
    collections: p.collections,
    categories: cats.map((c) => ({ name: c.name, image: c.image ?? "" })),
    newsletterTitle,
    socials: [
      store?.instagramUrl ? { label: "Instagram", url: store.instagramUrl } : null,
      store?.tiktokUrl ? { label: "TikTok", url: store.tiktokUrl } : null,
      store?.facebookUrl ? { label: "Facebook", url: store.facebookUrl } : null,
    ].filter(Boolean) as Array<{ label: string; url: string }>,
    products,
    spotlight,
  };
}
