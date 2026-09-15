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
import { Footer } from "@/components/footer";
import {
  DEFAULT_FOOTER,
  DEFAULT_NEWSLETTER,
  getCmsData,
} from "@/lib/cms";
import { getStoreSettings } from "@/lib/settings";
import { resolveStorefrontTheme } from "@/lib/theme-server";
import "../theme.css";

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

  // Theme system: active theme comes from settings (memoized per request —
  // zero extra queries); an admin live-preview can override presentation via
  // a validated HMAC cookie without writing anything.
  const { preview, rendered } = await resolveStorefrontTheme();

  try {
    const [cms, store] = await Promise.all([getCmsData(), getStoreSettings()]);
    footerContent = cms.footer;
    newsletterContent = cms.newsletter;
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

  return (
    <StoreConfigProvider config={config}>
      <MetaPixel />
      <CartProvider>
        <div
          data-theme={rendered.id}
          className={preview ? "rd-has-preview min-h-dvh bg-bone text-ink" : "min-h-dvh bg-bone text-ink"}
        >
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
          <Footer
            content={{ ...footerContent, socialLinks }}
            newsletter={newsletterContent}
            contact={contact}
            storeName={config.storeName}
          />
        </div>
      </CartProvider>
    </StoreConfigProvider>
  );
}
