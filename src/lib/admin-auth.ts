import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { db } from "@/db";
import { adminSessions, adminUsers, type AdminUser } from "@/db/schema";
import { and, eq, gt, lt } from "drizzle-orm";

export const SESSION_COOKIE = "ruven_admin_session";
const SESSION_DAYS = 7;
const SECRET =
  process.env.ADMIN_SECRET ?? "ruven-dept-admin-secret-change-me-in-prod";

// ---------- password hashing (password_hash / password_verify equivalent) ----

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, salt, hash] = stored.split("$");
    if (scheme !== "scrypt" || !salt || !hash) return false;
    const derived = scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, "hex");
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

// ---------- sessions --------------------------------------------------------

export async function createSession(userId: number): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(adminSessions).values({ token, userId, expiresAt });
  // opportunistic cleanup of expired sessions
  await db.delete(adminSessions).where(lt(adminSessions.expiresAt, new Date()));
  return token;
}

export async function destroySession(token: string): Promise<void> {
  await db.delete(adminSessions).where(eq(adminSessions.token, token));
}

export type AdminSessionUser = Pick<
  AdminUser,
  "id" | "username" | "displayName"
>;

export async function getAdminFromToken(
  token: string | undefined,
): Promise<AdminSessionUser | null> {
  if (!token) return null;
  try {
    const rows = await db
      .select({
        id: adminUsers.id,
        username: adminUsers.username,
        displayName: adminUsers.displayName,
      })
      .from(adminSessions)
      .innerJoin(adminUsers, eq(adminSessions.userId, adminUsers.id))
      .where(
        and(
          eq(adminSessions.token, token),
          gt(adminSessions.expiresAt, new Date()),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function getCurrentAdmin(): Promise<AdminSessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return getAdminFromToken(token);
}

/** Server-side guard: redirect to login when not authenticated. */
export async function requireAdmin(): Promise<AdminSessionUser> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

// ---------- CSRF (double-submit, bound to session token) --------------------

export function csrfTokenFor(sessionToken: string): string {
  return createHmac("sha256", SECRET).update(sessionToken).digest("hex");
}

export async function getCsrfToken(): Promise<string> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return "";
  return csrfTokenFor(token);
}

/** Validate an incoming request's session + CSRF. Returns admin or null. */
export async function verifyRequest(
  request: Request,
): Promise<AdminSessionUser | null> {
  const store = await cookies();
  const sessionToken = store.get(SESSION_COOKIE)?.value;
  const admin = await getAdminFromToken(sessionToken);
  if (!admin || !sessionToken) return null;

  const sent =
    request.headers.get("x-csrf-token") ??
    request.headers.get("X-CSRF-Token") ??
    "";
  const expected = csrfTokenFor(sessionToken);
  if (
    sent.length !== expected.length ||
    !timingSafeEqual(Buffer.from(sent), Buffer.from(expected))
  ) {
    return null;
  }
  return admin;
}

export function sessionCookieOptions(maxAgeDays = SESSION_DAYS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeDays * 24 * 60 * 60,
  };
}
