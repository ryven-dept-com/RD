import { cookies } from "next/headers";
import { db } from "@/db";
import { adminUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  SESSION_COOKIE,
  createSession,
  csrfTokenFor,
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

    // Non-browser admin clients (the private mobile admin app) cannot read
    // the SSR-injected CSRF token, so it is returned here after successful
    // authentication. It is session-bound and carries no privilege beyond
    // the session cookie that accompanies it.
    return Response.json({ ok: true, csrfToken: csrfTokenFor(token) });
  } catch (err) {
    console.error("POST /api/admin/login failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
