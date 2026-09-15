import "server-only";
import { verifyRequest } from "@/lib/admin-auth";
import {
  getBuilderStore,
  saveBuilderDraft,
} from "@/lib/builder/storage";

export const dynamic = "force-dynamic";

/**
 * Storefront Builder store (presentation-only configuration).
 *
 *   GET → { ok, store } (draft + published + history)
 *   PUT → { doc, label? } — validates & sanitizes the ENTIRE document
 *         server-side, snapshots the previous draft into history, saves.
 *
 * Auth: admin session + CSRF via verifyRequest. The document can never
 * carry business data — the sanitizer only keeps presentation fields.
 */

export async function GET(request: Request) {
  const admin = await verifyRequest(request);
  if (!admin) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const store = await getBuilderStore();
  return Response.json({ ok: true, store });
}

export async function PUT(request: Request) {
  const admin = await verifyRequest(request);
  if (!admin) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  let body: { doc?: unknown; label?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  try {
    const store = await saveBuilderDraft(body.doc, typeof body.label === "string" ? body.label.slice(0, 120) : "Save draft");
    return Response.json({ ok: true, store });
  } catch (err) {
    console.error("builder save failed:", err);
    // previous valid configuration is preserved by construction
    return Response.json({ ok: false, error: "Save failed — previous configuration preserved" }, { status: 500 });
  }
}
