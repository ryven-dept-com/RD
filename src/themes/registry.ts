import "server-only";
import type { ThemeDefinition, ThemeId } from "./types";
import { isThemeId } from "./types";

/**
 * Theme registry — the six production-ready storefront art directions.
 * Adding a theme later = one entry here + one CSS block + variant hooks;
 * nothing else in the application changes.
 */
export const THEMES: ThemeDefinition[] = [
  {
    id: "noir",
    name: "NOIR DEPT",
    tagline: "Dark luxury streetwear",
    description:
      "Almost-black canvas, oversized editorial typography, cinematic imagery and asymmetric compositions. A premium fashion-magazine atmosphere where the product is the headline.",
    tags: ["dark", "editorial", "cinematic", "oversized type", "asymmetric"],
    hero: "cinematic",
    card: "editorial",
    pdp: "cinematic",
    swatch: { bg: "#0a0a0b", surface: "#131315", fg: "#f2efe8", accent: "#c9a86a" },
  },
  {
    id: "concrete",
    name: "RAW CONCRETE",
    tagline: "Industrial underground streetwear",
    description:
      "Brutalist monochrome with hard borders, oversized index numbers and technical spec lines. The grid is exposed, the layout is raw, the attitude is underground.",
    tags: ["brutalist", "monochrome", "technical", "hard borders", "indexed"],
    hero: "brutalist",
    card: "technical",
    pdp: "technical",
    swatch: { bg: "#d8d6d1", surface: "#c7c4be", fg: "#111113", accent: "#e33f1e" },
  },
  {
    id: "district",
    name: "DISTRICT",
    tagline: "Modern urban fashion editorial",
    description:
      "Clean neutrals, confident black typography and magazine-style layouts with large whitespace. The house look of RYVEN DEPT — a premium fashion catalog, conversion-focused.",
    tags: ["light", "editorial", "catalog", "whitespace", "house look"],
    hero: "editorial",
    card: "classic",
    pdp: "editorial",
    swatch: { bg: "#f4f1ea", surface: "#e7e5df", fg: "#0a0a0b", accent: "#e0a04d" },
  },
  {
    id: "nightshift",
    name: "NIGHT SHIFT",
    tagline: "Futuristic nighttime streetwear",
    description:
      "A dark cinematic environment with a controlled electric accent and subtle glow. Fashion-first and sophisticated — the city at 2AM, not an arcade.",
    tags: ["dark", "futuristic", "controlled glow", "immersive", "technical-fashion"],
    hero: "immersive",
    card: "immersive",
    pdp: "immersive",
    swatch: { bg: "#07080d", surface: "#0e1017", fg: "#e8eaf2", accent: "#6de0c8" },
  },
  {
    id: "archive",
    name: "ARCHIVE",
    tagline: "Vintage streetwear / fashion archive",
    description:
      "Cream paper, ledger rules, archive labels and editorial serif accents. An old-school catalog feeling executed with a modern grid — every piece catalogued like a museum item.",
    tags: ["cream", "vintage", "serif", "archive labels", "catalog"],
    hero: "catalog",
    card: "catalog",
    pdp: "catalog",
    swatch: { bg: "#efe8da", surface: "#e4dbc8", fg: "#1c1a16", accent: "#8a4b2a" },
  },
  {
    id: "signature",
    name: "SIGNATURE",
    tagline: "Ultra-premium minimalist fashion",
    description:
      "Extreme restraint: massive whitespace, sophisticated typography, large photography and subtle motion. The product breathes; the interface disappears.",
    tags: ["minimal", "luxury", "whitespace", "serif accents", "restrained"],
    hero: "minimal",
    card: "luxury",
    pdp: "luxury",
    swatch: { bg: "#fbfaf7", surface: "#f1efe9", fg: "#141414", accent: "#141414" },
  },
];

/** Default storefront theme when the setting is missing/invalid. */
export const DEFAULT_THEME_ID: ThemeId = "district";

const BY_ID = new Map<ThemeId, ThemeDefinition>(THEMES.map((t) => [t.id, t]));

export function getTheme(id: unknown): ThemeDefinition {
  if (isThemeId(id)) {
    const theme = BY_ID.get(id);
    if (theme) return theme;
  }
  return BY_ID.get(DEFAULT_THEME_ID)!;
}

/** Admin preview token pair lives in admin-auth (single secret owner). */
export const THEME_PREVIEW_COOKIE = "rd_theme_preview";
export const THEME_PREVIEW_PARAM = "rd_theme";
export const THEME_PREVIEW_CLEAR_PARAM = "rd_theme_clear";
/** Preview cookies are short-lived by design (admin walkthroughs only). */
export const THEME_PREVIEW_MAX_AGE_SECONDS = 60 * 60 * 4;

/** Cookie value format: `${themeId}:${token}` — validated server-side. */
export function parsePreviewCookie(value: string | undefined): { themeId: string; token: string } | null {
  if (!value) return null;
  const idx = value.indexOf(":");
  if (idx <= 0) return null;
  return { themeId: value.slice(0, idx), token: value.slice(idx + 1) };
}
