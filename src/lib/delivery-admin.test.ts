import { describe, expect, it } from "vitest";
import {
  DELIVERY_TRANSITIONS,
  daToCents,
  isKnownDeliveryStatus,
  isShippingMethod,
  isTerminalDeliveryStatus,
  isValidDeliveryTransition,
  quoteShipping,
  sanitizePrice,
  slugifyWilaya,
  validateZoneInput,
} from "./delivery-admin";

const ZONE = {
  enabled: true,
  homeEnabled: true,
  pickupEnabled: true,
  homePrice: 700,
  pickupPrice: 450,
  homeEstimatedTime: "2-4 أيام",
  pickupEstimatedTime: "1-3 أيام",
  estimatedTime: "2-4 أيام",
};

// Money units under test:
//  - zone prices (homePrice/pickupPrice) are WHOLE DZD, as stored in the
//    delivery_zones table and edited in the Admin Delivery panel;
//  - subtotals are INTEGER CENTS (the store-wide unit);
//  - the free-shipping threshold is a store SETTING in whole DZD;
//  - quoteShipping returns the fee in CENTS.
describe("shipping quote (server-side calculation)", () => {
  it("uses the zone's home price below the free-shipping threshold", () => {
    // 700 DA configured -> 70,000 cents quoted for a 50 DA (5,000 cents) cart.
    const q = quoteShipping(ZONE, "home", 5_000, 15_000);
    expect(q).toEqual({
      method: "home",
      shipping: 70_000,
      freeShipping: false,
      estimatedTime: "2-4 أيام",
    });
  });

  it("uses the zone's office price for pickup", () => {
    const q = quoteShipping(ZONE, "office", 5_000, 15_000);
    expect(q?.shipping).toBe(45_000);
    expect(q?.estimatedTime).toBe("1-3 أيام");
  });

  it("bureau ships free at exactly the 5,000 DA threshold (inclusive)", () => {
    // 5,000 DA = 500,000 cents.
    const q = quoteShipping(ZONE, "office", 500_000, 5_000);
    expect(q?.shipping).toBe(0);
    expect(q?.freeShipping).toBe(true);
  });

  it("bureau is NOT free one centime below the threshold", () => {
    const q = quoteShipping(ZONE, "office", 499_999, 5_000);
    expect(q?.shipping).toBe(45_000);
    expect(q?.freeShipping).toBe(false);
  });

  it("home delivery is NEVER free, even far above the threshold", () => {
    for (const subtotal of [500_000, 600_000, 1_000_000, 1_500_000, 10_000_000]) {
      const q = quoteShipping(ZONE, "home", subtotal, 5_000);
      expect(q?.shipping).toBe(70_000);
      expect(q?.freeShipping).toBe(false);
    }
  });

  it("free bureau shipping never resurrects an unavailable method", () => {
    expect(quoteShipping({ ...ZONE, pickupEnabled: false }, "office", 999_999_999, 5_000)).toBeNull();
    expect(quoteShipping({ ...ZONE, homeEnabled: false }, "home", 999_999_999, 5_000)).toBeNull();
    expect(quoteShipping({ ...ZONE, enabled: false }, "office", 999_999_999, 5_000)).toBeNull();
  });

  it("DHT scenario: 500/250 DA wilaya quotes exact prices below the threshold", () => {
    // Algiers-style zone configured at 500 DA home / 250 DA stop desk.
    // The old code compared cents >= DZD directly, quoting "Free" for every
    // realistic cart and hiding the configured prices.
    const algiers = { ...ZONE, homePrice: 500, pickupPrice: 250 };
    const home = quoteShipping(algiers, "home", 250_000, 5_000);
    const office = quoteShipping(algiers, "office", 250_000, 5_000);
    expect(home?.shipping).toBe(50_000);
    expect(home?.freeShipping).toBe(false);
    expect(office?.shipping).toBe(25_000);
    expect(office?.freeShipping).toBe(false);
  });

  it("DHT scenario at >=5,000 DA: home still paid, bureau free", () => {
    const algiers = { ...ZONE, homePrice: 500, pickupPrice: 250 };
    for (const subtotal of [500_000, 600_000, 1_000_000]) {
      const home = quoteShipping(algiers, "home", subtotal, 5_000);
      const office = quoteShipping(algiers, "office", subtotal, 5_000);
      expect(home?.shipping).toBe(50_000);
      expect(home?.freeShipping).toBe(false);
      expect(office?.shipping).toBe(0);
      expect(office?.freeShipping).toBe(true);
    }
  });

  it("rejects inactive zones", () => {
    expect(quoteShipping({ ...ZONE, enabled: false }, "home", 10_000, 15_000)).toBeNull();
  });

  it("rejects disabled methods", () => {
    expect(quoteShipping({ ...ZONE, homeEnabled: false }, "home", 10_000, 15_000)).toBeNull();
    expect(quoteShipping({ ...ZONE, pickupEnabled: false }, "office", 10_000, 15_000)).toBeNull();
  });

  it("falls back to the legacy estimate when a method estimate is empty", () => {
    const q = quoteShipping({ ...ZONE, homeEstimatedTime: "" }, "home", 10_000, 15_000);
    expect(q?.estimatedTime).toBe("2-4 أيام");
  });
});

