import { cookies } from "next/headers";
import { db } from "@/db";
import { adminUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  SESSION_COOKIE,
  createSession,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body.username ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!username || !password) {
      return Response.json(
        { ok: false, error: "Username and password are required" },
        { status: 400 },
      );
    }

    const [user] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.username, username))
      .limit(1);

    // Constant-ish response to avoid user enumeration
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return Response.json(
        { ok: false, error: "Invalid username or password" },
        { status: 401 },
      );
    }

    const token = await createSession(user.id);
    const store = await cookies();
    // Session regeneration: fresh token issued on each successful login.
    store.set(SESSION_COOKIE, token, sessionCookieOptions());

    return Response.json({ ok: true });
  } catch (err) {
    console.error("POST /api/admin/login failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
