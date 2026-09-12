import { describe, expect, it } from "vitest";
import {
  currencySymbolFor,
  formatMoney,
  formatWholeMoney,
  isoCurrencyCode,
} from "./money";

describe("isoCurrencyCode", () => {
  it("maps the legacy display symbol to the ISO code", () => {
    expect(isoCurrencyCode("دج")).toBe("DZD");
  });

  it("uppercases valid 3-letter codes", () => {
    expect(isoCurrencyCode("usd")).toBe("USD");
    expect(isoCurrencyCode("eur")).toBe("EUR");
    expect(isoCurrencyCode("DZD")).toBe("DZD");
  });

  it("falls back to DZD for empty/invalid input", () => {
    expect(isoCurrencyCode("")).toBe("DZD");
    expect(isoCurrencyCode("   ")).toBe("DZD");
    expect(isoCurrencyCode("$")).toBe("DZD");
    expect(isoCurrencyCode("DA")).toBe("DZD");
    expect(isoCurrencyCode(null)).toBe("DZD");
    expect(isoCurrencyCode(undefined)).toBe("DZD");
  });
});

describe("currencySymbolFor", () => {
  it("localizes the DZD symbol per language", () => {
    expect(currencySymbolFor("ar")).toBe("دج");
    expect(currencySymbolFor("fr")).toBe("DA");
    expect(currencySymbolFor("en")).toBe("DA");
  });

  it("keeps non-DZD ISO codes verbatim", () => {
    expect(currencySymbolFor("ar", "EUR")).toBe("EUR");
    expect(currencySymbolFor("en", "USD")).toBe("USD");
  });
});

describe("formatMoney", () => {
  it("formats golden values per locale (cents input)", () => {
    expect(formatMoney(150000, "en")).toBe("1,500.00 DA");
    expect(formatMoney(150000, "fr")).toBe("1 500,00 DA");
    expect(formatMoney(150000, "ar")).toBe("1,500.00 دج");
  });

  it("handles small and zero amounts", () => {
    expect(formatMoney(0, "en")).toBe("0.00 DA");
    expect(formatMoney(99, "en")).toBe("0.99 DA");
    expect(formatMoney(5, "fr")).toBe("0,05 DA");
    expect(formatMoney(100, "ar")).toBe("1.00 دج");
  });

  it("is deterministic integer arithmetic (no float artifacts)", () => {
    // 19.99 DZD = 1999 cents; classic float trap 19.99 * 100 = 1998.999…
    expect(formatMoney(1999, "en")).toBe("19.99 DA");
    expect(formatMoney(100000001, "en")).toBe("1,000,000.01 DA");
  });

  it("never emits NaN or floating artifacts for bad input", () => {
    expect(formatMoney(Number.NaN, "en")).toBe("0.00 DA");
    expect(formatMoney(Number.POSITIVE_INFINITY, "en")).toBe("0.00 DA");
  });

  it("rounds fractional cents instead of corrupting output", () => {
    expect(formatMoney(150000.4, "en")).toBe("1,500.00 DA");
    expect(formatMoney(150000.6, "en")).toBe("1,500.01 DA");
  });
});

describe("formatWholeMoney", () => {
  it("formats whole-unit amounts without decimals", () => {
    expect(formatWholeMoney(15000, "en")).toBe("15,000 DA");
    expect(formatWholeMoney(15000, "fr")).toBe("15 000 DA");
    expect(formatWholeMoney(15000, "ar")).toBe("15,000 دج");
  });

  it("is safe for non-finite input", () => {
    expect(formatWholeMoney(Number.NaN, "en")).toBe("0 DA");
  });
});
