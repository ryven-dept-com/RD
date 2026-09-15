import type {
  BuilderDoc,
  LayoutProps,
  MobileProps,
  ColorProps,
  Section,
  SectionProps,
  SectionType,
  TypeProps,
} from "./types";

/** Inspector field descriptor — the admin UI renders forms from this. */
export type FieldDef = {
  key: keyof SectionProps;
  label: string;
  kind: "text" | "textarea" | "href" | "image" | "select" | "toggle" | "range";
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
};

export type LibraryEntry = {
  type: SectionType;
  label: string;
  group: "Commerce" | "Editorial" | "Media" | "Structure";
  fields: FieldDef[];
};

const IMG_FIELDS: FieldDef[] = [
  { key: "image", label: "Image", kind: "image" },
  { key: "mobileImage", label: "Mobile image", kind: "image" },
  { key: "alt", label: "Alt text", kind: "text" },
  {
    key: "objectPosition",
    label: "Object position",
    kind: "select",
    options: [
      { value: "top", label: "Top" },
      { value: "center", label: "Center" },
      { value: "bottom", label: "Bottom" },
    ],
  },
  {
    key: "aspect",
    label: "Aspect ratio",
    kind: "select",
    options: ["auto", "1:1", "4:3", "3:4", "16:9", "21:9", "4:5"].map((v) => ({
      value: v,
      label: v === "auto" ? "Auto (content)" : v,
    })),
  },
  {
    key: "radius",
    label: "Corner radius",
    kind: "select",
    options: ["none", "sm", "md", "lg"].map((v) => ({ value: v, label: v })),
  },
];

const CTA_FIELDS: FieldDef[] = [
  { key: "ctaText", label: "Button text", kind: "text" },
  { key: "ctaLink", label: "Button link", kind: "href" },
  { key: "cta2Text", label: "Second button", kind: "text" },
  { key: "cta2Link", label: "Second link", kind: "href" },
];

const PRODUCT_FIELDS: FieldDef[] = [
  { key: "source", label: "Source (featured | new | best | category:X | collection:X)", kind: "text" },
  {
    key: "sort",
    label: "Sorting",
    kind: "select",
    options: [
      { value: "default", label: "Store order" },
      { value: "newest", label: "Newest" },
      { value: "price-asc", label: "Price ↑" },
      { value: "price-desc", label: "Price ↓" },
    ],
  },
  { key: "limit", label: "Product count", kind: "range", min: 2, max: 12 },
  { key: "showPrice", label: "Show price", kind: "toggle" },
  { key: "showBadges", label: "Show badges", kind: "toggle" },
  { key: "showVariants", label: "Show variant chips", kind: "toggle" },
  { key: "showCta", label: "Show card CTA", kind: "toggle" },
  { key: "hoverSwap", label: "Hover image swap", kind: "toggle" },
];

