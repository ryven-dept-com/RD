import { db } from "@/db";
import { deliveryZones } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const zoneId = Number(id);
  if (!Number.isFinite(zoneId)) {
    return Response.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const priceN = Number(body.price);
    const price = Number.isFinite(priceN) && priceN >= 0 ? Math.floor(priceN) : 0;
    const estimatedTime = String(body.estimatedTime ?? "").trim().slice(0, 60);
    const enabled = Boolean(body.enabled);

    const updated = await db
      .update(deliveryZones)
      .set({ price, estimatedTime, enabled })
      .where(eq(deliveryZones.id, zoneId))
      .returning({ id: deliveryZones.id });

    if (!updated.length) {
      return Response.json({ ok: false, error: "Zone not found" }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/admin/delivery/[id] failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
