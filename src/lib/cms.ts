import "server-only";
import { db } from "@/db";
import { cmsBlocks, settings, type CmsBlock } from "@/db/schema";
import { asc } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Storefront CMS content model.
//
// Every field falls back to the original hardcoded homepage content so the
// public storefront never renders blank when no CMS rows exist yet.
// ---------------------------------------------------------------------------

export type HeroContent = {
  enabled: boolean;
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryText: string;
  primaryLink: string;
  secondaryText: string;
  secondaryLink: string;
  backgroundImage: string;
  backgroundImageMobile: string;
  video: string;
  audio: string;
};

export type CollectionItem = {
  id?: number;
  enabled: boolean;
  title: string;
  tag: string;
  description: string;
  image: string;
  link: string;
};

export type BrandStoryContent = {
  enabled: boolean;
  title: string;
  description: string;
  image: string;
  ctaText: string;
  ctaLink: string;
};

export type PromoBanner = {
  id?: number;
  enabled: boolean;
  title: string;
  text: string;
  image: string;
  ctaText: string;
  ctaLink: string;
  startsAt: string | null; // ISO strings on the wire
  endsAt: string | null;
};

export type AnnouncementContent = {
  enabled: boolean;
  text: string;
  link: string;
  startsAt: string | null;
  endsAt: string | null;
};

export type NewsletterContent = {
  enabled: boolean;
  title: string; // input placeholder
  description: string; // optional caption under the form
  buttonText: string;
};

export type FooterLinkGroup = {
  title: string;
  links: { label: string; href: string }[];
};

export type SocialLink = {
  label: string;
  url: string;
};

export type FooterContent = {
  description: string;
  showContact: boolean; // contact details themselves live in `settings`
  copyright: string;
  socialLinks: SocialLink[];
  linkGroups: FooterLinkGroup[];
};

export type ProductListItem = {
  id?: number;
  productId: number;
};

export type HomepageContent = {
  hero: HeroContent;
  collections: CollectionItem[];
  collectionsFromCms: boolean;
  featured: ProductListItem[];
  newArrivals: ProductListItem[];
  brandStory: BrandStoryContent;
  banners: PromoBanner[];
  announcement: AnnouncementContent;
  newsletter: NewsletterContent;
  footer: FooterContent;
  marqueeItems: string[];
};

// --------------------------- defaults (fallback) ---------------------------

export const DEFAULT_HERO: HeroContent = {
  enabled: true,
  eyebrow: "Fall / Winter — Vol. 01",
  title: "Weight you\ncan feel.",
  subtitle:
    "Heavyweight essentials and utility outerwear, engineered in-house and built for the street. No logos shouting — just fabric that speaks.",
  primaryText: "Shop the drop",
  primaryLink: "/shop",
  secondaryText: "Terrain Collection",
  secondaryLink: "/shop?collection=Terrain",
  backgroundImage: "/images/hero.jpg",
  backgroundImageMobile: "",
  video: "",
  audio: "",
};

export const DEFAULT_COLLECTIONS: CollectionItem[] = [
  {
    enabled: true,
    title: "Vault 01",
    tag: "Core Blacks",
    description: "Heavyweight everyday armor.",
    image: "/images/collection-vault.jpg",
    link: "/shop?collection=Vault+01",
  },
  {
    enabled: true,
    title: "Terrain",
    tag: "Utility Outerwear",
    description: "Built for the elements.",
    image:
      "https://images.pexels.com/photos/7880141/pexels-photo-7880141.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=700",
    link: "/shop?collection=Terrain",
  },
  {
    enabled: true,
    title: "Static",
    tag: "Graphic Capsule",
    description: "Statement prints, faded finish.",
    image:
      "https://images.pexels.com/photos/33222517/pexels-photo-33222517.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=700",
    link: "/shop?collection=Static",
  },
];

export const DEFAULT_BRAND_STORY: BrandStoryContent = {
  enabled: true,
  title: "We obsess over grams,\nstitches, and drape.",
  description:
    "Ruven Dept. started in a small studio with a simple frustration: streetwear that looked the part but fell apart. So we went the other way — heavier fabrics, reinforced seams, and cuts refined over dozens of samples. Every piece is a tool you'll reach for on repeat.",
  image:
    "https://images.pexels.com/photos/30410057/pexels-photo-30410057.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=900",
  ctaText: "Explore the range",
  ctaLink: "/shop",
};

