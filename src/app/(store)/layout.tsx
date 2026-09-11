import type { ReactNode } from "react";
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
        <Navbar />
        <CartDrawer />
        <main className="min-h-screen">{children}</main>
        <Footer
          content={{ ...footerContent, socialLinks }}
          newsletter={newsletterContent}
          contact={contact}
          storeName={config.storeName}
        />
      </CartProvider>
    </StoreConfigProvider>
  );
}
