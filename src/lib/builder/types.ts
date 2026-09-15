/**
 * Storefront Builder — configuration model.
 *
 * The builder controls STRUCTURE & CONTENT of the customer-facing pages;
 * themes keep providing the DESIGN LANGUAGE. Rendering priority:
 *
 *   section override → theme customization → theme default
 *
 * Everything here is plain JSON (stored in the `settings` table under the
 * `storefrontBuilder` key) and fully validated by validate.ts before it can
 * ever be saved or published. Business data never lives in this document.
 */

export const SECTION_TYPES = [
  "hero",
  "announcement",
  "marquee",
  "featured_products",
  "product_grid",
  "product_carousel",
  "categories",
  "collection_cards",
  "editorial_image",
  "editorial_split",
  "full_width_image",
  "image_text",
  "text_block",
  "promo_banner",
  "product_spotlight",
  "new_arrivals",
  "best_sellers",
  "lookbook",
  "brand_story",
  "newsletter",
  "social",
  "custom_cta",
  "spacer",
  "divider",
] as const;

export type SectionType = (typeof SECTION_TYPES)[number];

/** Semantic layout controls — enums only, never arbitrary CSS. */
export type LayoutProps = {
  align: "start" | "center" | "end";
  valign: "start" | "center" | "end";
  container: "narrow" | "default" | "wide" | "full";
  padY: "none" | "sm" | "md" | "lg" | "xl";
  gap: "sm" | "md" | "lg";
  cols: 2 | 3 | 4;
  colsMobile: 1 | 2;
};

/** Per-section typography — safe enums + clamped rem sizes. */
export type TypeProps = {
  font: string; // font id from the customization catalog ("" = theme default)
  size: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
  weight: "normal" | "medium" | "semibold" | "bold";
  tracking: "tight" | "normal" | "wide" | "widest";
  lineHeight: "tight" | "normal" | "relaxed";
  align: "start" | "center" | "end";
  transform: "none" | "uppercase" | "capitalize";
  headingWidth: "narrow" | "default" | "wide";
};

/** Per-section colors — hex only; empty string = inherit theme token. */
export type ColorProps = {
  bg: string;
  text: string;
  heading: string;
  accent: string;
  buttonBg: string;
  buttonText: string;
  border: string;
  overlay: string;
  overlayOpacity: number; // 0..80 (%)
};

/** Mobile-only overrides — real responsive art direction, not scaling. */
export type MobileProps = {
  hidden: boolean;
  order: number; // mobile-only reorder (stable sort; equal = config order)
  image: string; // alternate mobile image ("" = desktop image)
  height: "" | "sm" | "md" | "lg"; // section min-height override
  cols: 0 | 1 | 2; // 0 = inherit
  padY: "" | LayoutProps["padY"];
  align: "" | LayoutProps["align"];
  size: "" | TypeProps["size"];
};

/** Flat per-type property bag; unused keys are ignored by the renderer. */
export type SectionProps = {
  // copy
  title: string;
  subtitle: string;
  body: string;
  eyebrow: string;
  ctaText: string;
  ctaLink: string;
  cta2Text: string;
  cta2Link: string;
  // media
  image: string;
  image2: string;
  mobileImage: string;
  alt: string;
  objectPosition: "top" | "center" | "bottom";
  aspect: "auto" | "1:1" | "4:3" | "3:4" | "16:9" | "21:9" | "4:5";
  radius: "none" | "sm" | "md" | "lg";
  height: "" | "sm" | "md" | "lg" | "xl";
  // product sources
  source: string; // featured | new | best | category:X | collection:X | ids:1,2
  sort: "default" | "newest" | "price-asc" | "price-desc";
  limit: number;
  // card display
  showPrice: boolean;
  showBadges: boolean;
  showVariants: boolean;
  showCta: boolean;
  hoverSwap: boolean;
  // cms wiring (empty = use the Content admin value)
  useCms: boolean;
  // misc
  link: string;
  divider: "hairline" | "bold";
};

export type Section = {
  id: string;
  type: SectionType;
  enabled: boolean;
  layout: LayoutProps;
  typography: TypeProps;
  mobileTypography: Partial<TypeProps>;
  colors: ColorProps;
  mobile: MobileProps;
  props: SectionProps;
};

/* ----------------------------- global chrome ------------------------------ */

export type HeaderConfig = {
  logoPosition: "start" | "center";
  logoSize: "sm" | "md" | "lg";
  navPosition: "start" | "center" | "end";
  /** Ordered keys of the primary nav; unknown keys are dropped. */
  navOrder: string[];
  height: "sm" | "md" | "lg";
  sticky: boolean;
  transparentOverHero: boolean;
  showSearch: boolean;
  showCart: boolean;
  showLanguage: boolean;
  showAnnouncement: boolean;
};

export type FooterConfig = {
  /** Ordered titles of CMS link groups; missing ones keep CMS order after. */
  groupOrder: string[];
  showNewsletter: boolean;
  showContact: boolean;
  showSocial: boolean;
};

export type ShopSettings = {
  cols: 2 | 3 | 4;
  colsMobile: 1 | 2;
  gap: "sm" | "md" | "lg";
  showSearch: boolean;
  showSort: boolean;
  showFilters: boolean;
};

export type PdpSettings = {
  stickyGallery: boolean;
  relatedCols: 2 | 3 | 4;
};

export type CartSettings = {
  showFreeShipNote: boolean;
};

export type BuilderDoc = {
  home: Section[];
  header: HeaderConfig;
  footer: FooterConfig;
  shop: ShopSettings;
  pdp: PdpSettings;
  cart: CartSettings;
};

export type HistoryEntry = { at: string; label: string; doc: BuilderDoc };

/** Persisted store: draft + published + rollback history (transactional). */
export type BuilderStore = {
  version: number;
  updatedAt: string;
  draft: BuilderDoc;
  published: BuilderDoc | null;
  history: HistoryEntry[];
};
