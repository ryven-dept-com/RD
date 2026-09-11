import { db } from "@/db";
import { categories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const catId = Number(id);
  if (!Number.isFinite(catId)) {
    return Response.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  try {
    await db.delete(categories).where(eq(categories.id, catId));
    return Response.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/categories/[id] failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
