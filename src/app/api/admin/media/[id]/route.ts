import { db } from "@/db";
import { cmsBlocks, mediaFiles, products, settings } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { verifyRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * Delete media safely: refuses to delete files that are still referenced by
 * CMS content, product images or settings (logo/favicon/OG image).
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const mediaId = Number(id);
  if (!Number.isFinite(mediaId) || mediaId <= 0) {
    return Response.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  try {
    const [exists] = await db
      .select({ id: mediaFiles.id })
      .from(mediaFiles)
      .where(eq(mediaFiles.id, mediaId))
      .limit(1);
    if (!exists) {
      return Response.json(
        { ok: false, error: "Media not found" },
        { status: 404 },
      );
    }

    // Reference scan across every place a media URL can be stored.
    const ref = `/api/media/${mediaId}`;
    const [cmsRefs] = await db
      .select({ c: sql<number>`count(*)` })
      .from(cmsBlocks)
      .where(sql`position(${ref} in ${cmsBlocks.data}::text) > 0`);
    const [productRefs] = await db
      .select({ c: sql<number>`count(*)` })
      .from(products)
      .where(sql`position(${ref} in ${products.images}::text) > 0`);
    const [settingRefs] = await db
      .select({ c: sql<number>`count(*)` })
      .from(settings)
      .where(sql`position(${ref} in ${settings.value}) > 0`);

    const referenced =
      Number(cmsRefs?.c ?? 0) +
        Number(productRefs?.c ?? 0) +
        Number(settingRefs?.c ?? 0) >
      0;
    if (referenced) {
      return Response.json(
        {
          ok: false,
          error:
            "This file is still used by store content. Remove it there first.",
        },
        { status: 409 },
      );
    }

    await db.delete(mediaFiles).where(eq(mediaFiles.id, mediaId));
    return Response.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/media/[id] failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