export const SECTION_LIBRARY: LibraryEntry[] = [
  { type: "hero", label: "Hero", group: "Editorial", fields: [
    { key: "eyebrow", label: "Eyebrow", kind: "text" },
    { key: "title", label: "Title", kind: "text" },
    { key: "subtitle", label: "Subtitle", kind: "textarea" },
    ...CTA_FIELDS, ...IMG_FIELDS,
    { key: "height", label: "Height", kind: "select", options: ["", "sm", "md", "lg", "xl"].map((v) => ({ value: v, label: v || "theme" })) },
    { key: "useCms", label: "Use Content-admin hero copy", kind: "toggle" },
  ]},
  { type: "announcement", label: "Announcement bar", group: "Structure", fields: [] },
  { type: "marquee", label: "Marquee / ticker", group: "Structure", fields: [] },
  { type: "featured_products", label: "Featured products", group: "Commerce", fields: PRODUCT_FIELDS },
  { type: "product_grid", label: "Product grid", group: "Commerce", fields: [...PRODUCT_FIELDS, { key: "title", label: "Heading", kind: "text" }] },
  { type: "product_carousel", label: "Product carousel", group: "Commerce", fields: [...PRODUCT_FIELDS, { key: "title", label: "Heading", kind: "text" }] },
  { type: "product_spotlight", label: "Product spotlight", group: "Commerce", fields: [
    { key: "source", label: "Source (single product slug or ids:1)", kind: "text" },
    { key: "title", label: "Heading", kind: "text" },
    { key: "body", label: "Copy", kind: "textarea" },
    ...CTA_FIELDS,
  ]},
  { type: "new_arrivals", label: "New arrivals", group: "Commerce", fields: PRODUCT_FIELDS },
  { type: "best_sellers", label: "Best sellers", group: "Commerce", fields: PRODUCT_FIELDS },
  { type: "categories", label: "Categories", group: "Commerce", fields: [
    { key: "limit", label: "Max categories", kind: "range", min: 2, max: 8 },
  ]},
  { type: "collection_cards", label: "Collection cards", group: "Commerce", fields: [] },
  { type: "editorial_image", label: "Editorial image", group: "Media", fields: [...IMG_FIELDS, { key: "link", label: "Link", kind: "href" }] },
  { type: "editorial_split", label: "Editorial split", group: "Editorial", fields: [
    { key: "eyebrow", label: "Eyebrow", kind: "text" },
    { key: "title", label: "Heading", kind: "text" },
    { key: "body", label: "Copy", kind: "textarea" },
    ...CTA_FIELDS, ...IMG_FIELDS,
  ]},
  { type: "full_width_image", label: "Full-width image", group: "Media", fields: [...IMG_FIELDS, { key: "height", label: "Height", kind: "select", options: ["", "sm", "md", "lg", "xl"].map((v) => ({ value: v, label: v || "theme" })) }] },
  { type: "image_text", label: "Image + text", group: "Editorial", fields: [
    { key: "title", label: "Heading", kind: "text" },
    { key: "body", label: "Copy", kind: "textarea" },
    ...CTA_FIELDS, ...IMG_FIELDS,
  ]},
  { type: "text_block", label: "Text block", group: "Editorial", fields: [
    { key: "title", label: "Heading", kind: "text" },
    { key: "body", label: "Copy", kind: "textarea" },
  ]},
  { type: "promo_banner", label: "Promotional banners", group: "Media", fields: [
    { key: "useCms", label: "Use Content-admin banners", kind: "toggle" },
  ]},
  { type: "lookbook", label: "Lookbook mosaic", group: "Media", fields: [...IMG_FIELDS, { key: "image2", label: "Second image", kind: "image" } as FieldDef, { key: "title", label: "Heading", kind: "text" }, ...CTA_FIELDS] },
  { type: "brand_story", label: "Brand story", group: "Editorial", fields: [
    { key: "useCms", label: "Use Content-admin story", kind: "toggle" },
    { key: "title", label: "Heading", kind: "text" },
    { key: "body", label: "Copy", kind: "textarea" },
    ...CTA_FIELDS, ...IMG_FIELDS,
  ]},
  { type: "newsletter", label: "Newsletter", group: "Structure", fields: [
    { key: "title", label: "Heading", kind: "text" },
    { key: "body", label: "Copy", kind: "textarea" },
  ]},
  { type: "social", label: "Social links", group: "Structure", fields: [] },
  { type: "custom_cta", label: "Custom CTA", group: "Structure", fields: [
    { key: "title", label: "Heading", kind: "text" },
    { key: "subtitle", label: "Copy", kind: "textarea" },
    ...CTA_FIELDS,
  ]},
  { type: "spacer", label: "Spacer", group: "Structure", fields: [
    { key: "height", label: "Height", kind: "select", options: ["sm", "md", "lg", "xl"].map((v) => ({ value: v, label: v })) },
  ]},
  { type: "divider", label: "Divider", group: "Structure", fields: [
    { key: "divider", label: "Style", kind: "select", options: [
      { value: "hairline", label: "Hairline" },
      { value: "bold", label: "Bold" },
    ]},
  ]},
];

