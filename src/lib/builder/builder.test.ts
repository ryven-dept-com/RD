import { describe, expect, it } from "vitest";
import { SECTION_TYPES, type BuilderDoc, type Section } from "./types";
import {
  SECTION_LIBRARY,
  LIBRARY_BY_TYPE,
  defaultBuilderDoc,
  defaultSection,
  newSectionId,
} from "./defaults";
import {
  sanitizeDoc,
  sanitizeSection,
  sanitizeHref,
  sanitizeColor,
  docsEqual,
  lintDoc,
} from "./validate";
import { scanBuilder, applySafeFixes, scoreReport, type HealthCtx } from "./health";
import { mintBuilderPreviewToken, getBuilderPreviewDoc, BUILDER_PREVIEW_PARAM } from "./preview";

const CTX: HealthCtx = {
  categories: ["Hoodies", "Jackets"],
  collections: ["Core"],
  slugs: ["hoodie-noir"],
};

function sectionOf(doc: BuilderDoc, i: number): Section {
  return doc.home[i];
}

describe("section library", () => {
  it("covers every declared section type with at least 24 entries", () => {
    expect(SECTION_LIBRARY.length).toBeGreaterThanOrEqual(24);
    for (const t of SECTION_TYPES) {
      expect(LIBRARY_BY_TYPE.has(t), `missing library entry for ${t}`).toBe(true);
    }
    for (const lib of SECTION_LIBRARY) {
      expect(SECTION_TYPES).toContain(lib.type);
      expect(lib.label.length).toBeGreaterThan(0);
    }
  });

  it("builds sanitized default sections for every type", () => {
    for (const t of SECTION_TYPES) {
      const s = defaultSection(t);
      expect(s.type).toBe(t);
      expect(s.id.length).toBeGreaterThan(0);
      expect(JSON.stringify(sanitizeSection(s))).toBe(JSON.stringify(s));
    }
  });

  it("default home composition includes an enabled hero first", () => {
    const doc = defaultBuilderDoc();
    expect(doc.home.length).toBeGreaterThan(0);
    expect(doc.home[0].type).toBe("hero");
    expect(doc.home[0].enabled).toBe(true);
  });
});

