import { listActiveZonesPublic } from "@/lib/delivery-admin";
import { getStoreSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * Public (Phase 8): the ACTIVE delivery zones with per-method availability,
 * prices and estimates. This is customer-facing shipping configuration — it
 * contains no secrets; the checkout API still re-verifies every price
 * server-side at order time.
 */
export async function GET() {
  try {
    // The setting is stored in whole DZD; the public API only ever emits
    // INTEGER CENTS so no client can mix the units up.
    let freeShippingThresholdCents = 5000 * 100;
    try {
      const store = await getStoreSettings();
      freeShippingThresholdCents = store.freeShippingThreshold * 100;
    } catch {
      // settings unavailable — keep the safe default
    }
    const zones = await listActiveZonesPublic();
    return Response.json(
      { ok: true, zones, freeShippingThreshold: freeShippingThresholdCents },
      {
        headers: {
          // Shipping configuration is public read data; checkout still
          // re-verifies every price server-side at order time.
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
        },
      },
    );
  } catch (err) {
    console.error("GET /api/delivery/zones failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
