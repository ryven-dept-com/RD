import { db } from "@/db";
import { deliveryZones } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyRequest } from "@/lib/admin-auth";
import { listZonesAdmin, validateZoneInput } from "@/lib/delivery-admin";

export const dynamic = "force-dynamic";

/** Admin delivery zone list: search, active filter and sorting. */
export async function GET(request: Request) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const active = searchParams.get("active") ?? "all";
    const sort = searchParams.get("sort") ?? "code";
    const zones = await listZonesAdmin({
      q: searchParams.get("q") ?? undefined,
      active: active === "active" || active === "inactive" ? active : "all",
      sort:
        sort === "wilaya" || sort === "price-desc" || sort === "price-asc"
          ? sort
          : "code",
    });
    return Response.json({
      ok: true,
      zones: zones.map((z) => ({
        ...z,
        createdAt: z.createdAt.toISOString(),
        updatedAt: z.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("GET /api/admin/delivery failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}

/** Create a delivery zone (wilaya code must be unique). */
export async function POST(request: Request) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const valid = validateZoneInput(body, { requireCode: true });
    if (!valid.ok) {
      return Response.json({ ok: false, error: valid.error }, { status: 400 });
    }
    const { zone } = valid;

    const [clash] = await db
      .select({ id: deliveryZones.id })
      .from(deliveryZones)
      .where(eq(deliveryZones.code, zone.code))
      .limit(1);
    if (clash) {
      return Response.json(
        { ok: false, error: "A zone with this wilaya code already exists", code: "ZONE_EXISTS" },
        { status: 409 },
      );
    }

    const [created] = await db
      .insert(deliveryZones)
      .values({ ...zone, estimatedTime: zone.homeEstimatedTime || "2-4 أيام" })
      .returning();
    return Response.json({ ok: true, zone: created }, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/delivery failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
