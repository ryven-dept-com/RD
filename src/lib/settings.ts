import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { memoizePerRequest } from "@/lib/cache";
import {
  sanitizeCustomization,
  type ThemeCustomizationMap,
} from "@/themes/customize";
import { isThemeId } from "@/themes/types";

// ---------------------------------------------------------------------------
// Central settings service (Phase 3).
//
// The `settings` table is the single persistent source of truth for every
// store configuration value. Reads always fall back to per-key defaults so a
// missing row can never blank the storefront; writes go through
// `applySettingsPatch`, which validates every key server-side and only
// updates keys that are actually present in the request (partial-patch
// semantics — the Phase 2 bug where absent keys were silently overwritten
// with empty strings is structurally impossible now).
// ---------------------------------------------------------------------------

export type SettingKind = "text" | "email" | "url" | "int" | "bool" | "pixelId" | "secret";

export type SettingDef = {
  kind: SettingKind;
  /** Maximum length for string values. */
  max?: number;
  /** Value used when no row exists. */
  defaultValue: string;
  /** Human label used in validation error messages. */
  label: string;
};

export const SETTING_DEFS: Record<string, SettingDef> = {
  // ---- Store ----
  storeName: { kind: "text", max: 60, defaultValue: "RUVEN DEPT", label: "Store name" },
  contactEmail: { kind: "email", max: 200, defaultValue: "", label: "Contact email" },
  contactPhone: { kind: "text", max: 40, defaultValue: "", label: "Contact phone" },
  address: { kind: "text", max: 200, defaultValue: "", label: "Address" },
  currency: { kind: "text", max: 8, defaultValue: "دج", label: "Currency symbol" },

  // ---- Checkout ----
  checkoutEnabled: { kind: "bool", defaultValue: "true", label: "Checkout enabled" },
  codEnabled: { kind: "bool", defaultValue: "true", label: "Cash on Delivery" },
  freeShippingThreshold: { kind: "int", defaultValue: "5000", label: "Free shipping threshold" },
  activeTheme: { kind: "text", max: 30, defaultValue: "district", label: "Active storefront theme" },
  // Per-storefront visual overrides (fonts + colors), stored as sanitized
  // JSON — written only by the themes customization API after server-side
  // validation. Presentation-only: never read by business logic.
  themeCustomizations: { kind: "text", max: 20000, defaultValue: "{}", label: "Theme customizations" },
  minOrderAmount: { kind: "int", defaultValue: "0", label: "Minimum order amount" },
  requirePhone: { kind: "bool", defaultValue: "false", label: "Require phone" },
  requireAddress: { kind: "bool", defaultValue: "true", label: "Require address" },

  // ---- Branding / SEO ----
  seoTitle: { kind: "text", max: 120, defaultValue: "", label: "Site title" },
  seoDescription: { kind: "text", max: 300, defaultValue: "", label: "Meta description" },
  seoKeywords: { kind: "text", max: 300, defaultValue: "", label: "SEO keywords" },
  canonicalUrl: { kind: "url", max: 500, defaultValue: "", label: "Canonical URL" },
  robotsIndex: { kind: "bool", defaultValue: "true", label: "Search engine indexing" },
  logoUrl: { kind: "url", max: 500, defaultValue: "", label: "Logo" },
  faviconUrl: { kind: "url", max: 500, defaultValue: "", label: "Favicon" },
  ogImageUrl: { kind: "url", max: 500, defaultValue: "", label: "Social sharing image" },

  // ---- Social ----
  instagramUrl: { kind: "url", max: 500, defaultValue: "", label: "Instagram" },
  tiktokUrl: { kind: "url", max: 500, defaultValue: "", label: "TikTok" },
  facebookUrl: { kind: "url", max: 500, defaultValue: "", label: "Facebook" },

  // ---- Marketing / Meta Pixel ----
  metaPixelId: { kind: "pixelId", defaultValue: "", label: "Meta Pixel ID" },
  metaPixelEnabled: { kind: "bool", defaultValue: "false", label: "Meta Pixel enabled" },
  pixelEventPageView: { kind: "bool", defaultValue: "true", label: "PageView event" },
  pixelEventViewContent: { kind: "bool", defaultValue: "true", label: "ViewContent event" },
  pixelEventAddToCart: { kind: "bool", defaultValue: "false", label: "AddToCart event" },
  pixelEventInitiateCheckout: { kind: "bool", defaultValue: "true", label: "InitiateCheckout event" },
  pixelEventPurchase: { kind: "bool", defaultValue: "true", label: "Purchase event" },

  // ---- Meta Conversions API (server-side). The access token is a SECRET:
  // it is stored server-side only and never returned by any API or page.
  metaCapiEnabled: { kind: "bool", defaultValue: "false", label: "Meta Conversions API" },
  metaCapiAccessToken: { kind: "secret", max: 500, defaultValue: "", label: "Conversions API access token" },
  metaCapiTestEventCode: { kind: "text", max: 40, defaultValue: "", label: "Test event code" },
};

/**
 * Keys holding secrets. They can be written through the settings API but
 * are NEVER echoed back in responses, page props, or client state.
 */
