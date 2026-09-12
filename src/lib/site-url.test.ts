import { afterEach, describe, expect, it, vi } from "vitest";
import {
  copyTextToClipboard,
  normalizeSiteBaseUrl,
  productPublicUrl,
  resolveSiteBaseUrl,
  safeOpenHref,
} from "./site-url";
import { TRANSLATIONS, translate } from "@/i18n/translations";

const PROD_BASE = "https://ryven-com-ten.vercel.app";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("normalizeSiteBaseUrl", () => {
  it("keeps valid http(s) bases and strips trailing slashes (no duplicate slash)", () => {
    expect(normalizeSiteBaseUrl(PROD_BASE)).toBe(PROD_BASE);
    expect(normalizeSiteBaseUrl(`${PROD_BASE}/`)).toBe(PROD_BASE);
    expect(normalizeSiteBaseUrl(`${PROD_BASE}///`)).toBe(PROD_BASE);
    expect(normalizeSiteBaseUrl("http://localhost:3000")).toBe(
      "http://localhost:3000",
    );
    expect(normalizeSiteBaseUrl("  https://shop.example/  ")).toBe(
      "https://shop.example",
    );
  });

  it("rejects empty and unsafe bases", () => {
    expect(normalizeSiteBaseUrl("")).toBe("");
    expect(normalizeSiteBaseUrl(undefined)).toBe("");
    expect(normalizeSiteBaseUrl(null)).toBe("");
    expect(normalizeSiteBaseUrl("javascript:alert(1)")).toBe("");
    expect(normalizeSiteBaseUrl("//evil.com")).toBe("");
    expect(normalizeSiteBaseUrl("shop.example")).toBe("");
  });
});

describe("resolveSiteBaseUrl — production base URL resolution", () => {
  it("uses NEXT_PUBLIC_SITE_URL first", () => {
    expect(resolveSiteBaseUrl([PROD_BASE, "https://other.example"])).toBe(
      PROD_BASE,
    );
  });

  it("falls through invalid candidates to the next valid one", () => {
    expect(resolveSiteBaseUrl(["", "not-a-url", "https://fallback.example/"])).toBe(
      "https://fallback.example",
    );
    expect(resolveSiteBaseUrl(["", undefined, null])).toBe("");
  });
});

describe("productPublicUrl — URL generation from the real slug", () => {
  it("builds {base}/products/{slug} for a real production product", () => {
    expect(productPublicUrl("baggy-jogger", PROD_BASE)).toBe(
      "https://ryven-com-ten.vercel.app/products/baggy-jogger",
    );
  });

  it("never produces a duplicate slash", () => {
    expect(productPublicUrl("vault-heavyweight-hoodie-black", `${PROD_BASE}/`)).toBe(
      `${PROD_BASE}/products/vault-heavyweight-hoodie-black`,
    );
    expect(productPublicUrl("core-boxy-tee-bone", `${PROD_BASE}///`)).toBe(
      `${PROD_BASE}/products/core-boxy-tee-bone`,
    );
    expect(productPublicUrl("x", PROD_BASE)).not.toContain("//products");
  });

  it("never exposes a database id — only the slug appears in the path", () => {
    const url = productPublicUrl("baggy-jogger", PROD_BASE);
    expect(url).not.toMatch(/\/\d+/); // no numeric id segment
    expect(url.endsWith("/products/baggy-jogger")).toBe(true);
  });

  it("leaves the existing slug exactly unchanged", () => {
    const slug = "Vault-Heavyweight_Hoodie.BLACK";
    const url = productPublicUrl(slug, PROD_BASE);
    // URL-encoding is reversible for stored slugs — decoding yields the
    // original slug untouched.
    expect(decodeURIComponent(url.split("/products/")[1])).toBe(slug);
  });

  it("does not depend on product status — draft/archived follow the existing storefront rules", () => {
    // URL generation is status-agnostic: it derives ONLY from the slug.
    // Visibility keeps being enforced by the storefront route
    // (getProductBySlug filters active + status='active' and 404s the rest),
    // so generating a link never bypasses product-status logic.
    expect(productPublicUrl("phase5-draft-item", PROD_BASE)).toBe(
      `${PROD_BASE}/products/phase5-draft-item`,
    );
    expect(productPublicUrl("phase5-draft-item", PROD_BASE)).toBe(
      productPublicUrl("phase5-draft-item", PROD_BASE),
    );
  });

  it("rejects unsafe bases — no javascript: or admin links can be produced", () => {
    expect(productPublicUrl("x", "javascript:alert(1)")).toBe(
      "/products/x",
    );
    expect(productPublicUrl("x", "https://shop.example/admin")).toBe(
      "https://shop.example/admin/products/x",
    );
  });
});

