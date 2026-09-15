import "server-only";
import { signThemePreviewToken, verifyRequest } from "@/lib/admin-auth";
import {
  THEME_PREVIEW_COOKIE,
  THEME_PREVIEW_MAX_AGE_SECONDS,
} from "@/themes/registry";
import { isThemeId } from "@/themes/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/themes/preview-token { themeId }
 *
 * Mints a short-lived HMAC token that lets an authenticated admin preview a
 * theme on the live storefront WITHOUT activating it. The storefront only
 * honors a preview when the token signature validates server-side, so this
 * capability can never be reached by customers.
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

  return Response.json({
    ok: true,
    themeId,
    token: signThemePreviewToken(themeId),
    cookie: THEME_PREVIEW_COOKIE,
    maxAgeSeconds: THEME_PREVIEW_MAX_AGE_SECONDS,
  });
}
