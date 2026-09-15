import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ArrowRightIcon } from "@/components/icons";
import { Marquee } from "@/storefront/shared/marquee";
import { CardMedia } from "@/storefront/shared/card-media";
import { CardBadges } from "@/storefront/shared/badges";
import { FONT_CATALOG } from "@/themes/customize";
import { getTheme } from "@/themes/registry";
import type { ThemeId } from "@/themes/types";
import type { CardProduct, Fmt, Tr } from "@/storefront/types";
import type { Section } from "@/lib/builder/types";

/**
 * Builder section renderer — server components only (zero client JS).
 *
 * Sections are theme-agnostic: they paint with the ACTIVE theme's tokens
 * (--rd-*) and structural hooks (rd-hero--<variant>), so every storefront
 * keeps its identity while the owner controls structure, content, media,
 * layout, typography and colors. Priority: section override → theme
 * customization → theme default (colors/typography fall through CSS vars).
 */

export type BuilderData = {
  themeId: ThemeId;
  tr: Tr;
  fmt: Fmt;
  marquee: string[];
  announcementLink: string;
  hero: { enabled: boolean; eyebrow: string; title: string; subtitle: string; primaryText: string; primaryLink: string; secondaryText: string; secondaryLink: string; backgroundImage: string; backgroundImageMobile: string };
  brandStory: { enabled: boolean; title: string; description: string; ctaText: string; ctaLink: string; image: string };
  banners: Array<{ id: number; title: string; text: string; image: string; ctaLink: string }>;
  collections: Array<{ title: string; link: string; image: string }>;
  categories: Array<{ name: string; image: string }>;
  newsletterTitle: string;
  socials: Array<{ label: string; url: string }>;
  products: Map<string, CardProduct[]>;
  spotlight: CardProduct | null;
};

/* ----------------------------- safe class maps ---------------------------- */

const PAD_Y = { none: "py-0", sm: "py-6 sm:py-8", md: "py-12 sm:py-16", lg: "py-16 sm:py-24", xl: "py-24 sm:py-32" } as const;
/** mobile-first padding when a mobile override is set (desktop keeps its own). */
const PAD_MOBILE = {
  none: "py-0 md:py-0", sm: "py-6 md:py-6", md: "py-12 md:py-12", lg: "py-16 md:py-16", xl: "py-24 md:py-24",
} as const;
const PAD_DESKTOP = { none: "md:py-0", sm: "md:py-8", md: "md:py-16", lg: "md:py-24", xl: "md:py-32" } as const;
const CONTAINER = { narrow: "max-w-3xl", default: "max-w-7xl", wide: "max-w-[88rem]", full: "max-w-none" } as const;
const GAP = { sm: "gap-3", md: "gap-5", lg: "gap-8" } as const;
const SIZE = { xs: "text-xs", sm: "text-sm", md: "text-base", lg: "text-lg sm:text-xl", xl: "text-2xl sm:text-3xl", "2xl": "text-3xl sm:text-4xl", "3xl": "text-4xl sm:text-5xl", "4xl": "text-5xl sm:text-7xl" } as const;
const WEIGHT = { normal: "font-normal", medium: "font-medium", semibold: "font-semibold", bold: "font-bold" } as const;
const TRACKING = { tight: "tracking-tight", normal: "tracking-normal", wide: "tracking-wide", widest: "tracking-[0.2em]" } as const;
const LHEIGHT = { tight: "leading-tight", normal: "leading-normal", relaxed: "leading-relaxed" } as const;
const ALIGN = { start: "text-start items-start", center: "text-center items-center", end: "text-end items-end" } as const;
const TRANSFORM = { none: "", uppercase: "uppercase", capitalize: "capitalize" } as const;
const HEAD_W = { narrow: "max-w-md", default: "max-w-2xl", wide: "max-w-4xl" } as const;
const RADIUS = { none: "rounded-none", sm: "rounded-md", md: "rounded-xl", lg: "rounded-3xl" } as const;
const ASPECT = { auto: "", "1:1": "aspect-square", "4:3": "aspect-[4/3]", "3:4": "aspect-[3/4]", "16:9": "aspect-[16/9]", "21:9": "aspect-[21/9]", "4:5": "aspect-[4/5]" } as const;
const HEIGHT = { "": "", sm: "min-h-[38svh]", md: "min-h-[56svh]", lg: "min-h-[74svh]", xl: "min-h-[92svh]" } as const;
const OBJ = { top: "object-top", center: "object-center", bottom: "object-bottom" } as const;

