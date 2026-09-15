import type { ReactNode } from "react";
import Link from "next/link";
import { CartProvider } from "@/context/cart-context";
import {
  DEFAULT_STORE_CONFIG,
  StoreConfigProvider,
  type StoreConfig,
} from "@/context/store-context";
import { MetaPixel } from "@/components/meta-pixel";
import { Navbar } from "@/components/navbar";
import { CartDrawer } from "@/components/cart-drawer";
import {
  DEFAULT_FOOTER,
  DEFAULT_NEWSLETTER,
  getCmsData,
} from "@/lib/cms";
import { getStoreSettings } from "@/lib/settings";
import { resolveStorefrontTheme } from "@/lib/theme-server";
import { getStorefront } from "@/storefront/registry";
import { PreviewBridge } from "@/storefront/preview-bridge";
import type { FooterStrings } from "@/storefront/types";
import {
  cssVarsToBlock,
  customizationToCssVars,
  isEmptyCustomization,
  type ThemeCustomizationMap,
} from "@/themes/customize";
import { LOCALE_COOKIE, resolveLocale, translate } from "@/i18n/translations";
import { cookies } from "next/headers";
import "../theme.css";

/**
 * Render one storefront's saved customization as scoped CSS. Pure server
 * component — no JS reaches the client. Values were sanitized at write time
 * (whitelisted font ids + validated hex colors) and only ever touch
 * presentation tokens, never data.
 */
