import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";
import {
  ArrowRightIcon,
  RefreshIcon,
  ShieldIcon,
  StarBadgeIcon,
  TruckIcon,
} from "@/components/icons";
import { Marquee } from "@/storefront/shared/marquee";
import type { HomeProps } from "@/storefront/types";
import { AtelierCard } from "./card";

const VALUES = [
  { icon: TruckIcon, titleKey: "home.usp1Title", copyKey: "home.usp1Copy" },
  { icon: RefreshIcon, titleKey: "home.usp2Title", copyKey: "home.usp2Copy" },
  { icon: ShieldIcon, titleKey: "home.usp3Title", copyKey: "home.usp3Copy" },
  { icon: StarBadgeIcon, titleKey: "home.usp4Title", copyKey: "home.usp4Copy" },
];

function Multiline({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {line}
        </Fragment>
      ))}
    </>
  );
}

/**
 * ATELIER homepage — the lookbook issue.
 *
 * Composition (inspired by editorial fashion storefronts, original build):
 *   1. full-bleed campaign hero with centered pill CTAs over a soft veil
 *   2. hairline ticker
 *   3. stacked full-width editorial banners with caption bars
 *   4. asymmetric collection grid with indexed captions
 *   5. featured grid under a trailing-dot heading
 *   6. editorial brand-story split
 *   7. horizontal scroll-snap new-arrivals rail
 *   8. hairline USP strip
 */