const FONT_BY_ID = new Map(FONT_CATALOG.map((f) => [f.id, f.stack]));

function shellStyle(s: Section): CSSProperties {
  const st: CSSProperties & Record<string, string | number> = {};
  const c = s.colors;
  if (c.bg) st.backgroundColor = c.bg;
  if (c.text) st.color = c.text;
  if (c.border) st["--sb-border"] = c.border;
  if (c.accent) st["--sb-accent"] = c.accent;
  if (c.buttonBg) st["--sb-btn-bg"] = c.buttonBg;
  if (c.buttonText) st["--sb-btn-text"] = c.buttonText;
  if (c.heading) st["--sb-heading"] = c.heading;
  if (c.overlay) st["--sb-overlay"] = c.overlay;
  st["--sb-overlay-o"] = String(c.overlayOpacity / 100);
  st["--sb-order"] = String(s.mobile.order || 0);
  const t = s.typography;
  if (t.font && FONT_BY_ID.has(t.font)) st["--sb-font"] = FONT_BY_ID.get(t.font)!;
  return st;
}

function headStyle(s: Section): CSSProperties & Record<string, string> {
  const st: CSSProperties & Record<string, string> = {};
  if (s.colors.heading) st.color = s.colors.heading;
  if (s.colors.accent) st["--sb-accent"] = s.colors.accent;
  return st;
}

function Cta({ s, text, link, secondary = false }: { s: Section; text: string; link: string; secondary?: boolean }) {
  if (!text) return null;
  const base =
    "rd-cta inline-flex min-h-12 items-center gap-2 rounded-full px-7 py-3.5 text-[13px] font-semibold uppercase tracking-[0.16em] transition-opacity hover:opacity-85";
  const style: CSSProperties & Record<string, string> = {};
  if (!secondary) {
    style.backgroundColor = s.colors.buttonBg || "var(--rd-ink)";
    style.color = s.colors.buttonText || "var(--rd-bone)";
  }
  return (
    <Link href={link || "/shop"} className={`${base} ${secondary ? "border border-current bg-transparent" : ""}`} style={style}>
      {text}
      <ArrowRightIcon className="h-4 w-4 rtl:rotate-180" />
    </Link>
  );
}

function SectionHead({ s, title, linkLabel, link }: { s: Section; title: string; linkLabel?: string; link?: string }) {
  const t = s.typography;
  return (
    <div className={`mb-8 flex items-end justify-between gap-4 border-b pb-5 ${s.colors.border ? "" : "border-black/10"}`} style={s.colors.border ? { borderColor: s.colors.border } : undefined}>
      <h2 className={`${SIZE[t.size === "md" ? "2xl" : t.size]} ${WEIGHT[t.weight]} ${TRACKING[t.tracking]} ${TRANSFORM[t.transform]} font-display ${HEAD_W[t.headingWidth]}`} style={headStyle(s)}>
        {title}
      </h2>
      {linkLabel && link && (
        <Link href={link} className="hidden shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] opacity-70 transition-opacity hover:opacity-100 sm:flex" style={s.colors.accent ? { color: s.colors.accent } : undefined}>
          {linkLabel}
          <ArrowRightIcon className="h-3.5 w-3.5 rtl:rotate-180" />
        </Link>
      )}
    </div>
  );
}

/* ------------------------------- builder card ----------------------------- */

