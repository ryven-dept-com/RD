/**
 * RYVEN DEPT storefront theme system.
 *
 * One storefront, many art directions. A theme never touches data, queries,
 * business rules or tracking — it only controls presentation:
 *
 *   Theme Registry  →  Theme Definition (tokens + structural variants)
 *                   →  Theme Components (hero / cards / PDP / chrome)
 *                   →  Storefront (server-rendered with the active theme)
 *
 * The active theme id lives in the settings table (`activeTheme`), resolved
 * through the already memoized per-request getStoreSettings() — switching
 * themes adds ZERO extra database queries.
 */

export const THEME_IDS = [
  "noir",
  "concrete",
  "district",
  "nightshift",
  "archive",
  "signature",
  "seventh",
  "atelier",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

/** Structural archetype of the homepage hero. */
export type HeroVariant =
  | "cinematic" // NOIR: full-bleed image, oversized editorial type over it
  | "brutalist" // RAW CONCRETE: framed grid, oversized numbers, hard borders
  | "editorial" // DISTRICT: magazine split, campaign image + refined type
  | "immersive" // NIGHT SHIFT: dark cinematic stage with controlled glow
  | "catalog" // ARCHIVE: cream catalog cover with archive labels
  | "minimal" // SIGNATURE: vast whitespace, one photograph, whisper type
  | "pop" // BLOCK SEVEN: color-blocked pop stage with hard shadows
  | "lookbook"; // ATELIER: full-bleed campaign photo, centered editorial CTAs

/** Product-card archetype (markup + styling hooks). */
export type CardVariant =
  | "editorial" // image-first, captioned like a magazine still
  | "technical" // framed, indexed, with SKU/spec metadata lines
  | "classic" // balanced grid card (the district baseline)
  | "immersive" // dark stage, glow ring on hover, floating price
  | "catalog" // numbered archive entry with ledger rules
  | "luxury" // airy, tiny captions, massive whitespace
  | "sticker" // pop-framed card with offset shadow + sticker plate
  | "lookbook"; // hairline card: tall photo, badge pill, tabular price

/** PDP composition archetype. */
export type PdpVariant =
  | "cinematic" // huge image column, minimal info, sticky buy panel
  | "technical" // spec-sheet grid: numbered sections, rule lines
  | "editorial" // magazine column layout, generous captions
  | "immersive" // dark stage, imagery bleeds, glowing CTA
  | "catalog" // archive plate: framed image + catalog metadata
  | "luxury" // centered, vast whitespace, restrained controls
  | "drop" // pop drop-sheet: framed image, chunky plates, loud price
  | "lookbook"; // editorial spread: sticky gallery, hairline info column

export interface ThemeDefinition {
  id: ThemeId;
  /** Display name (admin panel). */
  name: string;
  /** One-line design direction (admin panel). */
  tagline: string;
  /** Longer art-direction note (admin panel + preview header). */
  description: string;
  /** Visual tags shown on the admin card. */
  tags: string[];
  hero: HeroVariant;
  card: CardVariant;
  pdp: PdpVariant;
  /** Swatches used to draw the admin preview card (never shipped to customers). */
  swatch: { bg: string; surface: string; fg: string; accent: string };
}

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}
