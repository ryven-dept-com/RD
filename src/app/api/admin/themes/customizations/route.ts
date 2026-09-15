import "server-only";
import { verifyRequest } from "@/lib/admin-auth";
import { applySettingsPatch, getStoreSettings } from "@/lib/settings";
import {
  EMPTY_CUSTOMIZATION,
  sanitizeCustomization,
  type ThemeCustomizationMap,
} from "@/themes/customize";
import { isThemeId } from "@/themes/types";

export const dynamic = "force-dynamic";

/**
 * Theme customization store (presentation-only).
 *
 *   GET    → every theme's saved customization (sanitized)
 *   PUT    → { themeId, customization } — validated & merged per theme
 *   DELETE → { themeId } — reset one theme to its original design
 *
 * Security model is identical to the rest of the admin surface:
 * authenticated session + CSRF (verifyRequest), server-side validation of
 * every font/color value, and writes go through the settings pipeline.
 * Customizations NEVER touch products, orders, delivery pricing, tracking or
 * any other business data — they are rendered as scoped CSS variables only.
 */

async function readMap(): Promise<ThemeCustomizationMap> {
  try {
    const store = await getStoreSettings();
    return store.themeCustomizations;
  } catch {
    return {};
  }
}

async function writeMap(map: ThemeCustomizationMap) {
  // Drop empty entries so the stored JSON stays minimal.
  const clean: ThemeCustomizationMap = {};
  for (const [id, cust] of Object.entries(map)) {
    if (cust && (Object.keys(cust.fonts).length || Object.keys(cust.colors).length)) {
      clean[id as keyof ThemeCustomizationMap] = cust;
    }
  }
  return applySettingsPatch({ themeCustomizations: JSON.stringify(clean) });
}

export async function GET(request: Request) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return Response.json({ ok: true, customizations: await readMap() });
}

export async function PUT(request: Request) {
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

  const incoming = sanitizeCustomization(
    (body as Record<string, unknown>).customization,
  );

  const map = await readMap();
  const merged = { ...map, [themeId]: incoming };
  const result = await writeMap(merged);
  if (!result.ok) {
    return Response.json({ ok: false, errors: result.errors }, { status: 400 });
  }
  return Response.json({ ok: true, themeId, customization: incoming });
}

export async function DELETE(request: Request) {
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

  const map = await readMap();
  delete map[themeId];
  const result = await writeMap(map);
  if (!result.ok) {
    return Response.json({ ok: false, errors: result.errors }, { status: 400 });
  }
  return Response.json({ ok: true, themeId, customization: EMPTY_CUSTOMIZATION });
}
