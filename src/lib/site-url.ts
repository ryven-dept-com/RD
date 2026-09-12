/**
 * Centralized site base URL + public product link helpers.
 *
 * One single source of truth for building public storefront URLs (used by
 * Admin → Products "Product Link"). The base URL is resolved from the
 * environment — never hardcoded in application code:
 *
 *   1. NEXT_PUBLIC_SITE_URL  (per-deployment config; production value is
 *      https://ryven-com-ten.vercel.app — set it in the host's environment
 *      variables, e.g. the Vercel project settings)
 *   2. VERCEL_URL            (automatically provided by Vercel server runtime)
 *   3. ""                    (browser callers fall back to window.location.origin,
 *      which is the storefront itself — local dev and same-origin deployments
 *      work with zero configuration)
 *
 * Product links ALWAYS use the existing database slug and the existing
 * /products/[slug] route — never product names, never database IDs, never a
 * second URL format, never an admin URL.
 */

/**
 * Normalize a candidate base URL. Returns "" for anything that is not an
 * absolute http(s) URL — this is what makes the helpers injection-safe
 * (no javascript:/data:/relative bases can ever produce a link).
 * Trailing slashes are stripped so joins never create "//".
 */
export function normalizeSiteBaseUrl(raw: string | undefined | null): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  if (!/^https?:\/\//i.test(value)) return "";
  return value.replace(/\/+$/, "");
}

/** First candidate that normalizes to a valid base URL, else "". */
export function resolveSiteBaseUrl(
  candidates: Array<string | undefined | null>,
): string {
  for (const candidate of candidates) {
    const normalized = normalizeSiteBaseUrl(candidate);
    if (normalized) return normalized;
  }
  return "";
}

/**
 * Environment-driven base URL. In client bundles Next.js inlines
 * NEXT_PUBLIC_SITE_URL at build time; VERCEL_URL only exists in the Vercel
 * server runtime. Returns "" when nothing is configured — browser callers
 * then fall back to the current origin (the storefront itself).
 */
export function getSiteBaseUrl(): string {
  const vercelUrl =
    typeof process !== "undefined" && process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : undefined;
  return resolveSiteBaseUrl([process.env.NEXT_PUBLIC_SITE_URL, vercelUrl]);
}

/**
 * The public URL of a product: `{base}/products/{slug}`.
 *
 * Uses ONLY the existing database slug (URL-encoded so unusual but stored
 * slugs stay intact) — the exact same route and format the storefront links
 * to, so the admin link, the storefront link and search-engine canonicals
 * all agree.
 */
export function productPublicUrl(slug: string, baseUrl: string): string {
  return `${normalizeSiteBaseUrl(baseUrl)}/products/${encodeURIComponent(slug)}`;
}

/**
 * Safe href for opening a product page in a new tab. Only absolute http(s)
 * URLs pass; anything else yields null (callers render a disabled action).
 */
export function safeOpenHref(url: string): string | null {
  return /^https?:\/\//i.test(url) ? url : null;
}

/**
 * Copy text to the clipboard with a legacy fallback (desktop + mobile).
 * Returns true when the text was copied.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    if (typeof document === "undefined") return false;
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
