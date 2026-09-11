import { eq } from "drizzle-orm";
import { db } from "@/db";
import { adminSessions, adminUsers } from "@/db/schema";
import { hashPassword, verifyPassword, verifyRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

/**
 * Change the admin password (Settings → Account & security).
 *
 * - Requires authenticated admin session + CSRF (verifyRequest).
 * - Verifies the current password against the stored scrypt hash first.
 * - Enforces a reasonable password policy (length, letters + digits).
 * - Stores only a fresh scrypt hash — never plaintext.
 * - Invalidates ALL admin sessions for the user afterwards, so every device
 *   (including the current one) must log in again with the new password.
 * - Never returns password hashes or other sensitive fields.
 */
export async function POST(request: Request) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");
    const confirmPassword = String(body.confirmPassword ?? "");

    const [user] = await db
      .select({ id: adminUsers.id, passwordHash: adminUsers.passwordHash })
      .from(adminUsers)
      .where(eq(adminUsers.id, admin.id))
      .limit(1);

    if (!user) {
      return Response.json({ ok: false, error: "Account not found" }, { status: 404 });
    }

    if (!verifyPassword(currentPassword, user.passwordHash)) {
      return Response.json(
        { ok: false, error: "Current password is incorrect" },
        { status: 400 },
      );
    }

    if (newPassword.length < MIN_LENGTH || newPassword.length > MAX_LENGTH) {
      return Response.json(
        {
          ok: false,
          error: `New password must be between ${MIN_LENGTH} and ${MAX_LENGTH} characters`,
        },
        { status: 400 },
      );
    }
    if (!/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      return Response.json(
        { ok: false, error: "New password must contain letters and numbers" },
        { status: 400 },
      );
    }
    if (newPassword === currentPassword) {
      return Response.json(
        { ok: false, error: "New password must be different from the current one" },
        { status: 400 },
      );
    }
    if (newPassword !== confirmPassword) {
      return Response.json(
        { ok: false, error: "Password confirmation does not match" },
        { status: 400 },
      );
    }

    await db
      .update(adminUsers)
      .set({ passwordHash: hashPassword(newPassword) })
      .where(eq(adminUsers.id, user.id));

    // Invalidate every session for this user, including the current one.
    await db.delete(adminSessions).where(eq(adminSessions.userId, user.id));

    return Response.json({ ok: true, relogin: true });
  } catch (err) {
    console.error("POST /api/admin/password failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
