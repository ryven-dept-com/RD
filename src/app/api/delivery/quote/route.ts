import {
  getZoneByCode,
  isShippingMethod,
  quoteShipping,
} from "@/lib/delivery-admin";
import { getStoreSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const FALLBACK_FREE_SHIP_THRESHOLD = 5000; // whole DZD (bureau-only free shipping)

/**
 * Public (Phase 8): server-computed shipping quote for the checkout UX.
 * The client NEVER computes or supplies the final shipping fee — this
 * endpoint (and the checkout API, which calls the same logic) is the only
 * source of truth. Invalid zone/method combinations return structured
 * errors so the storefront can show them clearly.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = Number(searchParams.get("zone"));
    const method = searchParams.get("method") ?? "";
    const subtotal = Number(searchParams.get("subtotal"));

    if (!Number.isFinite(code) || code <= 0) {
      return Response.json(
        { ok: false, error: "Invalid delivery zone" },
        { status: 400 },
      );
    }
    if (!isShippingMethod(method)) {
      return Response.json(
        { ok: false, error: "Invalid shipping method" },
        { status: 400 },
      );
    }
    if (!Number.isFinite(subtotal) || subtotal < 0) {
      return Response.json(
        { ok: false, error: "Invalid subtotal" },
        { status: 400 },
      );
    }

    let threshold = FALLBACK_FREE_SHIP_THRESHOLD;
    try {
      const store = await getStoreSettings();
      threshold = store.freeShippingThreshold;
    } catch {
      // settings unavailable — keep the safe default
    }

    const zone = await getZoneByCode(Math.floor(code));
    if (!zone || !zone.enabled) {
      return Response.json(
        { ok: false, error: "Delivery zone is not available", code: "ZONE_INACTIVE" },
        { status: 404 },
      );
    }
    const quote = quoteShipping(zone, method, Math.floor(subtotal), threshold);
    if (!quote) {
      return Response.json(
        {
          ok: false,
          error: "Shipping method is not available for this zone",
          code: "METHOD_UNAVAILABLE",
        },
        { status: 404 },
      );
    }
    return Response.json({ ok: true, quote });
  } catch (err) {
    console.error("GET /api/delivery/quote failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
