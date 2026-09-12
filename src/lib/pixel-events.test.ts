import { describe, expect, it, vi } from "vitest";
import {
  buildAddToCartEvent,
  buildInitiateCheckoutEvent,
  buildPurchaseEvent,
  buildViewContentEvent,
  makeEventId,
  markPurchaseTracked,
  purchaseTrackedKey,
  toMajorUnits,
  wasPurchaseTracked,
} from "./pixel-events";

describe("makeEventId", () => {
  it("produces unique, URL-safe ids for Pixel/CAPI deduplication", () => {
    const ids = new Set(Array.from({ length: 500 }, () => makeEventId()));
    expect(ids.size).toBe(500);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("uses the injected entropy source", () => {
    const rnd = vi.fn(() => 0);
    const id = makeEventId(rnd);
    expect(id.split("-")[1]).toBe("a".repeat(24));
  });
});

describe("buildViewContentEvent", () => {
  it("carries the real product id, name, price and store currency", () => {
    const built = buildViewContentEvent(
      { slug: "vault-hoodie-black", name: "Vault Hoodie", price: 12550, category: "Hoodies" },
      "DZD",
    );
    expect(built.eventName).toBe("ViewContent");
    expect(built.eventId).toBeTruthy();
    expect(built.data.content_ids).toEqual(["vault-hoodie-black"]);
    expect(built.data.content_type).toBe("product");
    expect(built.data.content_name).toBe("Vault Hoodie");
    expect(built.data.content_category).toBe("Hoodies");
    expect(built.data.value).toBeCloseTo(125.5);
    expect(built.data.currency).toBe("DZD");
    expect(built.data.contents).toEqual([
      { id: "vault-hoodie-black", quantity: 1, item_price: 125.5 },
    ]);
  });

  it("respects an externally provided event id", () => {
    const built = buildViewContentEvent(
      { slug: "x", name: "X", price: 100 },
      "$",
      "fixed-id",
    );
    expect(built.eventId).toBe("fixed-id");
  });
});

describe("buildAddToCartEvent", () => {
  it("multiplies value by quantity and keeps product metadata", () => {
    const built = buildAddToCartEvent(
      { slug: "tee-bone", name: "Core Tee", price: 5400 },
      3,
      "دج",
    );
    expect(built.eventName).toBe("AddToCart");
    expect(built.data.num_items).toBe(3);
    expect(built.data.value).toBeCloseTo(162);
    expect(built.data.currency).toBe("دج");
    expect(built.data.contents?.[0]).toEqual({
      id: "tee-bone",
      quantity: 3,
      item_price: 54,
      title: "Core Tee",
    });
  });

  it("clamps quantities to at least 1", () => {
    const built = buildAddToCartEvent(
      { slug: "tee", name: "T", price: 100 },
      0,
      "$",
    );
    expect(built.data.num_items).toBe(1);
  });
});

describe("buildInitiateCheckoutEvent", () => {
  it("sums line items from the real cart", () => {
    const built = buildInitiateCheckoutEvent(
      [
        { slug: "a", name: "A", price: 1000, quantity: 2 },
        { slug: "b", price: 2550, quantity: 1 },
      ],
      "DZD",
    );
    expect(built.eventName).toBe("InitiateCheckout");
    expect(built.data.content_ids).toEqual(["a", "b"]);
    expect(built.data.value).toBeCloseTo(45.5);
    expect(built.data.num_items).toBe(3);
    expect(built.data.contents).toHaveLength(2);
  });
});

describe("buildPurchaseEvent", () => {
  it("uses the server-provided event id (shared with Conversions API)", () => {
    const built = buildPurchaseEvent({
      orderNumber: "RVN-123",
      items: [{ slug: "a", name: "A", price: 1000, quantity: 2 }],
      total: 2995,
      currency: "DZD",
      eventId: "server-event-id",
    });
    expect(built.eventName).toBe("Purchase");
    expect(built.eventId).toBe("server-event-id");
    expect(built.data.order_id).toBe("RVN-123");
    expect(built.data.value).toBeCloseTo(29.95);
    expect(built.data.currency).toBe("DZD");
  });
});

describe("purchase deduplication", () => {
  it("tracks purchases per order number via sessionStorage", () => {
    const store = new Map<string, string>();
    const sessionStorageMock = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    vi.stubGlobal("window", { sessionStorage: sessionStorageMock });

    expect(wasPurchaseTracked("RVN-1")).toBe(false);
    markPurchaseTracked("RVN-1");
    expect(wasPurchaseTracked("RVN-1")).toBe(true);
    // A different order is unaffected.
    expect(wasPurchaseTracked("RVN-2")).toBe(false);
    expect(purchaseTrackedKey("RVN-1")).toContain("RVN-1");

    vi.unstubAllGlobals();
  });

  it("never throws when sessionStorage is unavailable", () => {
    vi.stubGlobal("window", {});
    expect(wasPurchaseTracked("RVN-9")).toBe(false);
    expect(() => markPurchaseTracked("RVN-9")).not.toThrow();
    vi.unstubAllGlobals();
  });
});

describe("toMajorUnits", () => {
  it("converts cents to major currency units", () => {
    expect(toMajorUnits(12550)).toBe(125.5);
    expect(toMajorUnits(995)).toBe(9.95);
    expect(toMajorUnits(0)).toBe(0);
  });
});
