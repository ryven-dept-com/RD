import {
  defaultBuilderDoc,
  defaultColors,
  defaultLayout,
  defaultMobile,
  defaultProps,
  defaultTypography,
  LIBRARY_BY_TYPE,
} from "./defaults";
import { SECTION_TYPES, type BuilderDoc, type Section, type SectionType } from "./types";

/**
 * Builder schema validation. Pure + shared by the save API, the publish step
 * and the health scanner. Every value is coerced into the safe enum/clamp
 * space — arbitrary CSS / JS can never enter the document.
 */

export type Issue = {
  id: string;
  page: "home" | "header" | "footer" | "shop" | "pdp" | "cart";
  sectionId?: string;
  sectionType?: string;
  property: string;
  severity: "warning" | "error";
  message: string;
  suggested: string;
  /** Deterministic safe auto-fix identifier (health.ts implements them). */
  fix?: string;
};

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHex(v: string): boolean {
  return HEX.test(v);
}

export function sanitizeColor(v: unknown): string {
  if (typeof v !== "string") return "";
  const t = v.trim();
  if (!t) return "";
  return isHex(t) ? t.toLowerCase() : "";
}

function str(v: unknown, max: number, fallback = ""): string {
  if (typeof v !== "string") return fallback;
  const t = v.trim();
  return t ? t.slice(0, max) : fallback;
}

