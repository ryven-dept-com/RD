import "server-only";
import { verifyRequest } from "@/lib/admin-auth";
import {
  publishBuilder,
  resetBuilderDraft,
  rollbackBuilder,
} from "@/lib/builder/storage";

export const dynamic = "force-dynamic";

/**
 * Builder versioning actions:
 *   { action: "publish" }          → draft becomes the published storefront
 *   { action: "rollback", index }  → restore a history snapshot
 *   { action: "reset" }            → discard the draft
 *
 * Every action re-sanitizes the whole document and writes ONE row, so a
 * failed save can never leave a half-written published configuration.
 */
export async function POST(request: Request) {
  const admin = await verifyRequest(request);
  if (!admin) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  let body: { action?: string; index?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  try {
    if (body.action === "publish") {
      return Response.json({ ok: true, store: await publishBuilder() });
    }
    if (body.action === "rollback") {
      const store = await rollbackBuilder(Number(body.index) || 0);
      return Response.json({ ok: true, store });
    }
    if (body.action === "reset") {
      return Response.json({ ok: true, store: await resetBuilderDraft() });
    }
    return Response.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("builder publish action failed:", err);
    return Response.json({ ok: false, error: "Action failed — previous configuration preserved" }, { status: 500 });
  }
}
