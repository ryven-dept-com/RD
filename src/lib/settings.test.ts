import { describe, expect, it } from "vitest";
import {
  SENSITIVE_SETTING_KEYS,
  SETTING_DEFS,
  validateSetting,
} from "./settings";

describe("settings registry", () => {
  it("registers the Meta Ads keys", () => {
    for (const key of [
      "metaPixelId",
      "metaPixelEnabled",
      "pixelEventPageView",
      "pixelEventViewContent",
      "pixelEventAddToCart",
      "pixelEventInitiateCheckout",
      "pixelEventPurchase",
      "metaCapiEnabled",
      "metaCapiAccessToken",
      "metaCapiTestEventCode",
    ]) {
      expect(SETTING_DEFS[key], `missing ${key}`).toBeDefined();
    }
  });

  it("classifies the Conversions API token as sensitive", () => {
    expect(SENSITIVE_SETTING_KEYS.has("metaCapiAccessToken")).toBe(true);
    expect(SENSITIVE_SETTING_KEYS.has("storeName")).toBe(false);
  });
});

describe("validateSetting", () => {
  it("accepts a numeric Pixel ID and rejects anything else", () => {
    expect(validateSetting("metaPixelId", "123456789012345")).toEqual({
      ok: true,
      value: "123456789012345",
    });
    expect(validateSetting("metaPixelId", "abc").ok).toBe(false);
    expect(validateSetting("metaPixelId", "12 34").ok).toBe(false);
  });

  it("rejects unsafe URLs for branding fields", () => {
    expect(validateSetting("logoUrl", "javascript:alert(1)").ok).toBe(false);
    expect(validateSetting("ogImageUrl", "data:text/html,x").ok).toBe(false);
    expect(validateSetting("faviconUrl", "/api/media/3")).toEqual({
      ok: true,
      value: "/api/media/3",
    });
    expect(validateSetting("canonicalUrl", "https://ryven.dz/")).toEqual({
      ok: true,
      value: "https://ryven.dz/",
    });
  });

  it("validates the secret token: no spaces, bounded length", () => {
    const ok = validateSetting("metaCapiAccessToken", "EAABxyz123");
    expect(ok).toEqual({ ok: true, value: "EAABxyz123" });
    expect(validateSetting("metaCapiAccessToken", "has space").ok).toBe(false);
    expect(validateSetting("metaCapiAccessToken", "x".repeat(501)).ok).toBe(false);
    expect(validateSetting("metaCapiAccessToken", "")).toEqual({ ok: true, value: "" });
  });

  it("rejects unknown keys", () => {
    expect(validateSetting("notAKey", "x").ok).toBe(false);
  });

  it("coerces booleans", () => {
    expect(validateSetting("metaCapiEnabled", "true")).toEqual({ ok: true, value: "true" });
    expect(validateSetting("metaCapiEnabled", "nope").ok).toBe(false);
  });
});
