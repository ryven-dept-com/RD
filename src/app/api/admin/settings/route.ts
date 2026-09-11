import { db } from "@/db";
import { settings } from "@/db/schema";
import { sql } from "drizzle-orm";
import { verifyRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const ALLOWED_KEYS = [
  "storeName",
  "contactEmail",
  "contactPhone",
  "address",
  "freeShippingThreshold",
  "currency",
  "announcement",
];

export async function PUT(request: Request) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    for (const key of ALLOWED_KEYS) {
      const value = String(body[key] ?? "").slice(0, 500);
      await db
        .insert(settings)
        .values({ key, value })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: sql`excluded.value` },
        });
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/admin/settings failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
