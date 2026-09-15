/**
 * Per-storefront visual customization model.
 *
 * Every storefront keeps its own DEFAULT DESIGN (tokens in theme.css +
 * component markup). Admin overrides are stored per theme as a thin layer:
 *
 *   themeCustomizations: { noir: { fonts: {...}, colors: {...} }, ... }
 *
 * Only keys the admin actually changed are stored; everything else falls
 * through to the theme defaults. Resetting deletes the theme's entry.
 *
 * This module is shared by the server (validation + CSS generation) and the
 * admin UI (field metadata). It never touches business data.
 */

import type { ThemeId } from "./types";

/* ---------------------------------------------------------------------------
 * FONT CATALOG
 * Curated font choices. Project fonts are loaded via next/font in the root
 * layout (browsers only download binaries that are actually rendered); the
 * system stacks cost nothing.
 * ------------------------------------------------------------------------- */

export type FontCategory =
  | "latin-display"
  | "latin-body"
  | "arabic-display"
  | "arabic-body"
  | "system";

export type FontOption = {
  id: string;
  label: string;
  /** Full CSS font stack (variable + fallbacks). */
  stack: string;
  categories: FontCategory[];
};

const sys = (stack: string) => stack;

export const FONT_CATALOG: FontOption[] = [
  // ---- Project display faces ----------------------------------------------
  { id: "anton", label: "Anton — condensed poster", stack: "var(--font-anton), \"Arial Narrow\", sans-serif", categories: ["latin-display"] },
  { id: "archivo-black", label: "Archivo Black — heavy grotesque", stack: "var(--font-archivo-black), Arial, sans-serif", categories: ["latin-display"] },
  { id: "bebas-neue", label: "Bebas Neue — tall caps", stack: "var(--font-bebas-neue), \"Arial Narrow\", sans-serif", categories: ["latin-display"] },
  { id: "oswald", label: "Oswald — athletic condensed", stack: "var(--font-oswald), \"Arial Narrow\", sans-serif", categories: ["latin-display"] },
  { id: "syne", label: "Syne — art-fashion", stack: "var(--font-syne), sans-serif", categories: ["latin-display"] },
  { id: "playfair", label: "Playfair Display — high-contrast serif", stack: "var(--font-playfair-display), Georgia, serif", categories: ["latin-display"] },
  { id: "fraunces", label: "Fraunces — editorial serif", stack: "var(--font-fraunces), Georgia, serif", categories: ["latin-display", "latin-body"] },
  { id: "space-grotesk", label: "Space Grotesk — technical sans", stack: "var(--font-space-grotesk), var(--font-inter), sans-serif", categories: ["latin-display", "latin-body"] },
  // ---- Project body faces --------------------------------------------------
  { id: "inter", label: "Inter — neutral UI", stack: "var(--font-inter), ui-sans-serif, system-ui, sans-serif", categories: ["latin-body"] },
  { id: "manrope", label: "Manrope — rounded modern", stack: "var(--font-manrope), var(--font-inter), sans-serif", categories: ["latin-body"] },
  { id: "work-sans", label: "Work Sans — friendly grotesque", stack: "var(--font-work-sans), var(--font-inter), sans-serif", categories: ["latin-body"] },
  // ---- Arabic faces (never force Latin display onto Arabic) ---------------
  { id: "cairo", label: "Cairo — modern Arabic display", stack: "var(--font-cairo), Tahoma, sans-serif", categories: ["arabic-display", "arabic-body"] },
  { id: "tajawal", label: "Tajawal — clean Arabic body", stack: "var(--font-tajawal), Tahoma, sans-serif", categories: ["arabic-body", "arabic-display"] },
  { id: "amiri", label: "Amiri — classical Arabic serif", stack: "var(--font-amiri), \"Times New Roman\", serif", categories: ["arabic-display"] },
  { id: "noto-kufi", label: "Noto Kufi — geometric Kufic", stack: "var(--font-noto-kufi-arabic), Tahoma, sans-serif", categories: ["arabic-display"] },
  // ---- System stacks --------------------------------------------------------
  { id: "system-sans", label: "System sans", stack: sys("ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"), categories: ["latin-body", "latin-display", "system"] },
  { id: "system-serif", label: "System serif", stack: sys("ui-serif, Georgia, \"Times New Roman\", serif"), categories: ["latin-display", "latin-body", "system"] },
  { id: "system-mono", label: "System mono", stack: sys("ui-monospace, \"SF Mono\", Menlo, Consolas, monospace"), categories: ["latin-display", "latin-body", "system"] },
];

const FONT_BY_ID = new Map(FONT_CATALOG.map((f) => [f.id, f]));

/* ---------------------------------------------------------------------------
 * CUSTOMIZABLE FIELDS
 * ------------------------------------------------------------------------- */

/** Typography roles an admin can override per storefront. */
export const FONT_FIELDS = [
  "display", // headings / hero titles
  "body", // paragraphs & general UI
  "nav", // header navigation
  "button", // primary commerce buttons
  "productTitle", // product card titles
  "price", // prices
  "arabicDisplay", // Arabic headings (RTL only)
  "arabicBody", // Arabic body text (RTL only)
] as const;
export type FontField = (typeof FONT_FIELDS)[number];

/** Semantic color roles an admin can override per storefront. */
export const COLOR_FIELDS = [
  "bg", // page background
  "surface", // raised surfaces / newsletter & input panels
  "text", // primary text
  "textMuted", // secondary / muted text
  "accent", // accent (badges, highlights, eyebrows)
  "buttonBg", // primary commerce button background
  "buttonText", // primary commerce button label
  "border", // frames & hard borders
  "cardBg", // product-card surface
  "headerBg", // sticky header background
  "footerBg", // footer background
  "tickerBg", // announcement ticker background
  "tickerText", // announcement ticker text
  "heroOverlay", // hero overlay tint
] as const;
export type ColorField = (typeof COLOR_FIELDS)[number];

