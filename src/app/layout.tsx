import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import {
  Amiri,
  Anton,
  Archivo_Black,
  Bebas_Neue,
  Cairo,
  Fraunces,
  Inter,
  Manrope,
  Noto_Kufi_Arabic,
  Oswald,
  Playfair_Display,
  Space_Grotesk,
  Syne,
  Tajawal,
  Work_Sans,
} from "next/font/google";
import { getStoreSettings } from "@/lib/settings";
import { LanguageProvider } from "@/i18n/language-context";
import { LOCALE_COOKIE, localeDir, resolveLocale } from "@/i18n/translations";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});

// Theme fonts: Space Grotesk (RAW CONCRETE / NIGHT SHIFT display voice) and
// Fraunces (ARCHIVE / SIGNATURE editorial serif). Browsers only download a
// font file when the active theme actually renders it — inactive themes cost
// nothing beyond a tiny @font-face declaration.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

/* Customization catalog fonts — admin-selectable typography per storefront.
   next/font only emits @font-face declarations here; browsers download a
   font binary only when the active theme (or its overrides) actually
   renders it, so unused fonts cost a few CSS bytes and nothing more. */
const archivoBlack = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-archivo-black",
  display: "swap",
});
const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas-neue",
  display: "swap",
});
const oswald = Oswald({
  subsets: ["latin"],
  variable: "--font-oswald",
  display: "swap",
});
const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
});
const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair-display",
  display: "swap",
});
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});
const workSans = Work_Sans({
  subsets: ["latin"],
  variable: "--font-work-sans",
  display: "swap",
});
/* Arabic voices — never force a Latin display face onto Arabic script. */
const cairo = Cairo({
  subsets: ["arabic"],
  variable: "--font-cairo",
  display: "swap",
});
const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["400", "500", "700"],
  variable: "--font-tajawal",
  display: "swap",
});
const amiri = Amiri({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-amiri",
  display: "swap",
});
const notoKufiArabic = Noto_Kufi_Arabic({
  subsets: ["arabic"],
  variable: "--font-noto-kufi-arabic",
  display: "swap",
});

/**
 * viewport-fit=cover exposes iOS safe-area insets to the CSS
 * env(safe-area-inset-*) used by the storefront header/preview bar.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const DEFAULT_SITE_TITLE = "Ruven Dept.";
const DEFAULT_DESCRIPTION =
  "Ruven Dept. crafts heavyweight streetwear essentials and utility outerwear built for the street and everything past it. Free shipping over $150.";

/**
 * SEO / branding metadata is managed via Admin → Settings (SEO section) and
 * stored in the settings table, with the original values as fallback so the
 * site always has valid metadata.
 */
export async function generateMetadata(): Promise<Metadata> {
  let store: Awaited<ReturnType<typeof getStoreSettings>> | null = null;
  try {
    store = await getStoreSettings();
  } catch {
    // metadata falls back to defaults
  }

  const storeName = store?.storeName || DEFAULT_SITE_TITLE;
  const siteTitle = store?.seoTitle || `${storeName} — Heavyweight Streetwear Essentials`;
  const description = store?.seoDescription || DEFAULT_DESCRIPTION;
  const indexable = store ? store.robotsIndex : true;

  return {
    title: {
      default: siteTitle,
      template: `%s · ${store?.seoTitle || storeName}`,
    },
    description,
    keywords: store?.seoKeywords
      ? store.seoKeywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean)
      : [
          "streetwear",
          "hoodies",
          "heavyweight tees",
          "utility jackets",
          "cargo pants",
          "sneakers",
        ],
    robots: { index: indexable, follow: indexable },
    ...(store?.canonicalUrl ? { alternates: { canonical: store.canonicalUrl } } : {}),
    ...(store?.faviconUrl ? { icons: { icon: store.faviconUrl } } : {}),
    openGraph: {
      title: siteTitle,
      description,
      type: "website",
      ...(store?.ogImageUrl ? { images: [{ url: store.ogImageUrl }] } : {}),
    },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Phase 9: the storefront language persists in a cookie; SSR renders the
  // matching lang/dir so Arabic pages arrive RTL without any client flicker.
  let locale = resolveLocale(undefined);
  try {
    const cookieStore = await cookies();
    locale = resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  } catch {
    // cookies unavailable — fall back to the default locale
  }

  return (
    <html
      lang={locale}
      dir={localeDir(locale)}
      className={`${inter.variable} ${anton.variable} ${spaceGrotesk.variable} ${fraunces.variable} ${archivoBlack.variable} ${bebasNeue.variable} ${oswald.variable} ${syne.variable} ${playfairDisplay.variable} ${manrope.variable} ${workSans.variable} ${cairo.variable} ${tajawal.variable} ${amiri.variable} ${notoKufiArabic.variable}`}
    >
      <body className="bg-bone text-ink antialiased">
        <LanguageProvider initialLocale={locale}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