export function sanitizeHref(v: unknown): string {
  if (typeof v !== "string") return "";
  const t = v.trim();
  if (!t) return "";
  if (t.startsWith("/") && !t.startsWith("//")) return t.slice(0, 300);
  if (/^https?:\/\//i.test(t) && !t.includes("@")) return t.slice(0, 300);
  if (/^mailto:|^tel:/i.test(t)) return t.slice(0, 300);
  return "";
}

function pick<T extends string>(v: unknown, options: readonly T[], fallback: T): T {
  return typeof v === "string" && (options as readonly string[]).includes(v)
    ? (v as T)
    : fallback;
}

function pickNum<T extends number>(v: unknown, options: readonly T[], fallback: T): T {
  return typeof v === "number" && (options as readonly number[]).includes(v)
    ? (v as T)
    : fallback;
}

function int(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.min(max, Math.max(min, n));
}

function bool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

const SIZES = ["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl"] as const;
const HEIGHTS = ["", "sm", "md", "lg", "xl"] as const;

export function sanitizeSection(raw: unknown): Section {
  const r = (raw ?? {}) as Record<string, unknown>;
  const type = pick(r.type, SECTION_TYPES, "text_block") as SectionType;
  const d = defaultProps(type);
  const p = (r.props ?? {}) as Record<string, unknown>;
  const l = (r.layout ?? {}) as Record<string, unknown>;
  const t = (r.typography ?? {}) as Record<string, unknown>;
  const c = (r.colors ?? {}) as Record<string, unknown>;
  const m = (r.mobile ?? {}) as Record<string, unknown>;
  const mt = (r.mobileTypography ?? {}) as Record<string, unknown>;

  return {
    id: str(r.id, 64) || `sec_repaired_${Math.random().toString(36).slice(2, 8)}`,
    type,
    enabled: bool(r.enabled, true),
    layout: {
      align: pick(l.align, ["start", "center", "end"] as const, defaultLayout().align),
      valign: pick(l.valign, ["start", "center", "end"] as const, defaultLayout().valign),
      container: pick(l.container, ["narrow", "default", "wide", "full"] as const, defaultLayout().container),
      padY: pick(l.padY, ["none", "sm", "md", "lg", "xl"] as const, defaultLayout().padY),
      gap: pick(l.gap, ["sm", "md", "lg"] as const, defaultLayout().gap),
      cols: pickNum(l.cols, [2, 3, 4] as const, 4),
      colsMobile: pickNum(l.colsMobile, [1, 2] as const, 2),
    },
    typography: {
      font: str(t.font, 40),
      size: pick(t.size, SIZES, "md"),
      weight: pick(t.weight, ["normal", "medium", "semibold", "bold"] as const, "normal"),
      tracking: pick(t.tracking, ["tight", "normal", "wide", "widest"] as const, "normal"),
      lineHeight: pick(t.lineHeight, ["tight", "normal", "relaxed"] as const, "normal"),
      align: pick(t.align, ["start", "center", "end"] as const, "start"),
      transform: pick(t.transform, ["none", "uppercase", "capitalize"] as const, "none"),
      headingWidth: pick(t.headingWidth, ["narrow", "default", "wide"] as const, "default"),
    },
    mobileTypography: {
      ...(mt.size !== undefined ? { size: pick(mt.size, SIZES, "md") } : {}),
      ...(mt.align !== undefined ? { align: pick(mt.align, ["start", "center", "end"] as const, "start") } : {}),
      ...(mt.weight !== undefined ? { weight: pick(mt.weight, ["normal", "medium", "semibold", "bold"] as const, "normal") } : {}),
    },
    colors: {
      bg: sanitizeColor(c.bg),
      text: sanitizeColor(c.text),
      heading: sanitizeColor(c.heading),
      accent: sanitizeColor(c.accent),
      buttonBg: sanitizeColor(c.buttonBg),
      buttonText: sanitizeColor(c.buttonText),
      border: sanitizeColor(c.border),
      overlay: sanitizeColor(c.overlay),
      overlayOpacity: int(c.overlayOpacity, 0, 80, defaultColors().overlayOpacity),
    },
    mobile: {
      hidden: bool(m.hidden),
      order: int(m.order, 0, 99, 0),
      image: sanitizeHref(m.image),
      height: pick(m.height, ["", "sm", "md", "lg"] as const, ""),
      cols: pickNum(m.cols, [0, 1, 2] as const, 0),
      padY: pick(m.padY, ["", "none", "sm", "md", "lg", "xl"] as const, ""),
      align: pick(m.align, ["", "start", "center", "end"] as const, ""),
      size: pick(m.size, ["", ...SIZES] as const, ""),
    },
    props: {
      title: str(p.title, 200, d.title),
      subtitle: str(p.subtitle, 400, d.subtitle),
      body: str(p.body, 4000, d.body),
      eyebrow: str(p.eyebrow, 120, d.eyebrow),
      ctaText: str(p.ctaText, 80, d.ctaText),
      ctaLink: sanitizeHref(p.ctaLink) || d.ctaLink,
      cta2Text: str(p.cta2Text, 80, d.cta2Text),
      cta2Link: sanitizeHref(p.cta2Link) || d.cta2Link,
      image: sanitizeHref(p.image) || d.image,
      image2: sanitizeHref(p.image2),
      mobileImage: sanitizeHref(p.mobileImage),
      alt: str(p.alt, 300, d.alt),
      objectPosition: pick(p.objectPosition, ["top", "center", "bottom"] as const, "center"),
      aspect: pick(p.aspect, ["auto", "1:1", "4:3", "3:4", "16:9", "21:9", "4:5"] as const, "auto"),
      radius: pick(p.radius, ["none", "sm", "md", "lg"] as const, "none"),
      height: pick(p.height, HEIGHTS, ""),
      source: str(p.source, 120, d.source),
      sort: pick(p.sort, ["default", "newest", "price-asc", "price-desc"] as const, "default"),
      limit: int(p.limit, 2, 12, d.limit),
      showPrice: bool(p.showPrice, d.showPrice),
      showBadges: bool(p.showBadges, d.showBadges),
      showVariants: bool(p.showVariants, d.showVariants),
      showCta: bool(p.showCta, d.showCta),
      hoverSwap: bool(p.hoverSwap, d.hoverSwap),
      useCms: bool(p.useCms, d.useCms),
      link: sanitizeHref(p.link),
      divider: pick(p.divider, ["hairline", "bold"] as const, "hairline"),
    },
  };
}

/** Coerce any input into a fully-valid BuilderDoc. */
export function sanitizeDoc(raw: unknown): BuilderDoc {
  const base = defaultBuilderDoc();
  const r = (raw ?? {}) as Record<string, unknown>;
  const homeRaw = Array.isArray(r.home) ? r.home : [];
  const seen = new Set<string>();
  const home: Section[] = [];
  for (const item of homeRaw.slice(0, 40)) {
    const s = sanitizeSection(item);
    while (seen.has(s.id)) s.id = `${s.id}_b`;
    seen.add(s.id);
    home.push(s);
  }
  const h = (r.header ?? {}) as Record<string, unknown>;
  const f = (r.footer ?? {}) as Record<string, unknown>;
  const sh = (r.shop ?? {}) as Record<string, unknown>;
  const pd = (r.pdp ?? {}) as Record<string, unknown>;
  const ca = (r.cart ?? {}) as Record<string, unknown>;
  const navKeys = ["home", "shop", "collections", "about"];
  const navOrder = Array.isArray(h.navOrder)
    ? (h.navOrder.filter((k): k is string => typeof k === "string" && navKeys.includes(k)) as string[])
    : base.header.navOrder;
  return {
    home,
    header: {
      logoPosition: pick(h.logoPosition, ["start", "center"] as const, base.header.logoPosition),
      logoSize: pick(h.logoSize, ["sm", "md", "lg"] as const, base.header.logoSize),
      navPosition: pick(h.navPosition, ["start", "center", "end"] as const, base.header.navPosition),
      navOrder: navOrder.length ? navOrder : base.header.navOrder,
      height: pick(h.height, ["sm", "md", "lg"] as const, base.header.height),
      sticky: bool(h.sticky, base.header.sticky),
      transparentOverHero: bool(h.transparentOverHero),
      showSearch: bool(h.showSearch, true),
      showCart: bool(h.showCart, true),
      showLanguage: bool(h.showLanguage, true),
      showAnnouncement: bool(h.showAnnouncement, true),
    },
    footer: {
      groupOrder: Array.isArray(f.groupOrder)
        ? (f.groupOrder.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, 80)) as string[])
        : [],
      showNewsletter: bool(f.showNewsletter, true),
      showContact: bool(f.showContact, true),
      showSocial: bool(f.showSocial, true),
    },
    shop: {
      cols: pickNum(sh.cols, [2, 3, 4] as const, 3),
      colsMobile: pickNum(sh.colsMobile, [1, 2] as const, 2),
      gap: pick(sh.gap, ["sm", "md", "lg"] as const, "md"),
      showSearch: bool(sh.showSearch, true),
      showSort: bool(sh.showSort, true),
      showFilters: bool(sh.showFilters, true),
    },
    pdp: {
      stickyGallery: bool(pd.stickyGallery, true),
      relatedCols: pickNum(pd.relatedCols, [2, 3, 4] as const, 4),
    },
    cart: { showFreeShipNote: bool(ca.showFreeShipNote, true) },
  };
}

