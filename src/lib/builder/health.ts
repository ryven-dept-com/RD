import { LIBRARY_BY_TYPE, newSectionId } from "./defaults";
import { defaultBuilderDoc } from "./defaults";
import { lintDoc, sanitizeHref, type Issue } from "./validate";
import type { BuilderDoc } from "./types";

/**
 * Storefront Health / QA engine — pure and deterministic.
 *
 * Scans the builder configuration for structural, content, image, link,
 * responsive, accessibility and configuration problems. Every issue carries
 * the exact page/section/property, a severity, a suggested fix and — when a
 * fix is deterministic and SAFE — a fix identifier applied by applyFixes().
 *
 * Auto-fixes NEVER touch products, prices, stock, orders, delivery, checkout
 * or customer data: they only rewrite the builder configuration itself.
 */

export type HealthCtx = {
  categories: string[];
  collections: string[];
  slugs: string[];
};

export type HealthReport = {
  score: number;
  categories: Record<string, { score: number; issues: number }>;
  issues: Issue[];
  fixed: string[];
};

function cat(issue: Issue): string {
  if (issue.property.startsWith("colors")) return "accessibility";
  if (issue.property.includes("image") || issue.property.includes("alt") || issue.id.startsWith("noimg")) return "images";
  if (issue.property.includes("cta") || issue.property.includes("link")) return "links";
  if (issue.id.startsWith("pad") || issue.id.startsWith("mob") || issue.id.startsWith("order")) return "responsive";
  if (issue.id.startsWith("dup") || issue.id.startsWith("empty") || issue.id.startsWith("cfg")) return "configuration";
  if (issue.id.startsWith("seo")) return "seo";
  if (issue.id.startsWith("perf")) return "performance";
  return "content";
}

/** Validate a product source string against the live catalog. */
function sourceIssue(source: string, ctx: HealthCtx, s: { id: string; type: string }): Issue | null {
  const src = source.trim();
  if (!src) return null;
  if (["featured", "new", "best"].includes(src)) return null;
  if (src.startsWith("category:")) {
    const name = src.slice(9).trim();
    if (!ctx.categories.includes(name)) {
      return {
        id: `cat_${s.id}`, page: "home", sectionId: s.id, sectionType: s.type, property: "props.source",
        severity: "error",
        message: `Unknown category "${name}" in product source.`,
        suggested: "Switch the source to the featured list.",
        fix: "fix-source",
      };
    }
    return null;
  }
  if (src.startsWith("collection:")) {
    const name = src.slice(11).trim();
    if (!ctx.collections.includes(name)) {
      return {
        id: `col_${s.id}`, page: "home", sectionId: s.id, sectionType: s.type, property: "props.source",
        severity: "error",
        message: `Unknown collection "${name}" in product source.`,
        suggested: "Switch the source to the featured list.",
        fix: "fix-source",
      };
    }
    return null;
  }
  if (src.startsWith("ids:")) {
    const ids = src.slice(4).split(",").map((x) => Number(x.trim())).filter((n) => Number.isFinite(n) && n > 0);
    if (ids.length === 0) {
      return {
        id: `ids_${s.id}`, page: "home", sectionId: s.id, sectionType: s.type, property: "props.source",
        severity: "error",
        message: "Product source has no valid ids.",
        suggested: "Switch the source to the featured list.",
        fix: "fix-source",
      };
    }
    return null;
  }
  if (src.startsWith("slug:")) {
    const slug = src.slice(5).trim();
    if (!ctx.slugs.includes(slug)) {
      return {
        id: `slug_${s.id}`, page: "home", sectionId: s.id, sectionType: s.type, property: "props.source",
        severity: "error",
        message: `Unknown product slug "${slug}".`,
        suggested: "Clear the spotlight source.",
        fix: "fix-source",
      };
    }
    return null;
  }
  return {
    id: `src_${s.id}`, page: "home", sectionId: s.id, sectionType: s.type, property: "props.source",
    severity: "warning",
    message: `Unrecognized product source "${src}".`,
    suggested: "Use featured | new | best | category:X | collection:X.",
    fix: "fix-source",
  };
}

