import { db } from "@/db";
import { products } from "@/db/schema";
import { sql } from "drizzle-orm";
import { bootstrapIfNeeded } from "@/lib/seed-db";

export const dynamic = "force-dynamic";

// Explicit/manual bootstrap trigger: ensures the schema + reference data
// exist and performs the ONE-TIME catalogue initialization on a brand-new
// database. Once the store is initialized this endpoint is a safe no-op for
// products — it NEVER recreates products an admin deleted. It is only ever
// invoked by a direct request, never automatically by storefront/admin
// request handling (those paths share the same idempotent bootstrap, which
// is equally safe).
export async function GET() {
  try {
    await bootstrapIfNeeded(db);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(products);
    return Response.json({ ok: true, productCount: Number(count) });
  } catch (err) {
    console.error("GET /api/seed failed:", err);
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