/** Deep-compare two docs (stable stringify). */
export function docsEqual(a: BuilderDoc, b: BuilderDoc): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Structural lint used by the health scanner (config-level problems). */
export function lintDoc(doc: BuilderDoc): Issue[] {
  const issues: Issue[] = [];
  const seen = new Map<string, number>();
  for (const s of doc.home) {
    seen.set(s.id, (seen.get(s.id) ?? 0) + 1);
  }
  for (const [id, n] of seen) {
    if (n > 1) {
      issues.push({
        id: `dup_${id}`, page: "home", sectionId: id, property: "id",
        severity: "error",
        message: `Duplicated section id "${id}" (${n}×).`,
        suggested: "Regenerate the duplicated ids.",
        fix: "dedupe-ids",
      });
    }
  }
  if (doc.home.length === 0) {
    issues.push({
      id: "empty_home", page: "home", property: "home",
      severity: "error",
      message: "Home page has no sections.",
      suggested: "Restore the default composition.",
      fix: "restore-default-home",
    });
  }
  if (!doc.home.some((s) => s.type === "hero" && s.enabled)) {
    issues.push({
      id: "no_hero", page: "home", property: "home",
      severity: "warning",
      message: "No enabled hero section on the homepage.",
      suggested: "Add or enable a hero section.",
    });
  }
  for (const s of doc.home) {
    const lib = LIBRARY_BY_TYPE.get(s.type);
    if (!lib) continue;
    const needsImage = ["hero", "editorial_image", "full_width_image", "image_text", "editorial_split", "lookbook"].includes(s.type);
    if (needsImage && !s.props.image && !(s.props.useCms && ["hero", "editorial_split"].includes(s.type))) {
      issues.push({
        id: `noimg_${s.id}`, page: "home", sectionId: s.id, sectionType: s.type, property: "props.image",
        severity: "warning",
        message: `Section "${lib.label}" has no image.`,
        suggested: "Pick an image from the media library.",
      });
    }
    if (needsImage && s.props.image && !s.props.alt) {
      issues.push({
        id: `alt_${s.id}`, page: "home", sectionId: s.id, sectionType: s.type, property: "props.alt",
        severity: "warning",
        message: `Section "${lib.label}" image is missing alt text.`,
        suggested: "Auto-fill alt text from the section title.",
        fix: "fill-alt",
      });
    }
    if (s.colors.overlayOpacity > 80) {
      issues.push({
        id: `ovl_${s.id}`, page: "home", sectionId: s.id, property: "colors.overlayOpacity",
        severity: "warning",
        message: "Overlay opacity above the safe maximum.",
        suggested: "Clamp to 80%.",
        fix: "clamp-overlay",
      });
    }
    const ctaMissing = (s.props.ctaText && !s.props.ctaLink) || (s.props.cta2Text && !s.props.cta2Link);
    if (ctaMissing) {
      issues.push({
        id: `cta_${s.id}`, page: "home", sectionId: s.id, property: "props.ctaLink",
        severity: "warning",
        message: "Button has text but no valid target link.",
        suggested: "Point it at /shop.",
        fix: "fix-cta",
      });
    }
    // unreadable combos: same bg + text or bg + heading
    const { bg, text, heading, buttonBg, buttonText } = s.colors;
    if (bg && text && bg.toLowerCase() === text.toLowerCase()) {
      issues.push({
        id: `con_${s.id}`, page: "home", sectionId: s.id, property: "colors.text",
        severity: "error",
        message: "Section text color equals its background — unreadable.",
        suggested: "Reset the text color to the theme ink.",
        fix: "fix-contrast",
      });
    }
    if (buttonBg && buttonText && buttonBg.toLowerCase() === buttonText.toLowerCase()) {
      issues.push({
        id: `conb_${s.id}`, page: "home", sectionId: s.id, property: "colors.buttonText",
        severity: "error",
        message: "Button text color equals button background — invisible CTA.",
        suggested: "Reset button colors.",
        fix: "fix-contrast",
      });
    }
    if (heading && bg && heading.toLowerCase() === bg.toLowerCase()) {
      issues.push({
        id: `conh_${s.id}`, page: "home", sectionId: s.id, property: "colors.heading",
        severity: "error",
        message: "Heading color equals section background — unreadable.",
        suggested: "Reset the heading color.",
        fix: "fix-contrast",
      });
    }
    if (s.layout.padY === "xl" && s.mobile.padY === "xl") {
      issues.push({
        id: `pad_${s.id}`, page: "home", sectionId: s.id, property: "layout.padY",
        severity: "warning",
        message: "Extra-large vertical padding on mobile creates excessive whitespace.",
        suggested: "Use md padding on mobile.",
        fix: "fix-mobile-padding",
      });
    }
  }
  return issues;
}