export const SENSITIVE_SETTING_KEYS: ReadonlySet<string> = new Set([
  "metaCapiAccessToken",
]);

export const SETTING_KEYS = Object.keys(SETTING_DEFS);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PIXEL_ID_RE = /^\d{1,30}$/;

/**
 * Allow only safe absolute http(s) URLs, relative site paths, or media URLs.
 * Rejects javascript:, data:, vbscript: and any other scheme — this is what
 * makes SEO/social/branding URLs safe against script injection.
 */
function sanitizeSafeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "";
  if (value.startsWith("/")) {
    // Internal path only — never protocol-relative ("//evil.com").
    if (value.startsWith("//")) return null;
    return value.slice(0, 500);
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString().slice(0, 500);
  } catch {
    return null;
  }
}

export type ValidationResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

/** Server-side validation for a single settings key. */
export function validateSetting(key: string, raw: unknown): ValidationResult {
  const def = SETTING_DEFS[key];
  if (!def) return { ok: false, error: `Unknown setting: ${key}` };

  const value = String(raw ?? "").trim();

  switch (def.kind) {
    case "text": {
      if (value.length > (def.max ?? 500)) {
        return { ok: false, error: `${def.label}: too long (max ${def.max} characters)` };
      }
      return { ok: true, value };
    }
    case "email": {
      if (value && !EMAIL_RE.test(value)) {
        return { ok: false, error: `${def.label}: invalid email address` };
      }
      if (value.length > (def.max ?? 200)) {
        return { ok: false, error: `${def.label}: too long` };
      }
      return { ok: true, value };
    }
    case "url": {
      const safe = sanitizeSafeUrl(value);
      if (safe === null) {
        return { ok: false, error: `${def.label}: unsafe or invalid URL (only http/https links or media paths are allowed)` };
      }
      return { ok: true, value: safe };
    }
    case "int": {
      if (!value) return { ok: true, value: "" };
      if (!/^\d+$/.test(value)) {
        return { ok: false, error: `${def.label}: must be a whole number (0 or more)` };
      }
      const n = Number(value);
      if (n > 1_000_000_000) {
        return { ok: false, error: `${def.label}: value is too large` };
      }
      return { ok: true, value: String(n) };
    }
    case "bool": {
      if (value === "" || value === "true" || value === "false") {
        return { ok: true, value: value === "" ? def.defaultValue : value };
      }
      return { ok: false, error: `${def.label}: must be true or false` };
    }
    case "pixelId": {
      if (value && !PIXEL_ID_RE.test(value)) {
        return { ok: false, error: `${def.label}: must be a numeric Pixel ID` };
      }
      return { ok: true, value };
    }
    case "secret": {
      if (value && /\s/.test(value)) {
        return { ok: false, error: `${def.label}: must not contain spaces` };
      }
      if (value.length > (def.max ?? 500)) {
        return { ok: false, error: `${def.label}: too long` };
      }
      return { ok: true, value };
    }
  }
}

/** Read the full settings table as a plain key/value map. */
export async function getSettingsMap(): Promise<Record<string, string>> {
  const rows = await db.select().from(settings);
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

export type PatchResult =
  | { ok: true; saved: Record<string, string> }
  | { ok: false; errors: string[] };

/**
 * Persist a settings patch. Only keys present in `patch` are validated and
 * written — keys that are absent are left untouched. All values are
 * validated up-front; if any is invalid nothing is written.
 */
export async function applySettingsPatch(
  patch: Record<string, unknown>,
): Promise<PatchResult> {
  const updates: Array<{ key: string; value: string }> = [];
  const errors: string[] = [];

  for (const [key, raw] of Object.entries(patch)) {
    const result = validateSetting(key, raw);
    if (result.ok) {
      updates.push({ key, value: result.value });
    } else {
      errors.push(result.error);
    }
  }

  if (errors.length) return { ok: false, errors };

  for (const { key, value } of updates) {
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: sql`excluded.value` },
      });
  }

  // Return the authoritative stored map so clients can re-sync from the
  // database instead of trusting their own local state. Secrets are
  // stripped — they must never travel back to the browser.
  const saved = await getSettingsMap();
  for (const key of SETTING_KEYS) {
    saved[key] ??= SETTING_DEFS[key].defaultValue;
  }
  for (const key of SENSITIVE_SETTING_KEYS) {
    delete saved[key];
  }
  return { ok: true, saved };
}

/**
 * Server-only accessor for secret settings (e.g. the Conversions API
 * access token). Deliberately NOT part of getStoreSettings()/the typed
 * storefront view so it cannot leak into client props.
 */
export async function getSettingSecret(key: string): Promise<string> {
  if (!SENSITIVE_SETTING_KEYS.has(key)) {
    throw new Error(`getSettingSecret called on non-secret key: ${key}`);
  }
  const map = await getSettingsMap();
  return (map[key] ?? "").trim();
}

// ---------------------------------------------------------------------------
// Typed storefront view. Every consumer of store configuration (checkout,
// metadata, footer, pixel) reads through this single function.
// ---------------------------------------------------------------------------

