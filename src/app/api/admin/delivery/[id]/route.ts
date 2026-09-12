import { db } from "@/db";
import { deliveryZones } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyRequest } from "@/lib/admin-auth";
import {
  deleteZoneSafely,
  sanitizeEstimate,
  sanitizePrice,
  validateZoneInput,
} from "@/lib/delivery-admin";

export const dynamic = "force-dynamic";

function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

/** Admin zone detail. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const zoneId = parseId(id);
  if (!zoneId) {
    return Response.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }
  const [zone] = await db
    .select()
    .from(deliveryZones)
    .where(eq(deliveryZones.id, zoneId))
    .limit(1);
  if (!zone) {
    return Response.json({ ok: false, error: "Zone not found" }, { status: 404 });
  }
  return Response.json({
    ok: true,
    zone: {
      ...zone,
      createdAt: zone.createdAt.toISOString(),
      updatedAt: zone.updatedAt.toISOString(),
    },
  });
}

/**
 * Update a delivery zone. Supports BOTH payload shapes:
 *  - legacy inline-edit payload { price, estimatedTime, enabled } from the
 *    pre-Phase 8 admin UI (mapped onto the home-delivery method), and
 *  - the full Phase 8 payload (wilaya, city, status, home/pickup pricing,
 *    estimates, notes, sort order).
 * Prices are validated server-side; the wilaya code is immutable.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const zoneId = parseId(id);
  if (!zoneId) {
    return Response.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = await request.json();

    const isLegacyPayload =
      body.wilaya === undefined &&
      body.homePrice === undefined &&
      body.pickupPrice === undefined &&
      body.homeEnabled === undefined &&
      body.pickupEnabled === undefined;

    let updates: Partial<typeof deliveryZones.$inferInsert>;

    if (isLegacyPayload) {
      const price = sanitizePrice(body.price);
      const estimatedTime = sanitizeEstimate(body.estimatedTime);
      const enabled = Boolean(body.enabled);
      updates = {
        price,
        estimatedTime,
        enabled,
        // keep the home method in sync so both views of the zone agree
        homePrice: price,
        homeEstimatedTime: estimatedTime,
        updatedAt: new Date(),
      };
    } else {
      // Fetch the existing zone so partial payloads keep the current values.
      const [existing] = await db
        .select()
        .from(deliveryZones)
        .where(eq(deliveryZones.id, zoneId))
        .limit(1);
      if (!existing) {
        return Response.json({ ok: false, error: "Zone not found" }, { status: 404 });
      }
      const merged = {
        code: existing.code,
        wilaya: body.wilaya ?? existing.wilaya,
        slug: body.slug ?? existing.slug,
        city: body.city ?? existing.city,
        enabled: body.enabled ?? existing.enabled,
        homeEnabled: body.homeEnabled ?? existing.homeEnabled,
        homePrice: body.homePrice ?? existing.homePrice,
        homeEstimatedTime: body.homeEstimatedTime ?? existing.homeEstimatedTime,
        pickupEnabled: body.pickupEnabled ?? existing.pickupEnabled,
        pickupPrice: body.pickupPrice ?? existing.pickupPrice,
        pickupEstimatedTime: body.pickupEstimatedTime ?? existing.pickupEstimatedTime,
        notes: body.notes ?? existing.notes,
        sortOrder: body.sortOrder ?? existing.sortOrder,
      };
      const valid = validateZoneInput(merged, { requireCode: false });
      if (!valid.ok) {
        return Response.json({ ok: false, error: valid.error }, { status: 400 });
      }
      updates = {
        ...valid.zone,
        // legacy columns stay in sync (read by older tooling)
        price: valid.zone.homePrice,
        estimatedTime: valid.zone.homeEstimatedTime || existing.estimatedTime,
        updatedAt: new Date(),
      };
    }

    const updated = await db
      .update(deliveryZones)
      .set(updates)
      .where(eq(deliveryZones.id, zoneId))
      .returning();

    if (!updated.length) {
      return Response.json({ ok: false, error: "Zone not found" }, { status: 404 });
    }
    return Response.json({ ok: true, zone: updated[0] });
  } catch (err) {
    console.error("PATCH /api/admin/delivery/[id] failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}

/**
 * Safe delete: only DISABLED zones can be removed (409 otherwise). Orders
 * keep their immutable shipping snapshot, so history is never destroyed.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const zoneId = parseId(id);
  if (!zoneId) {
    return Response.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }
  try {
    const result = await deleteZoneSafely(zoneId);
    if (!result.ok) {
      return Response.json({ ok: false, error: result.error }, { status: result.status });
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/delivery/[id] failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
