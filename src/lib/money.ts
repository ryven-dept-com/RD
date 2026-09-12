/**
 * Phase 9 — centralized money formatting.
 *
 * All storefront prices are stored as INTEGER CENTS in the store currency
 * (DZD). This module is the single source of truth for turning amounts into
 * display strings; components must never concatenate currency symbols by
 * hand. Meta events, the catalog feed and order snapshots use the ISO code
 * (`isoCurrencyCode`), never these localized display strings.
 */

import type { Locale } from "@/i18n/translations";

const ISO_CODE_PATTERN = /^[A-Za-z]{3}$/;

/**
 * Normalize the configured currency into a valid ISO-4217 code. The store
 * setting historically holds a display symbol (دج) — anything that is not a
 * 3-letter code falls back to DZD, the store's real currency.
 */
export function isoCurrencyCode(configured: string | undefined | null): string {
  const c = (configured ?? "").trim();
  return ISO_CODE_PATTERN.test(c) ? c.toUpperCase() : "DZD";
}

/** Display symbol for the store currency, adapted to the UI language. */
export function currencySymbolFor(locale: Locale, code = "DZD"): string {
  if (code === "DZD") return locale === "ar" ? "دج" : "DA";
  return code;
}

function groupThousands(digits: string, separator: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

/**
 * Format an integer-cents amount for display.
 *  - deterministic integer arithmetic (no floating point artifacts, no NaN)
 *  - Arabic:  "1,500.00 دج"
 *  - French:  "1 500,00 DA"
 *  - English: "1,500.00 DA"
 */
export function formatMoney(cents: number, locale: Locale, code = "DZD"): string {
  const safe = Number.isFinite(cents) ? Math.round(cents) : 0;
  const sign = safe < 0 ? "-" : "";
  const abs = Math.abs(safe);
  const major = Math.floor(abs / 100);
  const minor = String(abs % 100).padStart(2, "0");
  const grouped = groupThousands(String(major), locale === "fr" ? " " : ",");
  const decimal = locale === "fr" ? "," : ".";
  return `${sign}${grouped}${decimal}${minor} ${currencySymbolFor(locale, code)}`;
}

/** Plain whole-unit amount (delivery configuration screens, no decimals). */
export function formatWholeMoney(amount: number, locale: Locale, code = "DZD"): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  const grouped = groupThousands(String(Math.abs(safe)), locale === "fr" ? " " : ",");
  return `${safe < 0 ? "-" : ""}${grouped} ${currencySymbolFor(locale, code)}`;
}