export type PixelEvents = {
  pageView: boolean;
  viewContent: boolean;
  addToCart: boolean;
  initiateCheckout: boolean;
  purchase: boolean;
};

export type StoreSettings = {
  // store
  storeName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  currency: string;
  // checkout
  checkoutEnabled: boolean;
  codEnabled: boolean;
  freeShippingThreshold: number;
  /** Active storefront theme id (validated against the theme registry). */
  activeTheme: string;
  /**
   * Per-storefront typography/color overrides (presentation only). Always a
   * sanitized map — corrupt or hostile JSON degrades to "no overrides".
   */
  themeCustomizations: ThemeCustomizationMap;
  minOrderAmount: number;
  requirePhone: boolean;
  requireAddress: boolean;
  // branding / seo
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  canonicalUrl: string;
  robotsIndex: boolean;
  logoUrl: string;
  faviconUrl: string;
  ogImageUrl: string;
  // social
  instagramUrl: string;
  tiktokUrl: string;
  facebookUrl: string;
  // marketing
  metaPixelEnabled: boolean;
  metaPixelId: string;
  pixelEvents: PixelEvents;
  metaCapiEnabled: boolean;
  metaCapiTestEventCode: string;
};

function bool(map: Record<string, string>, key: string): boolean {
  const raw = map[key] ?? SETTING_DEFS[key].defaultValue;
  return raw !== "false";
}

function int(map: Record<string, string>, key: string): number {
  const raw = (map[key] ?? SETTING_DEFS[key].defaultValue).trim();
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : Number(SETTING_DEFS[key].defaultValue);
}


/**
 * Parse the stored theme-customization JSON defensively. Anything malformed,
 * any unknown theme id, any invalid font/color value is dropped — the worst
 * case is "theme renders with its defaults", never a broken storefront.
 */
function parseThemeCustomizations(raw: string | undefined): ThemeCustomizationMap {
  const out: ThemeCustomizationMap = {};
  if (!raw || !raw.trim()) return out;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return out;
    for (const [themeId, cust] of Object.entries(parsed as Record<string, unknown>)) {
      if (!isThemeId(themeId)) continue;
      const clean = sanitizeCustomization(cust);
      if (Object.keys(clean.fonts).length || Object.keys(clean.colors).length) {
        out[themeId] = clean;
      }
    }
  } catch {
    // corrupt JSON → no overrides
  }
  return out;
}

/**
 * Hot path: every public page renders against store settings (layout,
 * footer, checkout, product pages). Memoized per request so one page load
 * issues this query once instead of once per component — but never cached
 * across requests, so admin edits are visible on the very next page load.
 */
export const getStoreSettings = memoizePerRequest(loadStoreSettings);

async function loadStoreSettings(): Promise<StoreSettings> {
  const map = await getSettingsMap();
  const str = (key: string): string =>
    (map[key] ?? "").trim() || SETTING_DEFS[key].defaultValue;

  return {
    storeName: str("storeName"),
    contactEmail: (map.contactEmail ?? "").trim(),
    contactPhone: (map.contactPhone ?? "").trim(),
    address: (map.address ?? "").trim(),
    currency: str("currency"),
    checkoutEnabled: bool(map, "checkoutEnabled"),
    codEnabled: bool(map, "codEnabled"),
    freeShippingThreshold: int(map, "freeShippingThreshold"),
    activeTheme: str("activeTheme"),
    themeCustomizations: parseThemeCustomizations(map.themeCustomizations),
    minOrderAmount: int(map, "minOrderAmount"),
    requirePhone: bool(map, "requirePhone"),
    requireAddress: bool(map, "requireAddress"),
    seoTitle: (map.seoTitle ?? "").trim(),
    seoDescription: (map.seoDescription ?? "").trim(),
    seoKeywords: (map.seoKeywords ?? "").trim(),
    canonicalUrl: (map.canonicalUrl ?? "").trim(),
    robotsIndex: bool(map, "robotsIndex"),
    logoUrl: (map.logoUrl ?? "").trim(),
    faviconUrl: (map.faviconUrl ?? "").trim(),
    ogImageUrl: (map.ogImageUrl ?? "").trim(),
    instagramUrl: (map.instagramUrl ?? "").trim(),
    tiktokUrl: (map.tiktokUrl ?? "").trim(),
    facebookUrl: (map.facebookUrl ?? "").trim(),
    metaPixelEnabled: bool(map, "metaPixelEnabled"),
    metaPixelId: (map.metaPixelId ?? "").trim(),
    metaCapiEnabled: bool(map, "metaCapiEnabled"),
    metaCapiTestEventCode: (map.metaCapiTestEventCode ?? "").trim(),
    pixelEvents: {
      pageView: bool(map, "pixelEventPageView"),
      viewContent: bool(map, "pixelEventViewContent"),
      addToCart: bool(map, "pixelEventAddToCart"),
      initiateCheckout: bool(map, "pixelEventInitiateCheckout"),
      purchase: bool(map, "pixelEventPurchase"),
    },
  };
}
