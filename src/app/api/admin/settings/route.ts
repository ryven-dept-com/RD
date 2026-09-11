import { applySettingsPatch } from "@/lib/settings";
import { verifyRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * Save a settings patch (Phase 3).
 *
 * IMPORTANT semantics fix: only keys present in the request body are
 * validated and written. Keys that are absent are left untouched — the
 * Phase 2 implementation looped over a fixed key list and wrote an empty
 * string for every key missing from the payload, which silently wiped
 * stored settings whenever a partial/stale payload arrived. That was the
 * root cause of "saved settings not persisting".
 *
 * The response includes the authoritative settings map as stored in the
 * database so the client can re-sync its form state from the source of
 * truth after saving.
 */
export async function PUT(request: Request) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json(
        { ok: false, error: "Invalid request body" },
        { status: 400 },
      );
    }

    const result = await applySettingsPatch(body as Record<string, unknown>);
    if (!result.ok) {
      return Response.json(
        { ok: false, errors: result.errors },
        { status: 400 },
      );
    }

    return Response.json({ ok: true, settings: result.saved });
  } catch (err) {
    console.error("PUT /api/admin/settings failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
