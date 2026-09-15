import "server-only";
import { verifyRequest } from "@/lib/admin-auth";
import { mintBuilderPreviewToken } from "@/lib/builder/preview";

export const dynamic = "force-dynamic";

/**
 * Mint a short-lived live-preview token for the editor iframe. The token
 * only resolves inside the server-side session map; customers with no token
 * always see the published storefront.
 */
export async function POST(request: Request) {
  const admin = await verifyRequest(request);
  if (!admin) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  let body: { doc?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const token = mintBuilderPreviewToken(body.doc);
  return Response.json({ ok: true, token });
}