describe("sanitizeDoc — schema validation & safe clamps", () => {
  it("coerces empty/garbage input into a valid document with default chrome", () => {
    // Empty home is preserved (the health scanner offers the restore fix);
    // all chrome settings fall back to their safe defaults.
    const fromNull = sanitizeDoc(null);
    const def = defaultBuilderDoc();
    expect(fromNull.home).toEqual([]);
    expect(fromNull.header).toEqual(def.header);
    expect(fromNull.footer).toEqual(def.footer);
    expect(fromNull.shop).toEqual(def.shop);
    expect(fromNull.pdp).toEqual(def.pdp);
    expect(fromNull.cart).toEqual(def.cart);
    const fromGarbage = sanitizeDoc({ home: "nope", header: 42 });
    expect(fromGarbage.home).toEqual([]);
    expect(fromGarbage.header.navOrder.length).toBeGreaterThan(0);
  });

  it("is idempotent — sanitizing a sanitized doc changes nothing", () => {
    const doc = defaultBuilderDoc();
    expect(docsEqual(sanitizeDoc(doc), doc)).toBe(true);
    expect(docsEqual(sanitizeDoc(sanitizeDoc(doc)), doc)).toBe(true);
  });

  it("replaces unknown section types with text_block", () => {
    const doc = sanitizeDoc({ home: [{ id: "x1", type: "hologram_deck" }] });
    expect(doc.home[0].type).toBe("text_block");
  });

  it("clamps numeric props into safe ranges", () => {
    const doc = sanitizeDoc({
      home: [
        {
          id: "s1",
          type: "featured_products",
          props: { limit: 999 },
          layout: { cols: 9, colsMobile: 7, gap: "huge" },
          colors: { overlayOpacity: 200 },
          mobile: { order: 500, cols: 12 },
        },
      ],
    });
    const s = sectionOf(doc, 0);
    expect(s.props.limit).toBeLessThanOrEqual(12);
    expect([2, 3, 4]).toContain(s.layout.cols);
    expect([1, 2]).toContain(s.layout.colsMobile);
    expect(["sm", "md", "lg"]).toContain(s.layout.gap);
    expect(s.colors.overlayOpacity).toBeLessThanOrEqual(80);
    expect(s.mobile.order).toBeLessThanOrEqual(99);
    expect([0, 1, 2]).toContain(s.mobile.cols);
  });

  it("rejects invalid colors and keeps empty = theme fallback", () => {
    expect(sanitizeColor("rgb(1,2,3)")).toBe("");
    expect(sanitizeColor("not-a-color")).toBe("");
    expect(sanitizeColor("#ABC")).toBe("#abc");
    const doc = sanitizeDoc({ home: [{ id: "s1", colors: { bg: "blue", text: "#111111" } }] });
    expect(sectionOf(doc, 0).colors.bg).toBe("");
    expect(sectionOf(doc, 0).colors.text).toBe("#111111");
  });

  it("blocks javascript:, protocol-relative and credential hrefs", () => {
    expect(sanitizeHref("javascript:alert(1)")).toBe("");
    expect(sanitizeHref("//evil.com")).toBe("");
    expect(sanitizeHref("https://user:pass@evil.com")).toBe("");
    expect(sanitizeHref("/shop?category=Hoodies")).toBe("/shop?category=Hoodies");
    expect(sanitizeHref("https://example.com")).toBe("https://example.com");
    expect(sanitizeHref("mailto:hi@ryven.dz")).toBe("mailto:hi@ryven.dz");
  });

  it("never stores a dangerous href in a section", () => {
    const doc = sanitizeDoc({
      home: [{ id: "s1", type: "text_block", props: { ctaText: "Go", ctaLink: "javascript:alert(1)" } }],
    });
    expect(sectionOf(doc, 0).props.ctaLink).not.toContain("javascript:");
  });

  it("dedupes duplicated section ids and caps the section count", () => {
    const home = Array.from({ length: 50 }, (_, i) => ({
      id: i < 3 ? "dup" : `s${i}`,
      type: "text_block",
    }));
    const doc = sanitizeDoc({ home });
    expect(doc.home.length).toBeLessThanOrEqual(40);
    const ids = doc.home.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("truncates oversized strings", () => {
    const doc = sanitizeDoc({ home: [{ id: "s1", props: { title: "x".repeat(5000) } }] });
    expect(sectionOf(doc, 0).props.title.length).toBeLessThanOrEqual(200);
  });
});

describe("docsEqual", () => {
  it("detects deep equality and single-property differences", () => {
    const a = defaultBuilderDoc();
    const b = JSON.parse(JSON.stringify(a)) as BuilderDoc;
    expect(docsEqual(a, b)).toBe(true);
    b.shop.cols = 4;
    expect(docsEqual(a, b)).toBe(false);
  });
});

describe("lintDoc — config-level QA", () => {
  it("flags duplicated section ids", () => {
    const doc = defaultBuilderDoc();
    doc.home[1].id = doc.home[0].id;
    const issues = lintDoc(doc);
    expect(issues.some((i) => i.id.startsWith("dup_") && i.severity === "error")).toBe(true);
  });

  it("flags an empty home page with a restorable fix", () => {
    const doc = defaultBuilderDoc();
    doc.home = [];
    const issues = lintDoc(doc);
    expect(issues.some((i) => i.id === "empty_home" && i.fix === "restore-default-home")).toBe(true);
  });

  it("flags a missing hero as a warning", () => {
    const doc = defaultBuilderDoc();
    doc.home = doc.home.filter((s) => s.type !== "hero");
    expect(lintDoc(doc).some((i) => i.id === "no_hero")).toBe(true);
  });

  it("flags missing alt text on image sections", () => {
    const doc = defaultBuilderDoc();
    const img = defaultSection("full_width_image");
    img.props.alt = "";
    img.props.image = "/api/media/123";
    img.props.useCms = false;
    doc.home.push(img);
    const issues = lintDoc(doc);
    expect(issues.some((i) => i.id === `alt_${img.id}` && i.fix === "fill-alt")).toBe(true);
  });

  it("flags unreadable same-color text/background", () => {
    const doc = defaultBuilderDoc();
    const s = doc.home[1];
    s.colors.bg = "#111111";
    s.colors.text = "#111111";
    const issues = lintDoc(doc);
    expect(issues.some((i) => i.id === `con_${s.id}` && i.severity === "error")).toBe(true);
  });

  it("flags excessive mobile padding", () => {
    const doc = defaultBuilderDoc();
    const s = doc.home[1];
    s.layout.padY = "xl";
    s.mobile.padY = "xl";
    expect(lintDoc(doc).some((i) => i.id === `pad_${s.id}` && i.fix === "fix-mobile-padding")).toBe(true);
  });
});

describe("scanBuilder — health scanner with live catalog context", () => {
  it("passes a pristine default document", () => {
    const issues = scanBuilder(defaultBuilderDoc(), CTX);
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("flags unknown category/collection/ids/slug product sources", () => {
    const doc = defaultBuilderDoc();
    doc.home = [
      { ...defaultSection("product_grid"), id: "g1", props: { ...defaultSection("product_grid").props, source: "category:Ghost" } },
      { ...defaultSection("product_carousel"), id: "g2", props: { ...defaultSection("product_carousel").props, source: "collection:Missing" } },
      { ...defaultSection("new_arrivals"), id: "g3", props: { ...defaultSection("new_arrivals").props, source: "ids:" } },
      { ...defaultSection("product_spotlight"), id: "g4", props: { ...defaultSection("product_spotlight").props, source: "slug:ghost-product" } },
    ];
    const issues = scanBuilder(doc, CTX);
    for (const id of ["cat_g1", "col_g2", "ids_g3", "slug_g4"]) {
      expect(issues.some((i) => i.id === id && i.fix === "fix-source"), `expected ${id}`).toBe(true);
    }
  });

  it("accepts valid sources", () => {
    const doc = defaultBuilderDoc();
    doc.home = [
      { ...defaultSection("product_grid"), id: "g1", props: { ...defaultSection("product_grid").props, source: "category:Hoodies" } },
      { ...defaultSection("product_spotlight"), id: "g2", props: { ...defaultSection("product_spotlight").props, source: "slug:hoodie-noir" } },
    ];
    const issues = scanBuilder(doc, CTX);
    expect(issues.some((i) => i.property === "props.source")).toBe(false);
  });

  it("flags links to unknown products and unknown routes", () => {
    const doc = defaultBuilderDoc();
    doc.home = [
      { ...defaultSection("text_block"), id: "l1", props: { ...defaultSection("text_block").props, link: "/products/ghost" } },
      { ...defaultSection("text_block"), id: "l2", props: { ...defaultSection("text_block").props, link: "/admin/dashboard" } },
    ];
    const issues = scanBuilder(doc, CTX);
    expect(issues.some((i) => i.sectionId === "l1" && i.severity === "error")).toBe(true);
    expect(issues.some((i) => i.sectionId === "l2" && i.fix === "fix-link")).toBe(true);
  });

  it("flags CLS-risk images without a reserved aspect", () => {
    const doc = defaultBuilderDoc();
    doc.home = [
      {
        ...defaultSection("full_width_image"), id: "f1",
        props: { ...defaultSection("full_width_image").props, image: "/api/media/9", alt: "x", aspect: "auto", height: "" },
      },
    ];
    const issues = scanBuilder(doc, CTX);
    expect(issues.some((i) => i.id === "cls_f1" && i.fix === "fix-aspect")).toBe(true);
  });
});

describe("applySafeFixes — deterministic, business-safe auto-repair", () => {
  it("fixes every safe issue and reports each modification", () => {
    const doc = defaultBuilderDoc();
    doc.home = [
      {
        ...defaultSection("full_width_image"), id: "a1",
        props: { ...defaultSection("full_width_image").props, image: "/api/media/1", alt: "", aspect: "auto", height: "" },
        colors: { ...defaultSection("full_width_image").colors, overlayOpacity: 90 },
      },
      {
        ...defaultSection("product_grid"), id: "a2",
        props: { ...defaultSection("product_grid").props, source: "category:Ghost", ctaText: "Buy", ctaLink: "/products/ghost" },
      },
    ];
    doc.home.push({ ...doc.home[0], id: "a3" }); // same problems, new id
    const issues = scanBuilder(doc, CTX);
    const safe = issues.filter((i) => Boolean(i.fix));
    expect(safe.length).toBeGreaterThan(0);

    const { doc: fixed, report } = applySafeFixes(doc, safe);
    expect(report.length).toBeGreaterThan(0);
    expect(fixed.home[0].props.alt.length).toBeGreaterThan(0);
    expect(fixed.home[0].colors.overlayOpacity).toBeLessThanOrEqual(80);
    expect(fixed.home[0].props.aspect).toBe("16:9");
    expect(fixed.home[1].props.source).toBe("featured");
    expect(new Set(fixed.home.map((s) => s.id)).size).toBe(fixed.home.length);

    // Deterministic: same input → identical output.
    const again = applySafeFixes(doc, safe);
    expect(JSON.stringify(again.doc)).toBe(JSON.stringify(fixed));
    expect(again.report).toEqual(report);

    // After repair, no fixable issue survives.
    const remaining = scanBuilder(fixed, CTX).filter((i) => Boolean(i.fix));
    expect(remaining).toEqual([]);
  });

  it("never mutates the input document", () => {
    const doc = defaultBuilderDoc();
    doc.home[0].props.alt = "";
    const before = JSON.stringify(doc);
    applySafeFixes(doc, lintDoc(doc));
    expect(JSON.stringify(doc)).toBe(before);
  });

  it("resets unreadable colors instead of choosing new brand colors", () => {
    const doc = defaultBuilderDoc();
    const s = doc.home[1];
    s.colors.bg = "#222222";
    s.colors.text = "#222222";
    const { doc: fixed, report } = applySafeFixes(doc, lintDoc(doc).filter((i) => i.fix));
    expect(fixed.home[1].colors.text).toBe("");
    expect(report.length).toBeGreaterThan(0);
  });

  it("regenerates duplicated section ids deterministically per run", () => {
    const doc = defaultBuilderDoc();
    doc.home.push({ ...doc.home[1], id: doc.home[1].id });
    const issues = lintDoc(doc).filter((i) => i.fix === "dedupe-ids");
    expect(issues.length).toBe(1);
    const { doc: fixed, report } = applySafeFixes(doc, issues);
    expect(new Set(fixed.home.map((s) => s.id)).size).toBe(fixed.home.length);
    expect(report.some((r) => r.includes("regenerated duplicated section id"))).toBe(true);
  });

  it("restores the default composition when the home is empty", () => {
    const doc = defaultBuilderDoc();
    doc.home = [];
    const issues = scanBuilder(doc, CTX);
    const { doc: fixed } = applySafeFixes(doc, issues.filter((i) => i.fix));
    expect(fixed.home.length).toBeGreaterThan(0);
    expect(fixed.home[0].type).toBe("hero");
  });
});

describe("scoreReport", () => {
  it("scores a clean document 100 across all categories", () => {
    const r = scoreReport([]);
    expect(r.score).toBe(100);
    for (const c of Object.values(r.categories)) {
      expect(c.score).toBe(100);
      expect(c.issues).toBe(0);
    }
    for (const name of ["performance", "accessibility", "responsive", "content", "links", "images", "configuration", "seo"]) {
      expect(r.categories[name]).toBeTruthy();
    }
  });

  it("weights errors heavier than warnings and routes issues to categories", () => {
    const issues = scanBuilder(sanitizeDoc({
      home: [
        { id: "x1", type: "full_width_image", props: { image: "/api/media/1", alt: "", aspect: "auto", height: "" } },
        { id: "x2", type: "product_grid", props: { source: "category:Ghost" } },
      ],
    }), CTX);
    const r = scoreReport(issues);
    expect(r.score).toBeLessThan(100);
    expect(r.categories.images.issues).toBeGreaterThan(0);
    expect(r.categories.content.issues).toBeGreaterThan(0);
  });
});

describe("builder preview tokens", () => {
  it("mints a token that resolves to the exact sanitized draft", () => {
    const doc = defaultBuilderDoc();
    doc.home[0].props.title = "Preview me";
    const token = mintBuilderPreviewToken(doc);
    expect(token.length).toBeGreaterThan(8);
    const got = getBuilderPreviewDoc(token);
    expect(got).not.toBeNull();
    expect(got!.home[0].props.title).toBe("Preview me");
    expect(BUILDER_PREVIEW_PARAM).toBe("rd_bd");
  });

  it("rejects forged or unknown tokens", () => {
    expect(getBuilderPreviewDoc("forged-token")).toBeNull();
    expect(getBuilderPreviewDoc(undefined)).toBeNull();
    expect(getBuilderPreviewDoc("")).toBeNull();
  });

  it("isolates concurrent preview sessions", () => {
    const a = defaultBuilderDoc();
    a.home[0].props.title = "Session A";
    const b = defaultBuilderDoc();
    b.home[0].props.title = "Session B";
    const ta = mintBuilderPreviewToken(a);
    const tb = mintBuilderPreviewToken(b);
    expect(getBuilderPreviewDoc(ta)!.home[0].props.title).toBe("Session A");
    expect(getBuilderPreviewDoc(tb)!.home[0].props.title).toBe("Session B");
  });
});

describe("newSectionId", () => {
  it("generates unique ids", () => {
    const ids = new Set(Array.from({ length: 200 }, () => newSectionId()));
    expect(ids.size).toBe(200);
  });
});
