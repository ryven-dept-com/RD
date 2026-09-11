import { db } from "@/db";
import { mediaFiles } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Public media delivery. Uploaded files live in the database (BYTEA) and are
 * streamed from here with long-lived immutable caching, so CMS content that
 * references /api/media/{id} stays fast and stable.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const mediaId = Number(id);
  if (!Number.isFinite(mediaId) || mediaId <= 0) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const [file] = await db
      .select({
        data: mediaFiles.data,
        mimeType: mediaFiles.mimeType,
        originalName: mediaFiles.originalName,
      })
      .from(mediaFiles)
      .where(eq(mediaFiles.id, mediaId))
      .limit(1);

    if (!file) {
      return new Response("Not found", { status: 404 });
    }

    return new Response(new Uint8Array(file.data), {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(file.originalName)}"`,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("GET /api/media/[id] failed:", err);
    return new Response("Server error", { status: 500 });
  }
}
