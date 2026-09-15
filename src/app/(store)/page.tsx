import { cookies } from "next/headers";
import {
  getFeaturedProducts,
  getNewProducts,
  getProductsByIds,
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
import type { HomePresentation } from "@/storefront/types";

export const dynamic = "force-dynamic";

/**
 * Homepage — data + locale resolution only. The ACTIVE THEME provides the
 * entire presentation (see src/storefront/themes/*), so the same catalog,
 * CMS content and business rules render as six genuinely different
 * storefronts.
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

  const [cms, store] = await Promise.all([
    getCmsData(),
    getStoreSettings().catch(() => null),
  ]);
  const iso = isoCurrencyCode(store?.currency ?? "دج");
  const fmt = (cents: number) => formatMoney(cents, locale, iso);
  const freeShipAmount = formatWholeMoney(
    store?.freeShippingThreshold ?? 5000,
    locale,
    iso,
  );

  // CMS-curated product lists fall back to the original flag-based queries
  // whenever they are empty or resolve to nothing, so the page never blanks.
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

  const { Home } = getStorefront(theme.id);
  return <Home data={presentation} tr={tr} fmt={fmt} />;
}