export function BuilderCard({ s, p, tr, fmt, index = 0 }: { s: Section; p: CardProduct; tr: Tr; fmt: Fmt; index?: number }) {
  const l = s.layout;
  const ratio = ASPECT["4:5"];
  return (
    <Link href={`/products/${p.slug}`} className="sb-bcard group block" style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}>
      <div className={`relative overflow-hidden border border-black/10 bg-white/40 ${ratio}`} style={s.colors.border ? { borderColor: s.colors.border } : undefined}>
        <CardMedia
          images={s.props.hoverSwap ? p.images : p.images.slice(0, 1)}
          name={p.name}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          imgClassName="transition-transform duration-700 group-hover:scale-[1.04]"
        />
        {s.props.showBadges && <CardBadges product={p} tr={tr} />}
      </div>
      <div className="mt-3 border-b border-black/10 pb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-60">{p.category}</p>
        <h3 className="rd-card-title mt-1 font-display text-[15px] uppercase leading-snug tracking-[0.03em]">{p.name}</h3>
        {s.props.showPrice && (
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-semibold tabular-nums">{fmt(p.price)}</span>
            {p.compareAtPrice != null && p.compareAtPrice > p.price && <s className="opacity-50 tabular-nums">{fmt(p.compareAtPrice)}</s>}
          </div>
        )}
        {s.props.showVariants && p.colors.length > 0 && (
          <p className="mt-1 truncate text-[11px] opacity-50">{p.colors.slice(0, 3).join(" · ")}</p>
        )}
        {s.props.showCta && (
          <span className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]" style={s.colors.accent ? { color: s.colors.accent } : undefined}>
            {tr("home.viewAll")}
            <ArrowRightIcon className="h-3 w-3 rtl:rotate-180" />
          </span>
        )}
      </div>
    </Link>
  );
}

function ProductGrid({ s, d, cols }: { s: Section; d: BuilderData; cols: string }) {
  const items = d.products.get(s.props.source) ?? [];
  if (items.length === 0) return null;
  return (
    <div className={`${cols} ${GAP[s.layout.gap] === "gap-5" ? "gap-x-4 gap-y-9" : s.layout.gap === "sm" ? "gap-x-3 gap-y-6" : "gap-x-6 gap-y-12"} grid`}>
      {items.map((p, i) => (
        <BuilderCard key={p.slug} s={s} p={p} tr={d.tr} fmt={d.fmt} index={i} />
      ))}
    </div>
  );
}

/* ------------------------------ section bodies ---------------------------- */