export function AtelierHome({ data, tr, fmt }: HomeProps) {
  const { hero, brandStory, banners, collections, marquee, announcementLink } = data;

  return (
    <div className="atelier-home">
      {/* HERO — full-bleed campaign photo, centered editorial CTAs */}
      {hero.enabled && (
        <section className="rd-hero rd-hero--lookbook relative flex min-h-[78svh] items-end justify-center overflow-hidden bg-ink text-bone lg:min-h-[92svh]">
          {/* campaign media — video first, then photo (dedicated mobile crop when provided) */}
          {hero.video ? (
            <video
              src={hero.video}
              autoPlay
              muted
              loop
              playsInline
              poster={hero.backgroundImage || undefined}
              className="at-hero-img absolute inset-0 h-full w-full object-cover object-center"
            />
          ) : hero.backgroundImage && hero.backgroundImageMobile ? (
            <>
              <Image
                src={hero.backgroundImageMobile}
                alt=""
                fill
                priority
                sizes="100vw"
                className="at-hero-img object-cover lg:hidden"
              />
              <Image
                src={hero.backgroundImage}
                alt=""
                fill
                sizes="100vw"
                className="at-hero-img hidden object-cover lg:block"
              />
            </>
          ) : hero.backgroundImage || hero.backgroundImageMobile ? (
            <Image
              src={(hero.backgroundImage || hero.backgroundImageMobile)!}
              alt=""
              fill
              priority
              sizes="100vw"
              className="at-hero-img object-cover"
            />
          ) : null}
          {hero.audio && <audio src={hero.audio} autoPlay loop className="hidden" />}
          <div className="rd-hero-veil-a absolute inset-0" aria-hidden />

          <div className="rd-hero-inner relative z-10 mx-auto w-full max-w-4xl px-4 pb-14 pt-32 text-center sm:px-6 lg:pb-20">
            {hero.eyebrow && (
              <p className="rd-hero-eyebrow mx-auto mb-5 inline-block rounded-full border border-bone/40 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.35em]">
                {hero.eyebrow}
              </p>
            )}
            <h1 className="font-display uppercase leading-[1.02] tracking-tight">
              <Multiline text={hero.title || "RYVEN DEPT"} />
              <span className="at-dot" aria-hidden>
                .
              </span>
            </h1>
            {hero.subtitle && (
              <p className="mx-auto mt-5 max-w-xl text-sm font-medium leading-relaxed text-bone/80 sm:text-base">
                {hero.subtitle}
              </p>
            )}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {hero.primaryText && (
                <Link
                  href={hero.primaryLink || "/shop"}
                  className="rd-cta inline-flex min-h-12 items-center gap-2 rounded-full bg-bone px-8 py-3.5 text-[13px] font-semibold uppercase tracking-[0.18em] text-ink transition-opacity hover:opacity-85"
                >
                  {hero.primaryText}
                  <ArrowRightIcon className="h-4 w-4 rtl:rotate-180" />
                </Link>
              )}
              {hero.secondaryText && (
                <Link
                  href={hero.secondaryLink || "/shop"}
                  className="inline-flex min-h-12 items-center rounded-full border border-bone/60 px-8 py-3.5 text-[13px] font-semibold uppercase tracking-[0.18em] text-bone transition-colors hover:bg-bone hover:text-ink"
                >
                  {hero.secondaryText}
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      {/* TICKER — hairline strip */}
      {marquee.length > 0 && (
        <div className="rd-ticker border-y border-black/10">
          <Marquee items={marquee} link={announcementLink} accent="·" className="py-3 text-[12px] font-medium uppercase tracking-[0.25em]" />
        </div>
      )}

      {/* EDITORIAL BANNERS — stacked full-width campaign plates */}
      {banners.length > 0 && (
        <section className="space-y-4 px-4 py-12 sm:px-6 sm:py-16 lg:space-y-6 lg:px-8">
          {banners.map((b) => (
            <Link
              key={b.id}
              href={b.ctaLink || "/shop"}
              className="group relative block overflow-hidden bg-brand-100"
            >
              {b.image ? (
                <Image
                  src={b.image}
                  alt={b.title}
                  width={1800}
                  height={760}
                  className="aspect-[4/3] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02] sm:aspect-[21/9]"
                />
              ) : (
                <div className="aspect-[4/3] w-full bg-brand-100 sm:aspect-[21/9]" />
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-4 bg-gradient-to-t from-black/60 to-transparent px-5 pb-5 pt-14 sm:px-8 sm:pb-7">
                <div className="min-w-0">
                  <p className="font-display text-lg uppercase leading-tight tracking-[0.03em] text-bone sm:text-2xl">
                    {b.title}
                    <span className="at-dot" aria-hidden>.</span>
                  </p>
                  {b.text && (
                    <p className="mt-1 truncate text-xs font-medium text-bone/75 sm:text-sm">{b.text}</p>
                  )}
                </div>
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-bone/50 text-bone transition-colors group-hover:bg-bone group-hover:text-ink">
                  <ArrowRightIcon className="h-4 w-4 rtl:rotate-180" />
                </span>
              </div>
            </Link>
          ))}
        </section>
      )}

      {/* COLLECTIONS — asymmetric editorial grid */}
      {collections.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="mb-8 flex items-end justify-between gap-4 border-b border-black/10 pb-5">
            <h2 className="font-display text-2xl uppercase tracking-tight text-ink sm:text-4xl">
              {tr("home.shopByCollection")}
              <span className="at-dot" aria-hidden>.</span>
            </h2>
            <Link
              href="/shop"
              className="hidden shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-brand-500 transition-colors hover:text-amber sm:flex"
            >
              {tr("home.viewAll")}
              <ArrowRightIcon className="h-3.5 w-3.5 rtl:rotate-180" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {collections.map((c, i) => (
              <Link
                key={c.title}
                href={c.link || "/shop"}
                className={`group relative overflow-hidden bg-brand-100 ${i === 0 ? "sm:col-span-2 lg:col-span-1 lg:row-span-2" : ""}`}
              >
                {c.image ? (
                  <Image
                    src={c.image}
                    alt={c.title}
                    width={900}
                    height={i === 0 ? 1300 : 680}
                    className={`w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03] ${i === 0 ? "aspect-[4/5] lg:h-full" : "aspect-[4/3]"}`}
                  />
                ) : (
                  <div className={`w-full bg-brand-100 ${i === 0 ? "aspect-[4/5]" : "aspect-[4/3]"}`} />
                )}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 border-t border-bone/25 bg-black/45 px-4 py-3 backdrop-blur-sm">
                  <span className="font-display text-base uppercase tracking-[0.05em] text-bone">{c.title}</span>
                  <span className="text-[11px] font-semibold tabular-nums tracking-[0.2em] text-bone/70">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* FEATURED — the cover grid */}
      {data.featured.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="mb-8 flex items-end justify-between gap-4 border-b border-black/10 pb-5">
            <h2 className="font-display text-2xl uppercase tracking-tight text-ink sm:text-4xl">
              {tr("home.featuredPieces")}
              <span className="at-dot" aria-hidden>.</span>
            </h2>
            <Link
              href="/shop"
              className="hidden shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-brand-500 transition-colors hover:text-amber sm:flex"
            >
              {tr("home.viewAll")}
              <ArrowRightIcon className="h-3.5 w-3.5 rtl:rotate-180" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-5 lg:grid-cols-4">
            {data.featured.map((p, i) => (
              <AtelierCard key={p.slug} product={p} tr={tr} fmt={fmt} index={i} priority={i < 2} />
            ))}
          </div>
        </section>
      )}

      {/* BRAND STORY — editorial split spread */}
      {brandStory.enabled && (
        <section className="rd-dark-panel bg-ink text-bone">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 md:gap-14 lg:px-8 lg:py-20">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-bone/60">
                {tr("home.ethos")}
              </p>
              <h2 className="mt-4 font-display text-3xl uppercase leading-[1.05] tracking-tight sm:text-5xl">
                {brandStory.title}
                <span className="at-dot" aria-hidden>.</span>
              </h2>
              <p className="mt-6 max-w-lg text-sm leading-relaxed text-bone/70">
                {brandStory.description}
              </p>
              {brandStory.ctaText && (
                <Link
                  href={brandStory.ctaLink || "/shop"}
                  className="mt-9 inline-flex min-h-12 items-center gap-2 rounded-full border border-bone/60 px-8 py-3.5 text-[13px] font-semibold uppercase tracking-[0.18em] text-bone transition-colors hover:bg-bone hover:text-ink"
                >
                  {brandStory.ctaText}
                  <ArrowRightIcon className="h-4 w-4 rtl:rotate-180" />
                </Link>
              )}
            </div>
            {brandStory.image && (
              <div className="overflow-hidden">
                <Image
                  src={brandStory.image}
                  alt={brandStory.title}
                  width={1000}
                  height={1250}
                  className="aspect-[4/5] w-full object-cover"
                />
              </div>
            )}
          </div>
        </section>
      )}

      {/* NEW ARRIVALS — scroll-snap rail */}
      {data.newArrivals.length > 0 && (
        <section className="py-12 sm:py-16">
          <div className="mx-auto mb-8 flex max-w-7xl items-end justify-between gap-4 border-b border-black/10 px-4 pb-5 sm:px-6 lg:px-8">
            <h2 className="font-display text-2xl uppercase tracking-tight text-ink sm:text-4xl">
              {tr("home.freshIn")}
              <span className="at-dot" aria-hidden>.</span>
            </h2>
            <Link
              href="/shop?filter=new"
              className="hidden shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-brand-500 transition-colors hover:text-amber sm:flex"
            >
              {tr("home.seeAllNew")}
              <ArrowRightIcon className="h-3.5 w-3.5 rtl:rotate-180" />
            </Link>
          </div>
          <div className="at-rail flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:px-6 lg:px-8">
            {data.newArrivals.map((p) => (
              <div key={p.slug} className="w-[46vw] shrink-0 snap-start sm:w-[30vw] lg:w-[23vw]">
                <AtelierCard product={p} tr={tr} fmt={fmt} />
              </div>
            ))}
            <Link
              href="/shop?filter=new"
              className="flex w-[46vw] shrink-0 snap-start flex-col items-center justify-center gap-3 border border-black/15 bg-brand-50 text-center sm:w-[30vw] lg:w-[23vw]"
            >
              <span className="font-display text-sm uppercase tracking-[0.15em] text-ink">
                {tr("home.seeAllNew")}
              </span>
              <ArrowRightIcon className="h-5 w-5 text-amber rtl:rotate-180" />
            </Link>
          </div>
        </section>
      )}

      {/* VALUES — hairline strip */}
      <section className="border-y border-black/10 bg-brand-50">
        <div className="mx-auto grid max-w-7xl grid-cols-1 divide-y divide-black/10 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
          {VALUES.map(({ icon: Icon, titleKey, copyKey }) => (
            <div key={titleKey} className="flex items-start gap-4 px-4 py-7 sm:px-6 lg:px-7">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-amber" />
              <div>
                <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink">
                  {tr(titleKey, { amount: data.freeShipAmount })}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-brand-400">
                  {tr(copyKey, { amount: data.freeShipAmount })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
