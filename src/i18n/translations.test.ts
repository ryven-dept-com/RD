import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_COOKIE,
  TRANSLATIONS,
  isLocale,
  localeDir,
  localeTag,
  resolveLocale,
  translate,
  type Locale,
} from "./translations";

describe("dictionary parity", () => {
  const [first, ...rest] = LOCALES;
  const baseKeys = Object.keys(TRANSLATIONS[first]).sort();

  it("supports exactly ar/fr/en with English default", () => {
    expect([...LOCALES].sort()).toEqual(["ar", "en", "fr"]);
    expect(DEFAULT_LOCALE).toBe("en");
    expect(LOCALE_COOKIE).toBe("rd-locale");
  });

  it("every locale has the identical key set", () => {
    for (const locale of rest) {
      const keys = Object.keys(TRANSLATIONS[locale]).sort();
      expect(keys, `keys differ for ${locale}`).toEqual(baseKeys);
    }
  });

  it("no key has an empty value in any locale", () => {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(TRANSLATIONS[locale])) {
        expect(value.trim(), `${locale}.${key} is empty`).not.toBe("");
      }
    }
  });

  it("placeholder variables match across locales", () => {
    const placeholders = (v: string) =>
      [...v.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
    for (const key of baseKeys) {
      const base = placeholders(TRANSLATIONS[first][key]);
      for (const locale of rest) {
        expect(placeholders(TRANSLATIONS[locale][key]), `${locale}.${key}`).toBe(
          base,
        );
      }
    }
  });
});

describe("resolveLocale / localeDir / localeTag", () => {
  it("accepts supported locales case-insensitively", () => {
    expect(resolveLocale("ar")).toBe("ar");
    expect(resolveLocale("FR")).toBe("fr");
    expect(resolveLocale("  en  ")).toBe("en");
  });

  it("falls back to the default for unknown/empty values", () => {
    expect(resolveLocale("de")).toBe(DEFAULT_LOCALE);
    expect(resolveLocale("")).toBe(DEFAULT_LOCALE);
    expect(resolveLocale(null)).toBe(DEFAULT_LOCALE);
    expect(resolveLocale(undefined)).toBe(DEFAULT_LOCALE);
  });

  it("only Arabic is RTL", () => {
    expect(localeDir("ar")).toBe("rtl");
    expect(localeDir("fr")).toBe("ltr");
    expect(localeDir("en")).toBe("ltr");
  });

  it("maps locales to stable Intl tags", () => {
    expect(localeTag("en")).toBe("en-US");
    expect(localeTag("fr")).toBe("fr-FR");
    expect(localeTag("ar")).toBe("ar-DZ-u-ca-gregory-nu-latn");
  });

  it("isLocale type-guards arbitrary input", () => {
    expect(isLocale("ar")).toBe(true);
    expect(isLocale("zz")).toBe(false);
    expect(isLocale(42)).toBe(false);
  });
});

describe("translate", () => {
  it("returns the localized string", () => {
    expect(translate("en", "cart.title")).toBe("Your Bag");
    expect(translate("fr", "cart.title")).toBe("Votre panier");
    expect(translate("ar", "cart.title")).toBe("سلتك");
  });

  it("substitutes {placeholders}", () => {
    const out = translate("en", "product.colors", { count: 3 });
    expect(out).toBe("3 colors");
    expect(out).not.toContain("{count}");
  });

  it("leaves unmatched placeholders intact", () => {
    expect(translate("en", "product.colors")).toBe("{count} colors");
  });

  it("falls back to English for keys missing in a locale", () => {
    const dict = TRANSLATIONS.fr as Record<string, string>;
    const someEnOnlyKey = Object.keys(TRANSLATIONS.en).find(
      (k) => !(k in dict),
    );
    if (someEnOnlyKey) {
      expect(translate("fr", someEnOnlyKey)).toBe(TRANSLATIONS.en[someEnOnlyKey]);
    }
    // Unknown keys resolve to the key itself (never crash / never blank).
    expect(translate("ar", "does.not.exist")).toBe("does.not.exist");
  });

  it("renders RTL content with Arabic characters", () => {
    expect(translate("ar", "cart.empty")).toMatch(/[\u0600-\u06FF]/);
  });

  it("keeps the checkout field labels translated in all locales", () => {
    for (const locale of LOCALES as readonly Locale[]) {
      for (const key of [
        "checkout.fullName",
        "checkout.phone",
        "checkout.wilayaLabel",
        "checkout.commune",
        "checkout.title",
      ]) {
        expect(TRANSLATIONS[locale][key], `${locale}.${key}`).toBeTruthy();
      }
    }
  });
});
