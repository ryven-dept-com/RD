import { verifyRequest } from "@/lib/admin-auth";
import { listAdminNotifications } from "@/lib/admin-notifications";

export const dynamic = "force-dynamic";

/**
 * Admin notification history for the private mobile admin app.
 *
 * Requires an authenticated admin session + CSRF token. Notifications are
 * recorded for every new customer order even when no push provider is
 * configured, so the app always has a complete, real history — nothing is
 * simulated, and nothing here is ever public.
 */
export async function GET(request: Request) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit")) || 50;
    const notifications = await listAdminNotifications(limit);
    return Response.json({ ok: true, notifications });
  } catch (err) {
    console.error("GET /api/admin/notifications failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
