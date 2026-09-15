import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { Anton, Fraunces, Inter, Space_Grotesk } from "next/font/google";
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
      className={`${inter.variable} ${anton.variable} ${spaceGrotesk.variable} ${fraunces.variable}`}
    >
      <body className="bg-bone text-ink antialiased">
        <LanguageProvider initialLocale={locale}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