function ThemeOverrideStyle({
  themeId,
  customization,
}: {
  themeId: string;
  customization: ThemeCustomizationMap[keyof ThemeCustomizationMap];
}) {
  if (isEmptyCustomization(customization)) return null;
  const vars = customizationToCssVars(customization);
  const mainBlock = cssVarsToBlock(`[data-theme="${themeId}"]`, vars);
  // Keep the browser's overscroll/rubber-band area in sync with a custom bg.
  const bg = customization?.colors?.bg;
  const bodyBlock = bg
    ? `body:has([data-theme="${themeId}"]) { background-color: ${bg}; }`
    : "";
  const css = [mainBlock, bodyBlock].filter(Boolean).join("\n");
  if (!css) return null;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

export default async function StoreLayout({
  children,
}: {
  children: ReactNode;
}) {
  // CMS content + admin settings for the chrome (footer, navbar, checkout
  // rules, pixel). Safe fallbacks keep the layout rendering even if the
  // database is momentarily unavailable.
  let footerContent = DEFAULT_FOOTER;
  let newsletterContent = DEFAULT_NEWSLETTER;
  let contact = { email: "", phone: "", address: "" };
  let config: StoreConfig = DEFAULT_STORE_CONFIG;
  let socialLinks = DEFAULT_FOOTER.socialLinks;
  let customizations: ThemeCustomizationMap = {};

  // Theme system: active theme comes from settings (memoized per request —
  // zero extra queries); an admin live-preview can override presentation via
  // a validated HMAC cookie without writing anything.
  const { preview, rendered } = await resolveStorefrontTheme();

  // Visitor locale — lets theme footers stay pure server components by
  // pre-resolving their few chrome strings here (zero client JS).
  let footerLocale = resolveLocale(undefined);
  try {
    footerLocale = resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  } catch {
    // default locale
  }

  try {
    const [cms, store] = await Promise.all([getCmsData(), getStoreSettings()]);
    footerContent = cms.footer;
    newsletterContent = cms.newsletter;
    customizations = store.themeCustomizations;
    contact = {
      email: store.contactEmail,
      phone: store.contactPhone,
      address: store.address,
    };
    config = {
      storeName: store.storeName,
      currency: store.currency,
      logoUrl: store.logoUrl,
      theme: rendered.id,
      checkoutEnabled: store.checkoutEnabled,
      codEnabled: store.codEnabled,
      freeShippingThreshold: store.freeShippingThreshold,
      minOrderAmount: store.minOrderAmount,
      requirePhone: store.requirePhone,
      requireAddress: store.requireAddress,
      pixel: {
        enabled: store.metaPixelEnabled,
        id: store.metaPixelId,
        events: store.pixelEvents,
      },
    };
    // Footer social links: Content → Footer socials take precedence; when
    // none are configured there we fall back to Settings → Social so both
    // surfaces stay consistent.
    socialLinks = cms.footer.socialLinks.length
      ? cms.footer.socialLinks
      : (
          [
            { label: "Instagram", url: store.instagramUrl },
            { label: "TikTok", url: store.tiktokUrl },
            { label: "Facebook", url: store.facebookUrl },
          ] as Array<{ label: string; url: string }>
        ).filter((s) => s.url);
  } catch (err) {
    console.error("[store-layout] store config fallback:", err);
  }

  // Storefront Builder: published chrome/page settings (preview draft wins
  // inside a validated admin session). Data-level only — no client JS.
  let sbFooter: { groupOrder: string[]; showNewsletter: boolean; showContact: boolean; showSocial: boolean } | null = null;
  let sbShop: { cols: number; colsMobile: number; showSearch: boolean; showSort: boolean; showFilters: boolean } | null = null;
  let sbPdp: { stickyGallery: boolean; relatedCols: number } | null = null;
  let sbCart: { showFreeShipNote: boolean } | null = null;
  try {
    const { getBuilderStore } = await import("@/lib/builder/storage");
    const { getBuilderPreviewDoc, BUILDER_PREVIEW_PARAM } = await import("@/lib/builder/preview");
    const [sbStore, sbToken] = await Promise.all([
      getBuilderStore(),
      cookies().then((c) => c.get(BUILDER_PREVIEW_PARAM)?.value ?? null).catch(() => null),
    ]);
    const sbDoc = getBuilderPreviewDoc(sbToken ?? undefined) ?? sbStore.published;
    if (sbDoc) {
      sbFooter = sbDoc.footer;
      sbShop = sbDoc.shop;
      sbPdp = sbDoc.pdp;
      sbCart = sbDoc.cart;
    }
  } catch {
    // builder inactive
  }

  return (
    <StoreConfigProvider config={config}>
      <MetaPixel />
      <CartProvider>
        <div
          data-theme={rendered.id}
          data-sb-shop={sbShop ? JSON.stringify(sbShop) : undefined}
          data-sb-pdp={sbPdp ? JSON.stringify(sbPdp) : undefined}
          data-sb-cart={sbCart ? JSON.stringify(sbCart) : undefined}
          className={preview ? "rd-has-preview min-h-dvh bg-bone text-ink" : "min-h-dvh bg-bone text-ink"}
        >
          {/* Per-storefront admin overrides (fonts + colors). Server-rendered
              as a scoped <style> block: zero client JS, zero extra queries —
              the values ride on the memoized settings read above. Absent keys
              fall through to the theme's original defaults. */}
          <ThemeOverrideStyle themeId={rendered.id} customization={customizations[rendered.id]} />
          {/* Live-preview bridge: exists ONLY inside a validated admin
              preview session; customers never download it. */}
          {preview && <PreviewBridge />}
          {preview && (
            <div className="rd-preview-bar">
              <span aria-hidden>◐</span>
              <span>
                Theme preview: {preview.name} — not live
              </span>
              <Link href="/api/theme/preview?exit=1">Exit</Link>
              <Link href="/admin/themes">Themes</Link>
            </div>
          )}
          <Navbar />
          <CartDrawer />
          <main className="min-h-screen">{children}</main>
          {(() => {
            const { FooterView } = getStorefront(rendered.id);
            // Pre-resolve the footer's few chrome strings so every theme
            // footer can be a pure SERVER component (no client JS shipped
            // for any theme's footer).
            const strings: FooterStrings = {
              newsletterPlaceholder: translate(footerLocale, "footer.newsletterPlaceholder"),
              join: translate(footerLocale, "footer.join"),
              privacy: translate(footerLocale, "footer.privacy"),
              terms: translate(footerLocale, "footer.terms"),
              accessibility: translate(footerLocale, "footer.accessibility"),
              copyright: translate(footerLocale, "footer.copyright", {
                name: config.storeName || "RUVEN DEPT",
              }),
            };
            const fbContent = sbFooter
              ? {
                  ...footerContent,
                  socialLinks: sbFooter.showSocial ? socialLinks : [],
                  showContact: sbFooter.showContact && footerContent.showContact,
                  linkGroups: (() => {
                    const byTitle = new Map(footerContent.linkGroups.map((g) => [g.title, g]));
                    const ordered = sbFooter.groupOrder
                      .map((t) => byTitle.get(t))
                      .filter(Boolean) as typeof footerContent.linkGroups;
                    const rest = footerContent.linkGroups.filter((g) => !sbFooter.groupOrder.includes(g.title));
                    return [...ordered, ...rest];
                  })(),
                }
              : { ...footerContent, socialLinks };
            const fbNewsletter = sbFooter && !sbFooter.showNewsletter
              ? { ...newsletterContent, enabled: false }
              : newsletterContent;
            return (
              <FooterView
                data={{
                  content: fbContent,
                  newsletter: fbNewsletter,
                  contact: sbFooter && !sbFooter.showContact ? { email: "", phone: "", address: "" } : contact,
                  storeName: config.storeName,
                  strings,
                }}
              />
            );
          })()}
        </div>
      </CartProvider>
    </StoreConfigProvider>
  );
}
