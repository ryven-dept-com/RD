import "server-only";
import { verifyRequest } from "@/lib/admin-auth";
import { applySettingsPatch } from "@/lib/settings";
import { getTheme } from "@/themes/registry";
import { isThemeId } from "@/themes/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/themes/activate { themeId }
 *
 * Activates a storefront theme. Security model:
 *   - authenticated admin session + CSRF token (verifyRequest);
 *   - themeId validated against the registry before anything is written;
 *   - the write goes through the same settings pipeline as every other
 *     setting (server-side validation, single source of truth);
 *   - ONLY presentation changes: products, orders, delivery pricing,
 *     customers and tracking are untouched.
 */
export async function POST(request: Request) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const themeId = (body as Record<string, unknown> | null)?.themeId;
  if (!isThemeId(themeId)) {
    return Response.json({ ok: false, error: "Unknown theme" }, { status: 400 });
  }

  const result = await applySettingsPatch({ activeTheme: themeId });
  if (!result.ok) {
    return Response.json({ ok: false, errors: result.errors }, { status: 400 });
  }

  const theme = getTheme(themeId);
  return Response.json({ ok: true, activeTheme: theme.id, name: theme.name });
}