export const LIBRARY_BY_TYPE = new Map(SECTION_LIBRARY.map((l) => [l.type, l]));

/* -------------------------------- defaults -------------------------------- */

export function defaultLayout(): LayoutProps {
  return {
    align: "start",
    valign: "center",
    container: "default",
    padY: "md",
    gap: "md",
    cols: 4,
    colsMobile: 2,
  };
}

export function defaultTypography(): TypeProps {
  return {
    font: "",
    size: "md",
    weight: "normal",
    tracking: "normal",
    lineHeight: "normal",
    align: "start",
    transform: "none",
    headingWidth: "default",
  };
}

export function defaultColors(): ColorProps {
  return {
    bg: "",
    text: "",
    heading: "",
    accent: "",
    buttonBg: "",
    buttonText: "",
    border: "",
    overlay: "",
    overlayOpacity: 30,
  };
}

export function defaultMobile(): MobileProps {
  return {
    hidden: false,
    order: 0,
    image: "",
    height: "",
    cols: 0,
    padY: "",
    align: "",
    size: "",
  };
}

export function defaultProps(type: SectionType): SectionProps {
  return {
    title: "",
    subtitle: "",
    body: "",
    eyebrow: "",
    ctaText: "",
    ctaLink: "",
    cta2Text: "",
    cta2Link: "",
    image: "",
    image2: "",
    mobileImage: "",
    alt: "",
    objectPosition: "center",
    aspect: "auto",
    radius: "none",
    height: "",
    source: type === "new_arrivals" ? "new" : type === "best_sellers" ? "best" : "featured",
    sort: "default",
    limit: 8,
    showPrice: true,
    showBadges: true,
    showVariants: true,
    showCta: false,
    hoverSwap: true,
    useCms: true,
    link: "",
    divider: "hairline",
  };
}

let seq = 0;
export function newSectionId(): string {
  seq += 1;
  return `sec_${Date.now().toString(36)}_${seq}_${Math.random().toString(36).slice(2, 7)}`;
}

export function defaultSection(type: SectionType): Section {
  const s: Section = {
    id: newSectionId(),
    type,
    enabled: true,
    layout: defaultLayout(),
    typography: defaultTypography(),
    mobileTypography: {},
    colors: defaultColors(),
    mobile: defaultMobile(),
    props: defaultProps(type),
  };
  if (type === "product_grid" || type === "product_carousel") s.props.title = "";
  return s;
}

/**
 * Default page composition — mirrors the current house homepage order so an
 * untouched store renders exactly as before through the builder pipeline.
 */
export function defaultBuilderDoc(): BuilderDoc {
  const mk = (type: SectionType, patch: Partial<Section> = {}): Section => ({
    ...defaultSection(type),
    ...patch,
  });
  return {
    home: [
      mk("hero"),
      mk("marquee"),
      mk("promo_banner"),
      mk("collection_cards"),
      mk("featured_products", { props: { ...defaultProps("featured_products"), limit: 8 } }),
      mk("brand_story"),
      mk("new_arrivals", {
        layout: { ...defaultLayout(), cols: 4, colsMobile: 2 },
      }),
    ],
    header: {
      logoPosition: "start",
      logoSize: "md",
      navPosition: "center",
      navOrder: ["home", "shop", "collections", "about"],
      height: "md",
      sticky: true,
      transparentOverHero: false,
      showSearch: true,
      showCart: true,
      showLanguage: true,
      showAnnouncement: true,
    },
    footer: {
      groupOrder: [],
      showNewsletter: true,
      showContact: true,
      showSocial: true,
    },
    shop: { cols: 3, colsMobile: 2, gap: "md", showSearch: true, showSort: true, showFilters: true },
    pdp: { stickyGallery: true, relatedCols: 4 },
    cart: { showFreeShipNote: true },
  };
}
