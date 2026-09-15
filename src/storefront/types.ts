/**
 * RYVEN DEPT storefront architecture — presentation contracts.
 *
 * ONE backend / ONE catalog + SIX storefronts. Business logic and data live
 * in lib/, context/ and api/; this module only describes what a theme needs
 * to render. Themes are pure presentation: they receive fully-resolved data
 * (products, CMS content, locale strings, price formatter) and return JSX.
 */
import type { Review } from "@/db/schema";
import type { Locale } from "@/i18n/translations";
import type {
  BrandStoryContent,
  CollectionItem,
  FooterContent,
  HeroContent,
  NewsletterContent,
  PromoBanner,
} from "@/lib/cms";
import type { StorefrontVariant } from "@/lib/queries";

/** Locale string resolver (system keys only — data strings pass through as-is). */
export type Tr = (key: string, vars?: Record<string, string | number>) => string;

/** Price formatter: integer cents → localized display string. */
export type Fmt = (cents: number) => string;

/** Product row as consumed by storefront cards/grids (read-only). */
export type CardProduct = {
  slug: string;
  name: string;
  tagline: string;
  price: number;
  compareAtPrice: number | null;
  category: string;
  images: string[];
  colors: string[];
  isNew: boolean;
  bestSeller: boolean;
  soldOut: boolean;
  avgRating: number;
  reviewCount: number;
};

/* ------------------------------- HOME ------------------------------------ */

export type HomePresentation = {
  hero: HeroContent;
  brandStory: BrandStoryContent;
  banners: PromoBanner[];
  collections: CollectionItem[];
  marquee: string[];
  announcementLink: string;
  featured: CardProduct[];
  newArrivals: CardProduct[];
  /** Pre-formatted free-shipping threshold for USP copy (locale aware). */
  freeShipAmount: string;
};

export type HomeProps = { data: HomePresentation; tr: Tr; fmt: Fmt };

/* ------------------------------- SHOP ------------------------------------ */

export type ShopFilterOptions = {
  categories: string[];
  collections: string[];
  sizes: string[];
  colors: string[];
};

export type ShopPresentation = {
  products: CardProduct[];
  options: ShopFilterOptions;
  heading: string;
  categoryDescription: string;
};

export type ShopProps = { data: ShopPresentation; tr: Tr; fmt: Fmt };

/* -------------------------------- PDP ------------------------------------ */

export type PdpProduct = {
  id: number;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  collection: string;
  price: number;
  compareAtPrice: number | null;
  images: string[];
  sizes: string[];
  colors: string[];
  stock: number;
  details: string[];
};

/** Review row exactly as returned by the data layer. */
export type PdpReview = Review;

export type PdpPresentation = {
  product: PdpProduct;
  variants: StorefrontVariant[];
  reviews: PdpReview[];
  avgRating: number;
  reviewCount: number;
  related: CardProduct[];
  badge: string | null;
  onSale: boolean;
  dist: Array<{ star: number; count: number }>;
  freeShipAmount: string;
  locale: Locale;
};

export type PdpProps = { data: PdpPresentation; tr: Tr; fmt: Fmt };

/* ------------------------------ FOOTER ----------------------------------- */

/**
 * Locale strings pre-resolved by the layout so theme footers can stay pure
 * SERVER components — zero client JS for five of the six storefronts.
 */
export type FooterStrings = {
  newsletterPlaceholder: string;
  join: string;
  privacy: string;
  terms: string;
  accessibility: string;
  /** Default copyright line (with store name already interpolated). */
  copyright: string;
};

export type FooterPresentation = {
  content: FooterContent;
  newsletter: NewsletterContent;
  contact: { email: string; phone: string; address: string };
  storeName: string;
  strings: FooterStrings;
};

export type FooterProps = { data: FooterPresentation };

/* --------------------------- STOREFRONT MAP -------------------------------- */

import type { ComponentType } from "react";

/** What every theme provides: a complete storefront surface. */
export type StorefrontComponents = {
  Home: ComponentType<HomeProps>;
  Shop: ComponentType<ShopProps>;
  Pdp: ComponentType<PdpProps>;
  FooterView: ComponentType<FooterProps>;
  Card: ComponentType<{
    product: CardProduct;
    tr: Tr;
    fmt: Fmt;
    index?: number;
    priority?: boolean;
  }>;
};
