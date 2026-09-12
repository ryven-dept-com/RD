"use client";

import { type Locale } from "@/i18n/translations";
import { useLanguage } from "@/i18n/language-context";

const LABELS: Record<Locale, string> = {
  ar: "العربية",
  fr: "FR",
  en: "EN",
};

/**
 * Visual order of the switcher. The pill is pinned to LTR (`dir="ltr"` on
 * the group) so the sequence reads EN | FR | العربية on every page —
 * including RTL Arabic views, where a reversed pill would look accidental.
 */
const DISPLAY_ORDER: Locale[] = ["en", "fr", "ar"];

/**
 * Compact, keyboard-accessible language switcher (Phase 9). Inherits the
 * surrounding text color so it works on both the transparent hero navbar
 * and the solid scrolled state. Shared by the storefront and the admin
 * header — both live under the root LanguageProvider.
 */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useLanguage();

  return (
    <div
      dir="ltr"
      role="group"
      aria-label={t("nav.language")}
      className={`flex items-center rounded-full border border-current/25 ${compact ? "" : "px-1 py-0.5"}`}
    >
      {DISPLAY_ORDER.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          aria-label={LABELS[l]}
          className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wide transition-opacity ${
            locale === l ? "opacity-100 underline underline-offset-4" : "opacity-55 hover:opacity-90"
          }`}
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  );
}
