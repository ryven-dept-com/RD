import type { ReactNode } from "react";
import { CartProvider } from "@/context/cart-context";
import { Navbar } from "@/components/navbar";
import { CartDrawer } from "@/components/cart-drawer";
import { Footer } from "@/components/footer";
import {
  DEFAULT_FOOTER,
  DEFAULT_NEWSLETTER,
  getCmsData,
  getSeoSettings,
} from "@/lib/cms";

export default async function StoreLayout({
  children,
}: {
  children: ReactNode;
}) {
  // CMS content for the footer/newsletter, with safe fallbacks so the layout
  // never breaks if the database is momentarily unavailable.
  let footerContent = DEFAULT_FOOTER;
  let newsletterContent = DEFAULT_NEWSLETTER;
  let contact = { email: "", phone: "", address: "" };
  try {
    const [cms, seo] = await Promise.all([getCmsData(), getSeoSettings()]);
    footerContent = cms.footer;
    newsletterContent = cms.newsletter;
    contact = {
      email: seo.contactEmail,
      phone: seo.contactPhone,
      address: seo.address,
    };
  } catch (err) {
    console.error("[store-layout] CMS content fallback:", err);
  }

  return (
    <CartProvider>
      <Navbar />
      <CartDrawer />
      <main className="min-h-screen">{children}</main>
      <Footer
        content={footerContent}
        newsletter={newsletterContent}
        contact={contact}
      />
    </CartProvider>
  );
}
