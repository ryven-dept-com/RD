import "server-only";

import {
  BUILDER_PREVIEW_PARAM,
  getBuilderPreviewDoc,
} from "@/lib/builder/preview";

export const dynamic = "force-dynamic";

const HOME = "/";
const COOKIE_MAX_AGE_SECONDS = 30 * 60; // matches the in-memory session TTL

/** Only allow same-site relative targets (block //host and absolute URLs). */
function safeNext(value: string | null): string {
  if (!value) return HOME;
  if (!value.startsWith("/") || value.startsWith("//")) return HOME;
  if (value.includes("\u0000") || value.includes("\n")) return HOME;
  return value;
}

/**
 * GET /api/builder/preview — admin Storefront Builder preview gateway.
 *
 *   ?rd_bd=<token>&next=/shop → validate against the in-memory session map
 *                               (minted behind admin session + CSRF), set the
 *                               HttpOnly preview cookie, redirect inside.
 *   ?exit=1                   → clear the preview cookie.
 *
 * Unknown/expired/forged tokens silently land on the LIVE storefront — a
 * customer can never see a draft, and the token never persists in URLs.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = safeNext(url.searchParams.get("next"));

  if (url.searchParams.get("exit")) {
    const headers = new Headers({ Location: HOME });
    headers.append(
      "Set-Cookie",
      `${BUILDER_PREVIEW_PARAM}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
    );
    return new Response(null, { status: 302, headers });
  }

  const token = url.searchParams.get(BUILDER_PREVIEW_PARAM) ?? "";
  if (!getBuilderPreviewDoc(token)) {
    return new Response(null, { status: 302, headers: { Location: HOME } });
  }

  const headers = new Headers({ Location: target });
  headers.append(
    "Set-Cookie",
    [
      `${BUILDER_PREVIEW_PARAM}=${token}`,
      "Path=/",
      `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
      "HttpOnly",
      "SameSite=Lax",
    ].join("; "),
  );
  return new Response(null, { status: 302, headers });
}
