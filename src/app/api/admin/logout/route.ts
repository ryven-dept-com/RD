import { cookies } from "next/headers";
import { SESSION_COOKIE, destroySession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await destroySession(token);
  store.delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
