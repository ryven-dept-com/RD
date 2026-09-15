import "server-only";
import { verifyThemePreviewToken } from "@/lib/admin-auth";
import {
  THEME_PREVIEW_COOKIE,
  THEME_PREVIEW_MAX_AGE_SECONDS,
} from "@/themes/registry";
import { isThemeId } from "@/themes/types";

export const dynamic = "force-dynamic";

const HOME = "/";

/** Only allow same-site relative targets (block //host and absolute URLs). */
function safeNext(value: string | null): string {
  if (!value) return HOME;
  if (!value.startsWith("/") || value.startsWith("//")) return HOME;
  // strip anything that could smuggle a protocol
  if (value.includes("\u0000") || value.includes("\n")) return HOME;
  return value;
}

/**
 * GET /api/theme/preview — admin live-preview gateway.
 *
 *   ?rd_theme=<id>&token=<hmac>&next=/shop  → validate, set preview cookie,
 *                                             redirect into the storefront.
 *   ?exit=1                                 → clear the preview cookie.
 *
 * The token is an HMAC minted by /api/admin/themes/preview-token behind an
 * authenticated admin session + CSRF, so only admins can ever enter preview
 * mode. Nothing about the store's data changes during a preview.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = safeNext(url.searchParams.get("next"));

  if (url.searchParams.get("exit")) {
    const headers = new Headers({ Location: HOME });
    headers.append(
      "Set-Cookie",
      `${THEME_PREVIEW_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
    );
    return new Response(null, { status: 302, headers });
  }

  const themeId = url.searchParams.get("rd_theme") ?? "";
  const token = url.searchParams.get("token") ?? "";
  if (!isThemeId(themeId) || !verifyThemePreviewToken(themeId, token)) {
    // Invalid/forged token: simply land on the storefront with the ACTIVE
    // theme — never expose why, never enable a preview.
    return new Response(null, { status: 302, headers: { Location: HOME } });
  }

  const headers = new Headers({ Location: target });
  headers.append(
    "Set-Cookie",
    [
      `${THEME_PREVIEW_COOKIE}=${themeId}:${token}`,
      "Path=/",
      `Max-Age=${THEME_PREVIEW_MAX_AGE_SECONDS}`,
      "HttpOnly",
      "SameSite=Lax",
    ].join("; "),
  );
  return new Response(null, { status: 302, headers });
}