function linkIssue(href: string, prop: string, id: string, ctx: HealthCtx, s: { id: string; type: string }): Issue | null {
  if (!href) return null;
  if (href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:")) return null;
  const [path, query = ""] = href.split("?");
  if (path === "/" || path === "/shop" || path === "/cart" || path === "/checkout") return null;
  if (path.startsWith("/shop?") || (path === "/shop" && query)) return null;
  if (path.startsWith("/products/")) {
    const slug = path.slice("/products/".length);
    if (!ctx.slugs.includes(slug)) {
      return {
        id: `${id}_${s.id}`, page: "home", sectionId: s.id, sectionType: s.type, property: prop,
        severity: "error",
        message: `Link points to unknown product "${slug}".`,
        suggested: "Re-point the link to /shop.",
        fix: "fix-link",
      };
    }
    return null;
  }
  if (path.startsWith("/collections/") || path.startsWith("/category/")) return null;
  return {
    id: `${id}r_${s.id}`, page: "home", sectionId: s.id, sectionType: s.type, property: prop,
    severity: "warning",
    message: `Link "${href}" does not match a known storefront route.`,
    suggested: "Use /, /shop, /products/<slug> or a category link.",
    fix: "fix-link",
  };
}

export function scanBuilder(doc: BuilderDoc, ctx: HealthCtx): Issue[] {
  const issues: Issue[] = [...lintDoc(doc)];

  for (const s of doc.home) {
    const lib = LIBRARY_BY_TYPE.get(s.type);
    if (!lib) {
      issues.push({
        id: `type_${s.id}`, page: "home", sectionId: s.id, property: "type",
        severity: "error", message: `Unknown section type "${s.type}".`,
        suggested: "Replace it with a text block.", fix: "fix-type",
      });
      continue;
    }
    // empty section detection: content-bearing types with no content at all
    const hasContent =
      s.props.title || s.props.body || s.props.image || s.props.source || s.props.useCms ||
      ["marquee", "announcement", "collection_cards", "categories", "newsletter", "social", "divider", "spacer",
        "featured_products", "new_arrivals", "best_sellers", "product_grid", "product_carousel", "promo_banner", "brand_story"].includes(s.type);
    if (!hasContent) {
      issues.push({
        id: `empty_${s.id}`, page: "home", sectionId: s.id, sectionType: s.type, property: "props",
        severity: "warning", message: `Section "${lib.label}" has no content.`,
        suggested: "Add content or remove the section.",
      });
    }
    if (["product_grid", "product_carousel", "featured_products", "new_arrivals", "best_sellers", "product_spotlight"].includes(s.type)) {
      const si = sourceIssue(s.props.source, ctx, s);
      if (si) issues.push(si);
    }
    for (const [prop, val] of [["props.ctaLink", s.props.ctaLink], ["props.cta2Link", s.props.cta2Link], ["props.link", s.props.link]] as const) {
      const li = val ? linkIssue(val, prop, prop.replace("props.", "lnk"), ctx, s) : null;
      if (li) issues.push(li);
    }
    // oversized / CLS-risk media: full-width images without an aspect reserved
    if (["full_width_image", "editorial_image"].includes(s.type) && s.props.image && s.props.aspect === "auto" && !s.props.height) {
      issues.push({
        id: `cls_${s.id}`, page: "home", sectionId: s.id, sectionType: s.type, property: "props.aspect",
        severity: "warning",
        message: "Image section reserves no aspect ratio (CLS risk).",
        suggested: "Reserve a 16:9 ratio.",
        fix: "fix-aspect",
      });
    }
    if (s.props.image && s.props.image.length > 2048) {
      issues.push({
        id: `perf_${s.id}`, page: "home", sectionId: s.id, property: "props.image",
        severity: "warning", message: "Image URL is abnormally long.",
        suggested: "Re-pick the image from the media library.", fix: "clear-image",
      });
    }
    // invalid color tokens already sanitized to "" — but flag explicit garbage
    // that survived as empty after admin entry (we only see clean values here).
  }

  // header checks
  if (doc.header.navOrder.length === 0) {
    issues.push({
      id: "nav_empty", page: "header", property: "navOrder",
      severity: "error", message: "Navigation has no items.",
      suggested: "Restore the default navigation.", fix: "fix-nav",
    });
  }
  return issues;
}

/* ------------------------------ auto-fix engine --------------------------- */

/**
 * Apply every deterministic safe fix. Returns the new doc + a report line
 * per modification. Pure — the caller persists transactionally.
 */
export function applySafeFixes(doc: BuilderDoc, issues: Issue[]): { doc: BuilderDoc; report: string[] } {
  const next: BuilderDoc = JSON.parse(JSON.stringify(doc));
  const report: string[] = [];
  const bySection = new Map<string, typeof next.home[number]>();
  for (const s of next.home) bySection.set(s.id, s);

  const seenFixes = new Set<string>();
  for (const issue of issues) {
    if (!issue.fix || seenFixes.has(issue.id)) continue;
    const s = issue.sectionId ? bySection.get(issue.sectionId) : undefined;
    switch (issue.fix) {
      case "fill-alt":
        if (s && s.props.image && !s.props.alt) {
          s.props.alt = (s.props.title || LIBRARY_BY_TYPE.get(s.type)?.label || "RYVEN DEPT") + " — campaign image";
          report.push(`${s.id}: filled missing alt text.`);
        }
        break;
      case "clamp-overlay":
        if (s && s.colors.overlayOpacity > 80) {
          s.colors.overlayOpacity = 80;
          report.push(`${s.id}: clamped overlay opacity to 80%.`);
        }
        break;
      case "fix-cta":
        if (s) {
          if (s.props.ctaText && !sanitizeHref(s.props.ctaLink)) { s.props.ctaLink = "/shop"; report.push(`${s.id}: pointed empty button target at /shop.`); }
          if (s.props.cta2Text && !sanitizeHref(s.props.cta2Link)) { s.props.cta2Link = "/shop"; report.push(`${s.id}: pointed empty second button at /shop.`); }
        }
        break;
      case "fix-link":
        if (s) {
          if (issue.property === "props.ctaLink") s.props.ctaLink = "/shop";
          else if (issue.property === "props.cta2Link") s.props.cta2Link = "/shop";
          else s.props.link = "/shop";
          report.push(`${s.id}: re-pointed broken link to /shop.`);
        }
        break;
      case "fix-source":
        if (s) { s.props.source = "featured"; report.push(`${s.id}: reset invalid product source to featured.`); }
        break;
      case "fix-aspect":
        if (s && s.props.aspect === "auto") { s.props.aspect = "16:9"; report.push(`${s.id}: reserved 16:9 aspect ratio (CLS).`); }
        break;
      case "fix-contrast":
        if (s) {
          const { bg, text, heading, buttonBg, buttonText } = s.colors;
          if (bg && text && bg === text) { s.colors.text = ""; report.push(`${s.id}: reset unreadable text color to theme ink.`); }
          if (bg && heading && bg === heading) { s.colors.heading = ""; report.push(`${s.id}: reset unreadable heading color.`); }
          if (buttonBg && buttonText && buttonBg === buttonText) { s.colors.buttonBg = ""; s.colors.buttonText = ""; report.push(`${s.id}: reset invisible button colors.`); }
        }
        break;
      case "fix-mobile-padding":
        if (s && s.mobile.padY === "xl") { s.mobile.padY = "md"; report.push(`${s.id}: reduced mobile vertical padding to md.`); }
        else if (s && s.layout.padY === "xl") { s.mobile.padY = "md"; report.push(`${s.id}: added md mobile padding override.`); }
        break;
      case "clear-image":
        if (s) { s.props.image = ""; report.push(`${s.id}: cleared oversized image URL.`); }
        break;
      case "fix-type":
        if (s) { s.type = "text_block"; report.push(`${s.id}: replaced unknown section type with text block.`); }
        break;
      case "fix-nav":
        next.header.navOrder = defaultBuilderDoc().header.navOrder;
        report.push("header: restored default navigation order.");
        break;
      case "dedupe-ids": {
        const seen = new Set<string>();
        for (const sec of next.home) {
          if (seen.has(sec.id)) {
            const old = sec.id;
            sec.id = newSectionId();
            report.push(`home: regenerated duplicated section id ${old}.`);
          }
          seen.add(sec.id);
        }
        break;
      }
      case "restore-default-home":
        next.home = defaultBuilderDoc().home;
        report.push("home: restored the default section composition.");
        break;
    }
    seenFixes.add(issue.id);
  }
  return { doc: next, report };
}

/* --------------------------------- scoring -------------------------------- */

const WEIGHT: Record<string, number> = { error: 12, warning: 4 };

export function scoreReport(issues: Issue[], fixed: string[] = []): HealthReport {
  const cats: Record<string, { score: number; issues: number; penalty: number }> = {};
  for (const name of ["performance", "accessibility", "responsive", "content", "links", "images", "configuration", "seo"]) {
    cats[name] = { score: 100, issues: 0, penalty: 0 };
  }
  for (const issue of issues) {
    const c = cat(issue);
    const bucket = (cats[c] ??= { score: 100, issues: 0, penalty: 0 });
    bucket.issues += 1;
    bucket.penalty += WEIGHT[issue.severity] ?? 4;
  }
  let total = 100;
  for (const [name, b] of Object.entries(cats)) {
    b.score = Math.max(0, 100 - b.penalty);
    total -= b.penalty * 0.6;
    void name;
  }
  total = Math.max(0, Math.round(total));
  return {
    score: total,
    categories: Object.fromEntries(Object.entries(cats).map(([k, v]) => [k, { score: v.score, issues: v.issues }])),
    issues,
    fixed,
  };
}
