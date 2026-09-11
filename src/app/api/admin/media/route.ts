import { db } from "@/db";
import { mediaFiles } from "@/db/schema";
import { desc } from "drizzle-orm";
import { getCurrentAdmin, verifyRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// Media is stored as BYTEA in the production database — the project has no
// external object storage configured, so this is the safest compatible
// persistent mechanism. Strict caps keep rows bounded.
const MAX_MEDIA_BYTES = 8 * 1024 * 1024; // 8 MB per file

const ALLOWED_TYPES: Record<string, "image" | "video" | "audio"> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "image/avif": "image",
  "image/svg+xml": "image",
  "video/mp4": "video",
  "video/webm": "video",
  "audio/mpeg": "audio",
  "audio/mp3": "audio",
  "audio/wav": "audio",
  "audio/x-wav": "audio",
  "audio/ogg": "audio",
  "audio/mp4": "audio",
};

/** List media (without binary payloads). Requires an admin session. */
export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await db
      .select({
        id: mediaFiles.id,
        originalName: mediaFiles.originalName,
        mimeType: mediaFiles.mimeType,
        kind: mediaFiles.kind,
        size: mediaFiles.size,
        createdAt: mediaFiles.createdAt,
      })
      .from(mediaFiles)
      .orderBy(desc(mediaFiles.createdAt), desc(mediaFiles.id))
      .limit(500);

    return Response.json({
      ok: true,
      media: rows.map((r) => ({
        ...r,
        url: `/api/media/${r.id}`,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("GET /api/admin/media failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}

/** Upload a single file (multipart/form-data, field "file"). */
export async function POST(request: Request) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return Response.json(
        { ok: false, error: "Expected multipart/form-data" },
        { status: 400 },
      );
    }

    const file = form.get("file");
    if (!file || typeof file === "string") {
      return Response.json(
        { ok: false, error: "No file provided" },
        { status: 400 },
      );
    }

    const mimeType = (file.type || "application/octet-stream")
      .toLowerCase()
      .split(";")[0]
      .trim();
    const kind = ALLOWED_TYPES[mimeType];
    if (!kind) {
      return Response.json(
        {
          ok: false,
          error:
            "Unsupported file type. Allowed: JPG, PNG, WebP, GIF, AVIF, SVG, MP4, WebM, MP3, WAV, OGG.",
        },
        { status: 400 },
      );
    }

    if (file.size > MAX_MEDIA_BYTES) {
      return Response.json(
        { ok: false, error: "File too large — maximum size is 8 MB." },
        { status: 400 },
      );
    }

    const originalName = (file.name || "upload").slice(0, 200);
    const data = Buffer.from(await file.arrayBuffer());

    const [inserted] = await db
      .insert(mediaFiles)
      .values({
        originalName,
        mimeType,
        kind,
        size: data.byteLength,
        data,
      })
      .returning({ id: mediaFiles.id });

    return Response.json(
      {
        ok: true,
        media: {
          id: inserted.id,
          originalName,
          mimeType,
          kind,
          size: data.byteLength,
          url: `/api/media/${inserted.id}`,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST /api/admin/media failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
