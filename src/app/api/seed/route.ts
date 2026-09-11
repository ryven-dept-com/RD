import { db } from "@/db";
import { products } from "@/db/schema";
import { sql } from "drizzle-orm";
import { bootstrapIfNeeded } from "@/lib/seed-db";

export const dynamic = "force-dynamic";

// Idempotent bootstrap trigger: creates the schema if missing and seeds the
// catalogue + admin reference data when empty. Non-destructive — safe to call
// repeatedly. Also useful as a health/diagnostic endpoint.
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
