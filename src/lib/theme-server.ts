import "server-only";
import { cookies } from "next/headers";
import { verifyThemePreviewToken } from "@/lib/admin-auth";
import { getStoreSettings } from "@/lib/settings";
import {
  getTheme,
  parsePreviewCookie,
  THEME_PREVIEW_COOKIE,
} from "@/themes/registry";
import { isThemeId, type ThemeDefinition } from "@/themes/types";

export type ResolvedStorefrontTheme = {
  /** Theme activated in Admin → Themes. */
  active: ThemeDefinition;
  /**
   * Admin live-preview theme (validated HMAC cookie), or null. Previews are
   * presentation-only: nothing is written and no customer ever sees them —
   * the token can only be minted by the admin preview API behind session
   * auth + CSRF.
   */
  preview: ThemeDefinition | null;
  /** What the storefront must actually render. */
  rendered: ThemeDefinition;
};

/**
 * Resolve the theme for the current storefront request.
 *
 * Performance contract: settings are read through getStoreSettings(), which
 * is memoized per request — the theme therefore adds ZERO extra database
 * queries, and theme switching never duplicates work. The preview cookie is
 * validated with a constant-time HMAC comparison (no DB access at all).
 */
export async function resolveStorefrontTheme(): Promise<ResolvedStorefrontTheme> {
  let activeId = "";
  try {
    const store = await getStoreSettings();
    activeId = store.activeTheme;
  } catch {
    // settings unavailable → registry default (district)
  }
  const active = getTheme(activeId);

  let preview: ThemeDefinition | null = null;
  try {
    const raw = (await cookies()).get(THEME_PREVIEW_COOKIE)?.value;
    const parsed = parsePreviewCookie(raw);
    if (
      parsed &&
      isThemeId(parsed.themeId) &&
      verifyThemePreviewToken(parsed.themeId, parsed.token)
    ) {
      preview = getTheme(parsed.themeId);
    }
  } catch {
    // cookies unavailable → no preview
  }

  return { active, preview, rendered: preview ?? active };
}
