import { verifyRequest } from "@/lib/admin-auth";
import {
  listAdminDevices,
  registerAdminDevice,
  unregisterAdminDevice,
} from "@/lib/admin-notifications";

export const dynamic = "force-dynamic";

/**
 * Admin device registry for the private mobile admin app.
 *
 * Every handler requires an authenticated admin session + CSRF token
 * (verifyRequest). There is NO guest access and NO public registration:
 * only a logged-in admin can register the device that receives new-order
 * push notifications.
 */

/** List registered admin devices (tokens masked). */
export async function GET(request: Request) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const devices = await listAdminDevices();
    return Response.json({ ok: true, devices });
  } catch (err) {
    console.error("GET /api/admin/devices failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}

/** Register/refresh the authorized admin device for push notifications. */
export async function POST(request: Request) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const device = await registerAdminDevice({
      provider: body.provider,
      token: body.token,
      deviceName: body.deviceName,
    });
    return Response.json({ ok: true, device }, { status: 201 });
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === "Unsupported push provider" ||
        err.message === "Invalid device token")
    ) {
      return Response.json({ ok: false, error: err.message }, { status: 400 });
    }
    console.error("POST /api/admin/devices failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}

/** Unregister an admin device (body: { id }). */
export async function DELETE(request: Request) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const id = Number(body?.id);
    if (!Number.isFinite(id) || id <= 0 || Math.floor(id) !== id) {
      return Response.json({ ok: false, error: "Invalid id" }, { status: 400 });
    }
    const removed = await unregisterAdminDevice(id);
    if (!removed) {
      return Response.json({ ok: false, error: "Device not found" }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/devices failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
