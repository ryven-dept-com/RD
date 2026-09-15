import "server-only";
import { verifyRequest } from "@/lib/admin-auth";
import { getStoreSettings } from "@/lib/settings";
import { getTheme, THEMES } from "@/themes/registry";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/themes — theme library for the Admin → Themes page.
 * Admin session required; customers never reach this (the admin router
 * guard + this check both reject unauthenticated requests).
 */
export async function GET(request: Request) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let activeThemeId = "";
  try {
    const store = await getStoreSettings();
    activeThemeId = store.activeTheme;
  } catch {
    // settings unavailable → registry default below
  }
  const active = getTheme(activeThemeId);

  return Response.json({
    ok: true,
    activeTheme: active.id,
    themes: THEMES.map((t) => ({
      id: t.id,
      name: t.name,
      tagline: t.tagline,
      description: t.description,
      tags: t.tags,
      swatch: t.swatch,
    })),
  });
}
