import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Anton, Inter } from "next/font/google";
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

const DEFAULT_SITE_TITLE = "Ruven Dept.";
const DEFAULT_TITLE =
  "Ruven Dept. — Heavyweight Streetwear Essentials";
const DEFAULT_DESCRIPTION =
  "Ruven Dept. crafts heavyweight streetwear essentials and utility outerwear built for the street and everything past it. Free shipping over $150.";

/**
 * SEO / branding metadata is CMS-managed via the settings table (Admin →
 * Settings → SEO & Branding), with the original values as fallback so the
 * site always has valid metadata.
 */
export async function generateMetadata(): Promise<Metadata> {
  let seo = {
    seoTitle: "",
    seoDescription: "",
    faviconUrl: "",
    ogImageUrl: "",
  };
  try {
    const { getSeoSettings } = await import("@/lib/cms");
    seo = await getSeoSettings();
  } catch {
    // metadata falls back to defaults
  }

  const siteTitle = seo.seoTitle.trim() || DEFAULT_SITE_TITLE;
  const description = seo.seoDescription.trim() || DEFAULT_DESCRIPTION;

  return {
    title: {
      default: seo.seoTitle.trim() || DEFAULT_TITLE,
      template: `%s · ${siteTitle}`,
    },
    description,
    keywords: [
      "streetwear",
      "hoodies",
      "heavyweight tees",
      "utility jackets",
      "cargo pants",
      "sneakers",
    ],
    ...(seo.faviconUrl ? { icons: { icon: seo.faviconUrl } } : {}),
    openGraph: {
      title: seo.seoTitle.trim() || DEFAULT_TITLE,
      description,
      type: "website",
      ...(seo.ogImageUrl ? { images: [{ url: seo.ogImageUrl }] } : {}),
    },
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${anton.variable}`}>
      <body className="bg-bone text-ink antialiased">{children}</body>
    </html>
  );
}