export const DEFAULT_ANNOUNCEMENT: AnnouncementContent = {
  enabled: false,
  text: "",
  link: "",
  startsAt: null,
  endsAt: null,
};

export const DEFAULT_NEWSLETTER: NewsletterContent = {
  enabled: true,
  title: "Email for 10% off",
  description: "",
  buttonText: "Join",
};

export const DEFAULT_FOOTER: FooterContent = {
  description:
    "Heavyweight essentials and utility outerwear, built for the street and everything past it. Designed in-house, made to outlast trends.",
  showContact: false,
  copyright: "Ruven Dept. All rights reserved.",
  socialLinks: [],
  linkGroups: [
    {
      title: "Shop",
      links: [
        { label: "New Arrivals", href: "/shop?filter=new" },
        { label: "Best Sellers", href: "/shop?filter=best" },
        { label: "Hoodies", href: "/shop?category=Hoodies" },
        { label: "Jackets", href: "/shop?category=Jackets" },
        { label: "Footwear", href: "/shop?category=Footwear" },
      ],
    },
    {
      title: "Collections",
      links: [
        { label: "Vault 01", href: "/shop?collection=Vault+01" },
        { label: "Static", href: "/shop?collection=Static" },
        { label: "Terrain", href: "/shop?collection=Terrain" },
        { label: "Relay", href: "/shop?collection=Relay" },
        { label: "Apex", href: "/shop?collection=Apex" },
      ],
    },
    {
      title: "Support",
      links: [
        { label: "Shipping & Returns", href: "/shop" },
        { label: "Size Guide", href: "/shop" },
        { label: "Track Order", href: "/shop" },
        { label: "Contact", href: "/shop" },
      ],
    },
  ],
};

export const DEFAULT_MARQUEE = [
  "FREE SHIPPING OVER $150",
  "480 GSM HEAVYWEIGHT FLEECE",
  "30-DAY RETURNS",
  "DESIGNED IN-HOUSE",
  "NEW DROP — TERRAIN COLLECTION",
  "10% OFF YOUR FIRST ORDER",
];

// ------------------------------ sanitization -------------------------------

/** Only allow safe link targets (internal paths, http(s), mailto, tel). */
export function sanitizeHref(value: unknown, fallback = ""): string {
  const raw = String(value ?? "").trim().slice(0, 2000);
  if (!raw) return fallback;
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^mailto:[^\s@]+@[^\s@]+/i.test(raw)) return raw;
  if (/^tel:[+\d\s()-]+$/i.test(raw)) return raw;
  return fallback;
}

export function str(value: unknown, max: number, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  return value.slice(0, max);
}

/** Like str(), but also falls back when the stored value is empty — used for
 * required storefront fields so a cleared CMS field never blanks the page. */
function strOr(value: unknown, max: number, fallback: string): string {
  const s = str(value, max, fallback).trim();
  return s || fallback;
}