export type FontOverrides = Partial<Record<FontField, string>>;
export type ColorOverrides = Partial<Record<ColorField, string>>;

export type ThemeCustomization = {
  fonts: FontOverrides;
  colors: ColorOverrides;
};

export type ThemeCustomizationMap = Partial<Record<ThemeId, ThemeCustomization>>;

export const EMPTY_CUSTOMIZATION: ThemeCustomization = { fonts: {}, colors: {} };

/* ---------------------------------------------------------------------------
 * CSS VARIABLE MAPPING (the single source of truth for how an override
 * reaches the stylesheet)
 * ------------------------------------------------------------------------- */

export const FONT_FIELD_VARS: Record<FontField, string> = {
  display: "--rd-font-display",
  body: "--rd-font-sans",
  nav: "--rd-font-nav",
  button: "--rd-font-button",
  productTitle: "--rd-font-card",
  price: "--rd-font-price",
  arabicDisplay: "--rd-font-ar-display",
  arabicBody: "--rd-font-ar-body",
};

export const COLOR_FIELD_VARS: Record<ColorField, string> = {
  bg: "--rd-bone",
  surface: "--rd-brand-50",
  text: "--rd-ink",
  textMuted: "--rd-clay",
  accent: "--rd-amber",
  buttonBg: "--rd-btn-bg",
  buttonText: "--rd-btn-text",
  border: "--rd-border",
  cardBg: "--rd-card-bg",
  headerBg: "--rd-header-bg",
  footerBg: "--rd-footer-bg",
  tickerBg: "--rd-ticker-bg",
  tickerText: "--rd-ticker-fg",
  heroOverlay: "--rd-hero-overlay",
};

/* ---------------------------------------------------------------------------
 * VALIDATION (server-side; the admin UI reuses it for instant feedback)
 * ------------------------------------------------------------------------- */

const HEX_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
/** heroOverlay is stored as an RGB triplet "r g b" (0-255). */
const TRIPLET_RE = /^(\d{1,3}) (\d{1,3}) (\d{1,3})$/;

export function isValidHexColor(value: string): boolean {
  return HEX_RE.test(value.trim());
}

export function isValidRgbTriplet(value: string): boolean {
  const m = TRIPLET_RE.exec(value.trim());
  if (!m) return false;
  return m.slice(1).every((n) => Number(n) <= 255);
}

export function hexToTriplet(hex: string): string | null {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3 || h.length === 4) {
    h = h.split("").map((c) => c + c).join("");
  }
  if (h.length !== 6 && h.length !== 8) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return `${r} ${g} ${b}`;
}

/**
 * Sanitize an incoming customization payload. Unknown themes/fields are
 * dropped, invalid values are dropped — a bad payload can never corrupt the
 * storefront. Returns only well-formed overrides.
 */
export function sanitizeCustomization(input: unknown): ThemeCustomization {
  const out: ThemeCustomization = { fonts: {}, colors: {} };
  if (!input || typeof input !== "object") return out;
  const obj = input as Record<string, unknown>;

  const fonts = (obj.fonts && typeof obj.fonts === "object" ? obj.fonts : {}) as Record<string, unknown>;
  for (const field of FONT_FIELDS) {
    const v = fonts[field];
    if (typeof v === "string" && FONT_BY_ID.has(v.trim())) {
      out.fonts[field] = v.trim();
    }
  }

  const colors = (obj.colors && typeof obj.colors === "object" ? obj.colors : {}) as Record<string, unknown>;
  for (const field of COLOR_FIELDS) {
    const v = colors[field];
    if (typeof v !== "string") continue;
    const value = v.trim();
    if (field === "heroOverlay") {
      if (isValidRgbTriplet(value)) out.colors[field] = value;
      else if (isValidHexColor(value)) {
        const triplet = hexToTriplet(value);
        if (triplet) out.colors[field] = triplet;
      }
      continue;
    }
    if (isValidHexColor(value)) out.colors[field] = value.toLowerCase();
  }

  return out;
}

export function isEmptyCustomization(c: ThemeCustomization | undefined): boolean {
  if (!c) return true;
  return Object.keys(c.fonts).length === 0 && Object.keys(c.colors).length === 0;
}

/* ---------------------------------------------------------------------------
 * CSS GENERATION — the server renders this into a <style> tag scoped to the
 * theme's [data-theme] attribute. Zero client JS, zero extra requests.
 * ------------------------------------------------------------------------- */

export function customizationToCssVars(cust: ThemeCustomization | undefined): Record<string, string> {
  const vars: Record<string, string> = {};
  if (!cust) return vars;
  for (const [field, fontId] of Object.entries(cust.fonts)) {
    const option = FONT_BY_ID.get(fontId);
    if (option) vars[FONT_FIELD_VARS[field as FontField]] = option.stack;
  }
  for (const [field, value] of Object.entries(cust.colors)) {
    vars[COLOR_FIELD_VARS[field as ColorField]] = value;
  }
  return vars;
}

export function cssVarsToBlock(selector: string, vars: Record<string, string>): string {
  const entries = Object.entries(vars);
  if (entries.length === 0) return "";
  const body = entries.map(([k, v]) => `${k}: ${v};`).join(" ");
  return `${selector} { ${body} }`;
}
