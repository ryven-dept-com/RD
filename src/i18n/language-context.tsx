"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  localeDir,
  translate,
  type Locale,
} from "./translations";

type LanguageContextValue = {
  locale: Locale;
  dir: "rtl" | "ltr";
  setLocale: (locale: Locale) => void;
  /** Translate a UI key with optional {placeholder} values. */
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * Storefront language state (Phase 9).
 *
 * - The initial locale is read from the `rd-locale` cookie on the server so
 *   SSR output (including <html lang dir>) matches the visitor's choice.
 * - Switching the language persists the cookie (survives navigation and
 *   reloads) and flips the document direction immediately (AR = RTL).
 * - No /ar /fr /en URL prefixes — existing URLs and canonicals are untouched.
 */
export function LanguageProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // Keep <html lang dir> in sync after client-side switches.
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = localeDir(locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    } catch {
      // cookie blocked — preference stays for this session only
    }
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      dir: localeDir(locale),
      setLocale,
      t: (key, vars) => translate(locale, key, vars),
    }),
    [locale, setLocale],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    // Safe default outside the provider (server-only code paths).
    return {
      locale: DEFAULT_LOCALE,
      dir: localeDir(DEFAULT_LOCALE),
      setLocale: () => {},
      t: (key, vars) => translate(DEFAULT_LOCALE, key, vars),
    };
  }
  return ctx;
}

/** Convenience: translation function only. */
export function useT() {
  return useLanguage().t;
}
