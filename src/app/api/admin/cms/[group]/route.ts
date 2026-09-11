import { db } from "@/db";
import { cmsBlocks, CMS_BLOCK_TYPES, type CmsBlockType } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { verifyRequest } from "@/lib/admin-auth";
import { bool, sanitizeHref, str } from "@/lib/cms";

export const dynamic = "force-dynamic";

const GROUP_TYPES: Record<string, CmsBlockType[]> = {
  hero: ["hero"],
  collections: ["collection"],
  featured: ["featured"],
  newArrivals: ["new_arrival"],
  brandStory: ["brand_story"],
  banners: ["promo"],
  announcement: ["announcement"],
  newsletter: ["newsletter"],
  footer: ["footer"],
};

type PreparedRow = {
  type: CmsBlockType;
  position: number;
  enabled: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  data: Record<string, unknown>;
};

function toDate(value: unknown): Date | null {
  const iso = typeof value === "string" && value.trim() ? new Date(value) : null;
  return iso && !Number.isNaN(iso.getTime()) ? iso : null;
}

function err(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}

function prepareGroup(
  group: string,
  body: Record<string, unknown>,
): PreparedRow[] | { error: string } {
  switch (group) {
    case "hero": {
      const d = body;
      return [
        {
          type: "hero",
          position: 0,
          enabled: bool(d.enabled, true),
          startsAt: null,
          endsAt: null,
          data: {
            eyebrow: str(d.eyebrow, 120),
            title: str(d.title, 300),
            subtitle: str(d.subtitle, 1000),
            primaryText: str(d.primaryText, 80),
            primaryLink: sanitizeHref(d.primaryLink, "/shop"),
            secondaryText: str(d.secondaryText, 80),
            secondaryLink: sanitizeHref(d.secondaryLink),
            backgroundImage: str(d.backgroundImage, 2000),
            backgroundImageMobile: str(d.backgroundImageMobile, 2000),
            video: str(d.video, 2000),
            audio: str(d.audio, 2000),
          },
        },
      ];
    }
    case "collections": {
      const items = Array.isArray(body.items) ? body.items.slice(0, 12) : [];
      return items.map((raw, i) => {
        const it = (raw ?? {}) as Record<string, unknown>;
        return {
          type: "collection",
          position: i,
          enabled: bool(it.enabled, true),
          startsAt: null,
          endsAt: null,
          data: {
            title: str(it.title, 120),
            tag: str(it.tag, 80),
            description: str(it.description, 300),
            image: str(it.image, 2000),
            link: sanitizeHref(it.link, "/shop"),
          },
        };
      });
    }
    case "featured":
    case "newArrivals": {
      const items = Array.isArray(body.items) ? body.items.slice(0, 24) : [];
      const type: CmsBlockType = group === "featured" ? "featured" : "new_arrival";
      const rows: PreparedRow[] = [];
      for (const raw of items) {
        const productId = Number((raw as Record<string, unknown>)?.productId);
        if (!Number.isFinite(productId) || productId <= 0) {
          return { error: "Each item needs a valid productId" };
        }
        rows.push({
          type,
          position: rows.length,
          enabled: true,
          startsAt: null,
          endsAt: null,
          data: { productId },
        });
      }
      return rows;
    }
    case "brandStory": {
      const d = body;
      return [
        {
          type: "brand_story",
          position: 0,
          enabled: bool(d.enabled, true),
          startsAt: null,
          endsAt: null,
          data: {
            title: str(d.title, 300),
            description: str(d.description, 2000),
            image: str(d.image, 2000),
            ctaText: str(d.ctaText, 80),
            ctaLink: sanitizeHref(d.ctaLink, "/shop"),
          },
        },
      ];
    }
    case "banners": {
      const items = Array.isArray(body.items) ? body.items.slice(0, 8) : [];
      return items.map((raw, i) => {
        const it = (raw ?? {}) as Record<string, unknown>;
        return {
          type: "promo",
          position: i,
          enabled: bool(it.enabled, true),
          startsAt: toDate(it.startsAt),
          endsAt: toDate(it.endsAt),
          data: {
            title: str(it.title, 160),
            text: str(it.text, 600),
            image: str(it.image, 2000),
            ctaText: str(it.ctaText, 80),
            ctaLink: sanitizeHref(it.ctaLink),
          },
        };
      });
    }
    case "announcement": {
      const d = body;
      return [
        {
          type: "announcement",
          position: 0,
          enabled: bool(d.enabled, false),
          startsAt: toDate(d.startsAt),
          endsAt: toDate(d.endsAt),
          data: {
            text: str(d.text, 300),
            link: sanitizeHref(d.link),
          },
        },
      ];
    }
    case "newsletter": {
      const d = body;
      return [
        {
          type: "newsletter",
          position: 0,
          enabled: bool(d.enabled, true),
          startsAt: null,
          endsAt: null,
          data: {
            title: str(d.title, 120),
            description: str(d.description, 300),
            buttonText: str(d.buttonText, 40),
          },
        },
      ];
    }
    case "footer": {
      const d = body;
      const linkGroups = Array.isArray(d.linkGroups) ? d.linkGroups.slice(0, 6) : [];
      const socialLinks = Array.isArray(d.socialLinks) ? d.socialLinks.slice(0, 8) : [];
      return [
        {
          type: "footer",
          position: 0,
          enabled: true,
          startsAt: null,
          endsAt: null,
          data: {
            description: str(d.description, 600),
            showContact: bool(d.showContact, false),
            copyright: str(d.copyright, 200),
            linkGroups: linkGroups.map((raw) => {
              const g = (raw ?? {}) as Record<string, unknown>;
              return {
                title: str(g.title, 60),
                links: (Array.isArray(g.links) ? g.links.slice(0, 12) : []).map(
                  (l) => {
                    const link = (l ?? {}) as Record<string, unknown>;
                    return {
                      label: str(link.label, 60),
                      href: sanitizeHref(link.href, "/shop"),
                    };
                  },
                ),
              };
            }),
            socialLinks: socialLinks.map((raw) => {
              const s = (raw ?? {}) as Record<string, unknown>;
              return { label: str(s.label, 40), url: sanitizeHref(s.url) };
            }),
          },
        },
      ];
    }
    default:
      return { error: "Unknown content group" };
  }
}

/**
 * Replace all blocks of one CMS group atomically.
 * Body: { enabled?/fields… } for singletons, { items: [...] } for lists.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ group: string }> },
) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { group } = await params;
  const types = GROUP_TYPES[group];
  if (!types) {
    return err("Unknown content group", 404);
  }
  // Defensive: every mapped type must be a known block type.
  for (const t of types) {
    if (!CMS_BLOCK_TYPES.includes(t)) return err("Invalid block type", 500);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return err("Invalid JSON body");
  }

  const prepared = prepareGroup(group, body);
  if (!Array.isArray(prepared)) return err(prepared.error);

  try {
    await db.transaction(async (tx) => {
      await tx.delete(cmsBlocks).where(inArray(cmsBlocks.type, types));
      if (prepared.length) {
        await tx.insert(cmsBlocks).values(prepared);
      }
    });
    return Response.json({ ok: true });
  } catch (errRes) {
    console.error(`PUT /api/admin/cms/${group} failed:`, errRes);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