function HeroSection({ s, d }: { s: Section; d: BuilderData }) {
  const theme = getTheme(d.themeId);
  const p = s.props;
  const useCms = p.useCms;
  const hero = useCms ? { ...d.hero, eyebrow: p.eyebrow || d.hero.eyebrow, title: p.title || d.hero.title, subtitle: p.subtitle || d.hero.subtitle, primaryText: p.ctaText || d.hero.primaryText, primaryLink: p.ctaLink || d.hero.primaryLink, secondaryText: p.cta2Text || d.hero.secondaryText, secondaryLink: p.cta2Link || d.hero.secondaryLink } : { enabled: true, eyebrow: p.eyebrow, title: p.title || "RYVEN DEPT", subtitle: p.subtitle, primaryText: p.ctaText, primaryLink: p.ctaLink, secondaryText: p.cta2Text, secondaryLink: p.cta2Link, backgroundImage: p.image, backgroundImageMobile: p.mobileImage };
  const image = hero.backgroundImage || hero.backgroundImageMobile;
  if (!hero.enabled && !image) return null;
  const h = HEIGHT[p.height || "lg"] || "min-h-[74svh]";
  return (
    <section className={`rd-hero rd-hero--${theme.hero} relative flex ${h} items-end justify-center overflow-hidden bg-ink text-bone`}>
      {image ? (
        <>
          {hero.backgroundImageMobile && hero.backgroundImage ? (
            <>
              <Image src={hero.backgroundImageMobile} alt={p.alt || hero.title} fill priority sizes="100vw" className={`${OBJ[p.objectPosition]} lg:hidden`} />
              <Image src={hero.backgroundImage} alt={p.alt || hero.title} fill sizes="100vw" className={`${OBJ[p.objectPosition]} hidden lg:block`} />
            </>
          ) : (
            <Image src={image} alt={p.alt || hero.title} fill priority sizes="100vw" className={OBJ[p.objectPosition]} />
          )}
        </>
      ) : null}
      <div className="sb-veil absolute inset-0" aria-hidden />
      <div className="relative z-10 mx-auto w-full max-w-4xl px-4 pb-14 pt-32 text-center sm:px-6 lg:pb-20">
        {hero.eyebrow && <p className="rd-hero-eyebrow mx-auto mb-5 inline-block rounded-full border border-bone/40 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.3em]">{hero.eyebrow}</p>}
        <h1 className={`font-display uppercase leading-[1.04] tracking-tight ${SIZE[s.typography.size === "md" ? "4xl" : s.typography.size]}`} style={headStyle(s)}>
          {hero.title}
        </h1>
        {hero.subtitle && <p className="mx-auto mt-5 max-w-xl text-sm font-medium leading-relaxed opacity-85 sm:text-base">{hero.subtitle}</p>}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Cta s={s} text={hero.primaryText} link={hero.primaryLink} />
          {hero.secondaryText && (
            <Link href={hero.secondaryLink || "/shop"} className="inline-flex min-h-12 items-center rounded-full border border-bone/60 px-7 py-3.5 text-[13px] font-semibold uppercase tracking-[0.16em] text-bone transition-colors hover:bg-bone hover:text-ink">
              {hero.secondaryText}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

function MediaImage({ s, alt, priority = false }: { s: Section; alt: string; priority?: boolean }) {
  const p = s.props;
  const aspect = ASPECT[p.aspect];
  const mobileSrc = s.mobile.image || p.mobileImage;
  return (
    <>
      {mobileSrc ? (
        <>
          <Image src={mobileSrc} alt={alt} fill priority={priority} sizes="100vw" className={`${OBJ[p.objectPosition]} lg:hidden`} />
          <Image src={p.image} alt={alt} fill sizes="100vw" className={`${OBJ[p.objectPosition]} hidden lg:block`} />
        </>
      ) : (
        <Image src={p.image} alt={alt} fill priority={priority} sizes="100vw" className={OBJ[p.objectPosition]} />
      )}
      {s.colors.overlay && <div className="sb-img-overlay absolute inset-0" aria-hidden />}
      <span className={`pointer-events-none absolute inset-0 ${aspect ? "" : ""}`} />
    </>
  );
}

export function renderSection(s: Section, d: BuilderData): ReactNode {
  if (!s.enabled) return null;
  const l = s.layout;
  const t = s.typography;
  const mt = s.mobile;
  const cols = `grid-cols-${mt.cols || l.colsMobile} md:grid-cols-${l.cols}`;
  const inner = ((): ReactNode => {
    switch (s.type) {
      case "hero":
        return <HeroSection s={s} d={d} />;
      case "announcement":
        if (!d.marquee[0]) return null;
        return (
          <div className="bg-ink py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.25em] text-bone" style={s.colors.bg ? { backgroundColor: s.colors.bg, color: s.colors.text || undefined } : undefined}>
            {d.marquee[0] ?? ""}
          </div>
        );
      case "marquee":
        return (
          <div className="rd-ticker border-y border-black/10">
            <Marquee items={d.marquee} link={d.announcementLink} accent="·" className="py-3 text-[12px] font-medium uppercase tracking-[0.25em]" />
          </div>
        );
      case "promo_banner": {
        if (d.banners.length === 0) return null;
        return (
          <div className={`grid ${GAP[l.gap]} ${d.banners.length > 1 ? "md:grid-cols-2" : ""} ${cols.split(" ")[0]}`}>
            {d.banners.map((b) => (
              <Link key={b.id} href={b.ctaLink || "/shop"} className={`group relative block overflow-hidden bg-black/5 ${ASPECT["16:9"] || ""} ${RADIUS[s.props.radius]}`}>
                {b.image ? (
                  <Image src={b.image} alt={b.title} fill sizes="(max-width:768px) 100vw, 50vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.02]" />
                ) : (
                  <div className="aspect-[16/9] w-full" />
                )}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-4 bg-gradient-to-t from-black/60 to-transparent px-5 pb-5 pt-14">
                  <div className="min-w-0">
                    <p className="font-display text-lg uppercase leading-tight text-bone sm:text-2xl">{b.title}</p>
                    {b.text && <p className="mt-1 truncate text-xs font-medium text-bone/75">{b.text}</p>}
                  </div>
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-bone/50 text-bone transition-colors group-hover:bg-bone group-hover:text-ink">
                    <ArrowRightIcon className="h-4 w-4 rtl:rotate-180" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        );
      }
      case "collection_cards": {
        if (d.collections.length === 0) return null;
        return (
          <div className={`${cols} ${GAP[l.gap]} grid`}>
            {d.collections.map((c, i) => (
              <Link key={c.title} href={c.link || "/shop"} className={`group relative overflow-hidden bg-black/5 ${i === 0 ? "col-span-2 md:col-span-1" : ""}`}>
                {c.image ? (
                  <Image src={c.image} alt={c.title} fill sizes="(max-width:768px) 100vw, 33vw" className="aspect-[4/3] object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                ) : (
                  <div className="aspect-[4/3] w-full" />
                )}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between border-t border-bone/25 bg-black/45 px-4 py-3 backdrop-blur-sm">
                  <span className="font-display text-base uppercase tracking-[0.05em] text-bone">{c.title}</span>
                  <span className="text-[11px] font-semibold tabular-nums tracking-[0.2em] text-bone/70">{String(i + 1).padStart(2, "0")}</span>
                </div>
              </Link>
            ))}
          </div>
        );
      }
      case "categories": {
        const cats = d.categories.slice(0, s.props.limit);
        if (cats.length === 0) return null;
        return (
          <div className={`${cols} ${GAP[l.gap]} grid`}>
            {cats.map((c) => (
              <Link key={c.name} href={`/shop?category=${encodeURIComponent(c.name)}`} className="group relative overflow-hidden border border-black/10 bg-black/5">
                {c.image ? (
                  <Image src={c.image} alt={c.name} fill sizes="(max-width:768px) 100vw, 33vw" className="aspect-[4/3] object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                ) : (
                  <div className="aspect-[4/3] w-full" />
                )}
                <div className="absolute inset-x-0 bottom-0 border-t border-bone/25 bg-black/45 px-4 py-3 backdrop-blur-sm">
                  <span className="font-display text-base uppercase tracking-[0.05em] text-bone">{c.name}</span>
                </div>
              </Link>
            ))}
          </div>
        );
      }
      case "featured_products":
      case "product_grid":
      case "new_arrivals":
      case "best_sellers":
        return (
          <>
            {s.props.title && <SectionHead s={s} title={s.props.title} linkLabel={d.tr("home.viewAll")} link="/shop" />}
            <ProductGrid s={s} d={d} cols={cols} />
          </>
        );
      case "product_carousel":
        return (
          <>
            {s.props.title && <SectionHead s={s} title={s.props.title} linkLabel={d.tr("home.viewAll")} link="/shop" />}
            <div className="sb-rail flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
              {(d.products.get(s.props.source) ?? []).map((p) => (
                <div key={p.slug} className="w-[46vw] shrink-0 snap-start sm:w-[30vw] lg:w-[23vw]">
                  <BuilderCard s={s} p={p} tr={d.tr} fmt={d.fmt} />
                </div>
              ))}
            </div>
          </>
        );
      case "product_spotlight": {
        const p = d.spotlight;
        if (!p) return null;
        return (
          <div className={`grid items-center ${GAP[l.gap]} md:grid-cols-2`}>
            <div className={`relative overflow-hidden ${RADIUS[s.props.radius]} ${ASPECT[s.props.aspect] || "aspect-[4/5]"} bg-black/5`}>
              <CardMedia images={p.images} name={p.name} sizes="(max-width:768px) 100vw, 50vw" />
            </div>
            <div className={`flex flex-col ${ALIGN[l.align].split(" ")[1]}`}>
              {s.props.eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.3em] opacity-60">{s.props.eyebrow}</p>}
              <h3 className={`mt-3 font-display uppercase ${SIZE[t.size === "md" ? "3xl" : t.size]} ${WEIGHT[t.weight]}`} style={headStyle(s)}>{s.props.title || p.name}</h3>
              <p className="mt-4 max-w-md text-sm leading-relaxed opacity-70">{s.props.body || p.tagline}</p>
              <p className="mt-4 font-display text-2xl tabular-nums">{d.fmt(p.price)}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Cta s={s} text={s.props.ctaText || d.tr("product.viewProduct")} link={s.props.ctaLink || `/products/${p.slug}`} />
              </div>
            </div>
          </div>
        );
      }
      case "editorial_image":
        return (
          <Link href={s.props.link || "/shop"} className={`group relative block overflow-hidden ${RADIUS[s.props.radius]} ${ASPECT[s.props.aspect] || "aspect-[16/9]"} bg-black/5 ${HEIGHT[s.props.height]}`}>
            {s.props.image && <MediaImage s={s} alt={s.props.alt || s.props.title || "Campaign"} />}
          </Link>
        );
      case "full_width_image":
        return (
          <div className={`relative overflow-hidden ${HEIGHT[s.props.height] || "min-h-[56svh]"} bg-black/5`}>
            {s.props.image && <MediaImage s={s} alt={s.props.alt || "Campaign"} />}
          </div>
        );
      case "editorial_split": {
        const bs = s.props.useCms ? d.brandStory : null;
        const image = s.props.image || bs?.image || "";
        return (
          <div className={`grid items-center ${GAP[l.gap === "sm" ? "md" : l.gap]} md:grid-cols-2`}>
            <div className={`flex flex-col ${ALIGN[l.align].split(" ")[1]}`}>
              {(s.props.eyebrow || (bs && d.tr("home.ethos"))) && <p className="text-[11px] font-semibold uppercase tracking-[0.3em] opacity-60">{s.props.eyebrow || d.tr("home.ethos")}</p>}
              <h3 className={`mt-4 font-display uppercase leading-[1.05] tracking-tight ${SIZE[t.size === "md" ? "3xl" : t.size]} ${WEIGHT[t.weight]}`} style={headStyle(s)}>
                {s.props.title || bs?.title || ""}
              </h3>
              <p className="mt-5 max-w-lg text-sm leading-relaxed opacity-70">{s.props.body || bs?.description || ""}</p>
              <div className="mt-8">
                <Cta s={s} text={s.props.ctaText || bs?.ctaText || ""} link={s.props.ctaLink || bs?.ctaLink || "/shop"} />
              </div>
            </div>
            {image && (
              <div className={`relative overflow-hidden ${RADIUS[s.props.radius]} aspect-[4/5] bg-black/5`}>
                <Image src={image} alt={s.props.alt || s.props.title || "Editorial"} fill sizes="(max-width:768px) 100vw, 50vw" className={OBJ[s.props.objectPosition]} />
              </div>
            )}
          </div>
        );
      }
      case "image_text":
        return (
          <div className={`grid items-center ${GAP[l.gap]} md:grid-cols-2`}>
            <div className={`relative overflow-hidden ${RADIUS[s.props.radius]} ${ASPECT[s.props.aspect] || "aspect-[4/3]"} bg-black/5`}>
              {s.props.image && <MediaImage s={s} alt={s.props.alt || s.props.title || "Image"} />}
            </div>
            <div className={`flex flex-col ${ALIGN[l.align].split(" ")[1]}`}>
              <h3 className={`font-display uppercase ${SIZE[t.size === "md" ? "2xl" : t.size]} ${WEIGHT[t.weight]} ${TRANSFORM[t.transform]}`} style={headStyle(s)}>{s.props.title}</h3>
              <p className="mt-4 max-w-md text-sm leading-relaxed opacity-70">{s.props.body}</p>
              <div className="mt-6"><Cta s={s} text={s.props.ctaText} link={s.props.ctaLink} /></div>
            </div>
          </div>
        );
      case "text_block":
        return (
          <div className={`flex flex-col ${ALIGN[l.align].split(" ")[1]}`}>
            {s.props.title && <h3 className={`font-display uppercase ${SIZE[t.size === "md" ? "2xl" : t.size]} ${WEIGHT[t.weight]} ${TRACKING[t.tracking]} ${TRANSFORM[t.transform]} ${LHEIGHT[t.lineHeight]} ${HEAD_W[t.headingWidth]}`} style={headStyle(s)}>{s.props.title}</h3>}
            {s.props.body && <p className={`mt-4 max-w-2xl text-sm leading-relaxed opacity-75 ${SIZE[mt.size || "sm"]}`}>{s.props.body}</p>}
          </div>
        );
      case "lookbook":
        return (
          <div className={`grid ${GAP[l.gap]} md:grid-cols-[1.2fr_1fr]`}>
            <div className={`relative overflow-hidden ${RADIUS[s.props.radius]} aspect-[3/4] bg-black/5`}>
              {s.props.image && <Image src={s.props.image} alt={s.props.alt || s.props.title || "Lookbook"} fill sizes="(max-width:768px) 100vw, 60vw" className={OBJ[s.props.objectPosition]} />}
            </div>
            <div className="flex flex-col gap-4">
              <div className={`relative overflow-hidden ${RADIUS[s.props.radius]} aspect-[4/3] bg-black/5`}>
                {s.props.image2 && <Image src={s.props.image2} alt={s.props.alt || "Lookbook detail"} fill sizes="(max-width:768px) 100vw, 40vw" className={OBJ[s.props.objectPosition]} />}
              </div>
              <div className={`flex flex-1 flex-col justify-center ${ALIGN[l.align].split(" ")[1]}`}>
                <h3 className={`font-display uppercase ${SIZE[t.size === "md" ? "2xl" : t.size]}`} style={headStyle(s)}>{s.props.title}</h3>
                <div className="mt-5"><Cta s={s} text={s.props.ctaText} link={s.props.ctaLink} /></div>
              </div>
            </div>
          </div>
        );
      case "brand_story":
        return renderSection({ ...s, type: "editorial_split", props: { ...s.props, useCms: s.props.useCms } }, d);
      case "newsletter":
        return (
          <div className={`flex flex-col ${ALIGN[l.align] === "text-center items-center" ? "items-center text-center" : ALIGN[l.align].split(" ")[1]} mx-auto max-w-xl`}>
            <h3 className={`font-display uppercase ${SIZE[t.size === "md" ? "2xl" : t.size]}`} style={headStyle(s)}>{s.props.title || d.newsletterTitle}</h3>
            {s.props.body && <p className="mt-3 text-sm opacity-70">{s.props.body}</p>}
          </div>
        );
      case "social":
        return (
          <div className="flex flex-wrap items-center justify-center gap-6">
            {d.socials.map((so) => (
              <a key={so.label} href={so.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold uppercase tracking-[0.25em] opacity-70 transition-opacity hover:opacity-100">
                {so.label}
              </a>
            ))}
          </div>
        );
      case "custom_cta":
        return (
          <div className={`flex flex-col ${ALIGN[l.align].split(" ")[1]} border border-black/10 px-6 py-12 sm:px-12`} style={s.colors.border ? { borderColor: s.colors.border } : undefined}>
            <h3 className={`font-display uppercase ${SIZE[t.size === "md" ? "3xl" : t.size]} ${HEAD_W[t.headingWidth]}`} style={headStyle(s)}>{s.props.title}</h3>
            {s.props.subtitle && <p className="mt-3 max-w-md text-sm opacity-70">{s.props.subtitle}</p>}
            <div className="mt-7 flex flex-wrap gap-3">
              <Cta s={s} text={s.props.ctaText} link={s.props.ctaLink} />
              <Cta s={s} text={s.props.cta2Text} link={s.props.cta2Link} secondary />
            </div>
          </div>
        );
      case "spacer": {
        const h = { sm: "h-8", md: "h-16", lg: "h-28", xl: "h-44", "": "h-16" } as const;
        return <div className={h[s.props.height || "md"]} aria-hidden />;
      }
      case "divider":
        return <div className={s.props.divider === "bold" ? "border-t-2 border-current opacity-80" : "border-t border-black/10"} style={s.colors.border ? { borderColor: s.colors.border } : undefined} aria-hidden />;
    }
    return null;
  })();

  const padClass = mt.padY ? `${PAD_MOBILE[mt.padY]} ${PAD_DESKTOP[l.padY]}` : PAD_Y[l.padY];
  const MH = { sm: "min-h-[240px] md:min-h-0", md: "min-h-[360px] md:min-h-0", lg: "min-h-[520px] md:min-h-0", "": "" } as const;
  const fullBleed = ["hero", "marquee", "announcement", "full_width_image", "editorial_image"].includes(s.type);
  const body = inner == null ? null : fullBleed ? inner : (
    <div className={`mx-auto w-full ${CONTAINER[l.container]}`}>{inner}</div>
  );

  return (
    <div
      key={s.id}
      data-sb-section={s.id}
      data-sb-malign={mt.align || undefined}
      className={`sb-sec relative ${padClass} ${fullBleed ? "" : "px-4 sm:px-6 lg:px-8"} ${mt.hidden ? "hidden md:block" : ""} ${MH[mt.height] || ""}`}
      style={shellStyle(s)}
    >
      {body}
    </div>
  );
}

export function renderHome(
  s: { home: Section[]; header?: { showAnnouncement?: boolean } },
  d: BuilderData,
): ReactNode {
  const sections =
    s.header && s.header.showAnnouncement === false
      ? s.home.filter((sec) => sec.type !== "announcement" && sec.type !== "marquee")
      : s.home;
  return (
    <div className="sb-home flex flex-col">
      {sections.map((sec) => renderSection(sec, d))}
    </div>
  );
}