export function bool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function isoOrNull(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// ------------------------------- parsing -----------------------------------

type BlockRow = Pick<
  CmsBlock,
  "id" | "type" | "position" | "enabled" | "startsAt" | "endsAt" | "data"
>;

function parseHero(block: BlockRow | undefined): HeroContent {
  if (!block) return { ...DEFAULT_HERO };
  const d = block.data;
  return {
    enabled: block.enabled,
    eyebrow: strOr(d.eyebrow, 120, DEFAULT_HERO.eyebrow),
    title: strOr(d.title, 300, DEFAULT_HERO.title),
    subtitle: strOr(d.subtitle, 1000, DEFAULT_HERO.subtitle),
    primaryText: strOr(d.primaryText, 80, DEFAULT_HERO.primaryText),
    primaryLink: sanitizeHref(d.primaryLink) || DEFAULT_HERO.primaryLink,
    secondaryText: str(d.secondaryText, 80, ""),
    secondaryLink: sanitizeHref(d.secondaryLink, ""),
    backgroundImage: strOr(d.backgroundImage, 2000, DEFAULT_HERO.backgroundImage),
    backgroundImageMobile: str(d.backgroundImageMobile, 2000, ""),
    video: str(d.video, 2000, ""),
    audio: str(d.audio, 2000, ""),
  };
}

function parseCollections(rows: BlockRow[]): CollectionItem[] | null {
  if (!rows.length) return null;
  return rows.map((r) => ({
    id: r.id,
    enabled: r.enabled,
    title: str(r.data.title, 120),
    tag: str(r.data.tag, 80),
    description: str(r.data.description, 300),
    image: str(r.data.image, 2000),
    link: sanitizeHref(r.data.link, "/shop"),
  }));
}

function parseProductList(rows: BlockRow[]): ProductListItem[] {
  return rows
    .map((r) => ({
      id: r.id,
      productId: Number(r.data.productId),
    }))
    .filter((x) => Number.isFinite(x.productId) && x.productId > 0);
}

function parseBrandStory(block: BlockRow | undefined): BrandStoryContent {
  if (!block) return { ...DEFAULT_BRAND_STORY };
  const d = block.data;
  return {
    enabled: block.enabled,
    title: strOr(d.title, 300, DEFAULT_BRAND_STORY.title),
    description: strOr(d.description, 2000, DEFAULT_BRAND_STORY.description),
    image: strOr(d.image, 2000, DEFAULT_BRAND_STORY.image),
    ctaText: strOr(d.ctaText, 80, DEFAULT_BRAND_STORY.ctaText),
    ctaLink: sanitizeHref(d.ctaLink) || DEFAULT_BRAND_STORY.ctaLink,
  };
}

function parseBanners(rows: BlockRow[]): PromoBanner[] {
  return rows.map((r) => ({
    id: r.id,
    enabled: r.enabled,
    title: str(r.data.title, 160),
    text: str(r.data.text, 600),
    image: str(r.data.image, 2000),
    ctaText: str(r.data.ctaText, 80),
    ctaLink: sanitizeHref(r.data.ctaLink),
    startsAt: r.startsAt ? r.startsAt.toISOString() : null,
    endsAt: r.endsAt ? r.endsAt.toISOString() : null,
  }));
}

function parseAnnouncement(block: BlockRow | undefined): AnnouncementContent {
  if (!block) return { ...DEFAULT_ANNOUNCEMENT };
  return {
    enabled: block.enabled,
    text: str(block.data.text, 300),
    link: sanitizeHref(block.data.link),
    startsAt: block.startsAt ? block.startsAt.toISOString() : null,
    endsAt: block.endsAt ? block.endsAt.toISOString() : null,
  };
}

function parseNewsletter(block: BlockRow | undefined): NewsletterContent {
  if (!block) return { ...DEFAULT_NEWSLETTER };
  const d = block.data;
  return {
    enabled: block.enabled,
    title: strOr(d.title, 120, DEFAULT_NEWSLETTER.title),
    description: str(d.description, 300, ""),
    buttonText: strOr(d.buttonText, 40, DEFAULT_NEWSLETTER.buttonText),
  };
}

function parseFooter(block: BlockRow | undefined): FooterContent {
  const base = block ? block.data : {};
  const rawGroups = Array.isArray(base.linkGroups) ? base.linkGroups : [];
  const linkGroups: FooterLinkGroup[] = rawGroups
    .map((g) => ({
      title: str((g as Record<string, unknown>)?.title, 60),
      links: Array.isArray((g as Record<string, unknown>)?.links)
        ? ((g as Record<string, unknown>).links as unknown[])
            .map((l) => ({
              label: str((l as Record<string, unknown>)?.label, 60),
              href: sanitizeHref((l as Record<string, unknown>)?.href, "/shop"),
            }))
            .filter((l) => l.label)
            .slice(0, 12)
        : [],
    }))
    .filter((g) => g.title)
    .slice(0, 6);

  const rawSocial = Array.isArray(base.socialLinks) ? base.socialLinks : [];
  const socialLinks: SocialLink[] = rawSocial
    .map((s) => ({
      label: str((s as Record<string, unknown>)?.label, 40),
      url: sanitizeHref((s as Record<string, unknown>)?.url),
    }))
    .filter((s) => s.label && s.url)
    .slice(0, 8);

  return {
    description: strOr(base.description, 600, DEFAULT_FOOTER.description),
    showContact: bool(base.showContact, false),
    copyright: strOr(base.copyright, 200, DEFAULT_FOOTER.copyright),
    socialLinks,
    linkGroups: linkGroups.length ? linkGroups : DEFAULT_FOOTER.linkGroups,
  };
}

// ------------------------------- fetching ----------------------------------

async function loadBlocks(): Promise<BlockRow[]> {
  return db
    .select({
      id: cmsBlocks.id,
      type: cmsBlocks.type,
      position: cmsBlocks.position,
      enabled: cmsBlocks.enabled,
      startsAt: cmsBlocks.startsAt,
      endsAt: cmsBlocks.endsAt,
      data: cmsBlocks.data,
    })
    .from(cmsBlocks)
    .orderBy(asc(cmsBlocks.type), asc(cmsBlocks.position), asc(cmsBlocks.id));
}

export type CmsData = {
  hero: HeroContent & { hasBlock: boolean };
  collections: CollectionItem[];
  collectionsFromCms: boolean;
  featured: ProductListItem[];
  newArrivals: ProductListItem[];
  brandStory: BrandStoryContent & { hasBlock: boolean };
  banners: PromoBanner[];
  announcement: AnnouncementContent & { hasBlock: boolean };
  newsletter: NewsletterContent & { hasBlock: boolean };
  footer: FooterContent & { hasBlock: boolean };
};

export async function getCmsData(): Promise<CmsData> {
  const rows = await loadBlocks();
  const byType = new Map<string, BlockRow[]>();
  for (const r of rows) {
    const list = byType.get(r.type) ?? [];
    list.push(r);
    byType.set(r.type, list);
  }
  const single = (type: string) => byType.get(type)?.[0];

  const heroRow = single("hero");
  const brandRow = single("brand_story");
  const annRow = single("announcement");
  const newsRow = single("newsletter");
  const footerRow = single("footer");
  const collectionRows = parseCollections(byType.get("collection") ?? []);

  return {
    hero: { ...parseHero(heroRow), hasBlock: Boolean(heroRow) },
    collections: collectionRows ?? DEFAULT_COLLECTIONS,
    collectionsFromCms: collectionRows != null,
    featured: parseProductList(byType.get("featured") ?? []),
    newArrivals: parseProductList(byType.get("new_arrival") ?? []),
    brandStory: { ...parseBrandStory(brandRow), hasBlock: Boolean(brandRow) },
    banners: parseBanners(byType.get("promo") ?? []),
    announcement: { ...parseAnnouncement(annRow), hasBlock: Boolean(annRow) },
    newsletter: { ...parseNewsletter(newsRow), hasBlock: Boolean(newsRow) },
    footer: { ...parseFooter(footerRow), hasBlock: Boolean(footerRow) },
  };
}

/** Active announcement for the storefront (enabled + within schedule). */
export function activeAnnouncement(
  a: AnnouncementContent & { hasBlock?: boolean },
): AnnouncementContent | null {
  if (!a.enabled || !a.text.trim()) return null;
  const now = Date.now();
  if (a.startsAt && new Date(a.startsAt).getTime() > now) return null;
  if (a.endsAt && new Date(a.endsAt).getTime() < now) return null;
  return a;
}

/** Active promo banners for the storefront (enabled + within schedule). */
export function activeBanners(banners: PromoBanner[]): PromoBanner[] {
  const now = Date.now();
  return banners.filter((b) => {
    if (!b.enabled || (!b.title.trim() && !b.text.trim())) return false;
    if (b.startsAt && new Date(b.startsAt).getTime() > now) return false;
    if (b.endsAt && new Date(b.endsAt).getTime() < now) return false;
    return true;
  });
}

/** Announcement marquee items: CMS announcement overrides the defaults. */
export function marqueeItems(announcement: AnnouncementContent): string[] {
  const active = activeAnnouncement(announcement);
  return active ? [active.text] : DEFAULT_MARQUEE;
}

// --------------------------- settings helpers ------------------------------

export async function getSeoSettings(): Promise<{
  storeName: string;
  seoTitle: string;
  seoDescription: string;
  logoUrl: string;
  faviconUrl: string;
  ogImageUrl: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
}> {
  const rows = await db.select().from(settings);
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return {
    storeName: map.storeName ?? "",
    seoTitle: map.seoTitle ?? "",
    seoDescription: map.seoDescription ?? "",
    logoUrl: map.logoUrl ?? "",
    faviconUrl: map.faviconUrl ?? "",
    ogImageUrl: map.ogImageUrl ?? "",
    contactEmail: map.contactEmail ?? "",
    contactPhone: map.contactPhone ?? "",
    address: map.address ?? "",
  };
}