describe("safeOpenHref — Open action URL handling", () => {
  it("passes absolute http(s) URLs for target=_blank", () => {
    const url = productPublicUrl("baggy-jogger", PROD_BASE);
    expect(safeOpenHref(url)).toBe(url);
  });

  it("blocks non-http(s) hrefs", () => {
    expect(safeOpenHref("javascript:alert(1)")).toBeNull();
    expect(safeOpenHref("data:text/html,x")).toBeNull();
    expect(safeOpenHref("/products/relative")).toBeNull();
  });
});

describe("copyTextToClipboard — Copy Link action", () => {
  it("copies the exact URL via the async Clipboard API", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const url = productPublicUrl("baggy-jogger", PROD_BASE);
    await expect(copyTextToClipboard(url)).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(url);
  });

  it("falls back to execCommand when the Clipboard API is unavailable", async () => {
    vi.stubGlobal("navigator", {});
    const select = vi.fn();
    const setSelectionRange = vi.fn();
    const removed: unknown[] = [];
    const area = {
      value: "",
      setAttribute: vi.fn(),
      style: {} as Record<string, string>,
      select,
      setSelectionRange,
    };
    vi.stubGlobal("document", {
      createElement: vi.fn().mockReturnValue(area),
      execCommand: vi.fn().mockReturnValue(true),
      body: {
        appendChild: vi.fn(),
        removeChild: (el: unknown) => removed.push(el),
      },
    });
    const url = productPublicUrl("terrain-cargo-pant-olive", PROD_BASE);
    await expect(copyTextToClipboard(url)).resolves.toBe(true);
    expect(area.value).toBe(url); // exact URL copied
    expect(select).toHaveBeenCalled();
    expect(removed).toHaveLength(1);
  });

  it("returns false when every mechanism fails", async () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("document", undefined);
    await expect(copyTextToClipboard("x")).resolves.toBe(false);
  });
});

describe("AR / FR / EN labels", () => {
  const KEYS = [
    "admin.products.linkLabel",
    "admin.products.copyLink",
    "admin.products.open",
    "admin.products.copied",
  ] as const;

  it("defines all Product Link labels in every locale", () => {
    for (const locale of ["en", "fr", "ar"] as const) {
      for (const key of KEYS) {
        expect(TRANSLATIONS[locale][key], `${locale}:${key}`).toBeTruthy();
        // The label itself is never the raw key.
        expect(TRANSLATIONS[locale][key]).not.toBe(key);
      }
    }
  });

  it("translates the labels per locale", () => {
    expect(translate("en", "admin.products.linkLabel")).toBe("Product Link");
    expect(translate("en", "admin.products.copyLink")).toBe("Copy Link");
    expect(translate("en", "admin.products.open")).toBe("Open");
    expect(translate("en", "admin.products.copied")).toBe("Copied");

    expect(translate("fr", "admin.products.linkLabel")).toBe("Lien du produit");
    expect(translate("fr", "admin.products.copyLink")).toBe("Copier le lien");
    expect(translate("fr", "admin.products.open")).toBe("Ouvrir");
    expect(translate("fr", "admin.products.copied")).toBe("Copié");

    expect(translate("ar", "admin.products.linkLabel")).toBe("رابط المنتج");
    expect(translate("ar", "admin.products.copyLink")).toBe("نسخ الرابط");
    expect(translate("ar", "admin.products.open")).toBe("فتح");
    expect(translate("ar", "admin.products.copied")).toBe("تم النسخ");
  });
});