describe("zone validation", () => {
  it("accepts a full valid payload", () => {
    const res = validateZoneInput(
      {
        code: 28,
        wilaya: "28 - المسيلة",
        homeEnabled: true,
        homePrice: "700",
        pickupEnabled: true,
        pickupPrice: 400,
      },
      { requireCode: true },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.zone.code).toBe(28);
      expect(res.zone.homePrice).toBe(700);
      expect(res.zone.pickupPrice).toBe(400);
      // Arabic wilaya names are kept readable in the slug.
      expect(res.zone.slug).toBe("28-المسيلة");
    }
  });

  it("requires a wilaya name", () => {
    const res = validateZoneInput({ code: 1, wilaya: "  " }, { requireCode: true });
    expect(res.ok).toBe(false);
  });

  it("rejects out-of-range wilaya codes", () => {
    expect(validateZoneInput({ code: 0, wilaya: "x" }, { requireCode: true }).ok).toBe(false);
    expect(validateZoneInput({ code: 59, wilaya: "x" }, { requireCode: true }).ok).toBe(false);
    expect(validateZoneInput({ code: 12.5, wilaya: "x" }, { requireCode: true }).ok).toBe(false);
  });

  it("requires at least one enabled shipping method", () => {
    const res = validateZoneInput(
      { code: 1, wilaya: "x", homeEnabled: false, pickupEnabled: false },
      { requireCode: true },
    );
    expect(res.ok).toBe(false);
  });

  it("sanitizes prices to non-negative integers", () => {
    expect(sanitizePrice(-5)).toBe(0);
    expect(sanitizePrice("abc")).toBe(0);
    expect(sanitizePrice(12.9)).toBe(12);
    expect(sanitizePrice("650")).toBe(650);
    expect(sanitizePrice(undefined, 7)).toBe(7);
  });

  it("converts whole-dinar zone prices to store cents exactly", () => {
    expect(daToCents(500)).toBe(50_000);
    expect(daToCents(250)).toBe(25_000);
    expect(daToCents(0)).toBe(0);
    // Never a negative or fractional-cent surprise.
    expect(daToCents(-3)).toBe(0);
    expect(daToCents(12.9)).toBe(1_200);
  });

  it("never accepts negative prices through zone validation", () => {
    const res = validateZoneInput(
      { code: 1, wilaya: "x", homePrice: -100, pickupEnabled: true, pickupPrice: -1 },
      { requireCode: true },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.zone.homePrice).toBe(0);
      expect(res.zone.pickupPrice).toBe(0);
    }
  });

  it("generates a deterministic slug", () => {
    expect(slugifyWilaya("Alger", 16)).toBe("alger");
    expect(slugifyWilaya("!!!", 3)).toBe("wilaya-3");
  });
});

describe("shipping method validation", () => {
  it("accepts home and office", () => {
    expect(isShippingMethod("home")).toBe(true);
    expect(isShippingMethod("office")).toBe(true);
  });
  it("rejects everything else", () => {
    expect(isShippingMethod("drone")).toBe(false);
    expect(isShippingMethod("")).toBe(false);
    expect(isShippingMethod(null)).toBe(false);
  });
});

describe("delivery status transitions", () => {
  it("allows the forward path", () => {
    expect(isValidDeliveryTransition("not_ready", "ready")).toBe(true);
    expect(isValidDeliveryTransition("ready", "handed_to_courier")).toBe(true);
    expect(isValidDeliveryTransition("handed_to_courier", "in_transit")).toBe(true);
    expect(isValidDeliveryTransition("in_transit", "delivered")).toBe(true);
  });

  it("allows returns from transit and after delivery", () => {
    expect(isValidDeliveryTransition("in_transit", "returned")).toBe(true);
    expect(isValidDeliveryTransition("delivered", "returned")).toBe(true);
  });

  it("rejects skips and backwards moves", () => {
    expect(isValidDeliveryTransition("not_ready", "in_transit")).toBe(false);
    expect(isValidDeliveryTransition("not_ready", "delivered")).toBe(false);
    expect(isValidDeliveryTransition("delivered", "in_transit")).toBe(false);
    expect(isValidDeliveryTransition("returned", "ready")).toBe(false);
  });

  it("treats same-status updates as no-ops", () => {
    for (const s of Object.keys(DELIVERY_TRANSITIONS)) {
      expect(isValidDeliveryTransition(s, s)).toBe(true);
    }
  });

  it("returned is terminal", () => {
    expect(isTerminalDeliveryStatus("returned")).toBe(true);
    expect(DELIVERY_TRANSITIONS.returned).toEqual([]);
  });

  it("rejects unknown statuses", () => {
    expect(isValidDeliveryTransition("nope", "ready")).toBe(false);
    expect(isValidDeliveryTransition("ready", "nope")).toBe(false);
    expect(isKnownDeliveryStatus("nope")).toBe(false);
  });
});
