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
import { ArchiveCard } from "./card";

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
 * ARCHIVE homepage — a catalogued collection: cream cover hero with framed
 * plate, ledger ticker, collections as numbered catalog rows, framed card
 * grid, an essay-style brand story, recent acquisitions.
 */
export function ArchiveHome({ data, tr, fmt }: HomeProps) {
  const { hero, brandStory, banners, collections, marquee, announcementLink } = data;

  return (
    <div className="archive-home">
      {/* HERO — catalog cover */}
      {hero.enabled && (
        <section className="rd-hero rd-hero--catalog relative overflow-hidden border-b border-black/15 bg-bone">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-28 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:px-8 lg:pb-20 lg:pt-32">
            <div>
              <p className="animate-fade-up font-display text-xs italic tracking-[0.25em] text-amber">
                {hero.eyebrow} — {tr("home.curatedLines")}
              </p>
              <h1 className="animate-fade-up delay-100 mt-5 font-display text-5xl font-medium leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
                <Multiline text={hero.title} />
              </h1>
              <p className="animate-fade-up delay-200 mt-6 max-w-md border-s border-black/25 ps-4 text-base leading-relaxed text-black/60">
                {hero.subtitle}
              </p>
              <div className="animate-fade-up delay-300 mt-9 flex flex-wrap items-center gap-4">
                {hero.primaryText && (
                  <Link
                    href={hero.primaryLink || "/shop"}
                    className="rd-cta group flex items-center gap-2 rounded-full bg-ink px-8 py-4 text-sm font-semibold uppercase tracking-widest text-bone transition-transform hover:scale-105"
                  >
                    {hero.primaryText}
                    <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1 rtl:-scale-x-100" />
                  </Link>
                )}
                {hero.secondaryText && (
                  <Link
                    href={hero.secondaryLink || "/shop"}
                    className="rd-cta rounded-full border border-black/30 px-8 py-4 text-sm font-semibold uppercase tracking-widest text-ink transition-colors hover:bg-black/5"
                  >
                    {hero.secondaryText}
                  </Link>
                )}
              </div>
            </div>

            {/* framed cover plate */}
            {(hero.backgroundImage || hero.backgroundImageMobile) && (
              <div className="animate-fade-up delay-200 border border-black/25 bg-brand-50 p-3">
                <div className="relative aspect-[4/5] overflow-hidden">
                  <Image
                    src={(hero.backgroundImage || hero.backgroundImageMobile)!}
                    alt={tr("home.heroAlt")}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 44vw"
                    className="archive-img object-cover"
                  />
                  <span className="absolute bottom-3 start-3 border border-black/30 bg-bone px-2.5 py-1 font-display text-xs italic tracking-wide text-brand-500">
                    Plate I.
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ledger ticker */}
      <section className="border-b border-black/15 bg-brand-50 py-3">
        <Marquee items={marquee} link={announcementLink} accent="❦" />
      </section>

      {/* CAMPAIGN BANNERS (CMS) */}
      {banners.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-14 sm:px-6 lg:px-8">
          <div className="space-y-4">
            {banners.map((b) => (
              <div key={b.id ?? b.title} className="relative overflow-hidden border border-black/25 bg-brand-50">
                {b.image && <Image src={b.image} alt="" fill sizes="100vw" className="archive-img object-cover opacity-30" />}
                <div className="relative flex flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-10">
                  <div className="min-w-0">
                    {b.title && <h3 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">{b.title}</h3>}
                    {b.text && <p className="mt-2 max-w-xl text-sm text-black/60">{b.text}</p>}
                  </div>
                  {b.ctaText && (
                    <Link
                      href={b.ctaLink || "/shop"}
                      className="rd-cta shrink-0 rounded-full bg-ink px-6 py-3 text-center text-xs font-semibold uppercase tracking-widest text-bone transition-transform hover:scale-105"
                    >
                      {b.ctaText}
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* COLLECTIONS — numbered catalog rows */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:py-20 sm:px-6 lg:px-8">
        <div className="border-b-2 border-ink pb-4">
          <p className="font-display text-xs italic tracking-[0.25em] text-amber">{tr("home.curatedLines")}</p>
          <h2 className="mt-2 font-display text-4xl font-medium tracking-tight sm:text-5xl">{tr("home.shopByCollection")}</h2>
        </div>

        <div className="mt-2">
          {collections.map((c, i) => (
            <Link
              key={`${c.title}-${i}`}
              href={c.link || "/shop"}
              className="group grid grid-cols-[3rem_1fr_auto] items-center gap-4 border-b border-black/15 py-6 transition-colors hover:bg-brand-50 sm:grid-cols-[4rem_5rem_1fr_auto] sm:gap-6"
            >
              <span className="font-display text-2xl italic text-black/30">{String(i + 1).padStart(2, "0")}</span>
              {c.image && (
                <span className="relative hidden h-20 w-16 overflow-hidden border border-black/20 sm:block">
                  <Image src={c.image} alt="" fill sizes="64px" className="archive-img object-cover" />
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate font-display text-2xl font-medium tracking-tight sm:text-3xl">{c.title}</span>
                {c.tag && <span className="mt-0.5 block text-[11px] uppercase tracking-[0.25em] text-black/40">{c.tag}</span>}
                <span className="mt-1 hidden max-w-xl text-sm text-black/50 md:block">{c.description}</span>
              </span>
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em]">
                {tr("home.explore")}
                <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1 rtl:-scale-x-100" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* FEATURED — the catalogued grid */}
      <section className="border-y border-black/15 bg-brand-50 py-12 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4 border-b-2 border-ink pb-4">
            <div>
              <p className="font-display text-xs italic tracking-[0.25em] text-amber">{tr("home.theEssentials")}</p>
              <h2 className="mt-2 font-display text-4xl font-medium tracking-tight sm:text-5xl">{tr("home.featuredPieces")}</h2>
            </div>
            <Link href="/shop" className="hidden shrink-0 items-center gap-1.5 text-sm font-semibold uppercase tracking-wide hover:opacity-60 sm:flex">
              {tr("nav.shopAll")} <ArrowRightIcon className="h-4 w-4 rtl:-scale-x-100" />
            </Link>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
            {data.featured.map((p, i) => (
              <ArchiveCard key={p.slug} product={p} tr={tr} fmt={fmt} index={i} priority={i < 4} />
            ))}
          </div>
        </div>
      </section>

      {/* BRAND STORY — archive essay */}
      {brandStory.enabled && (
        <section className="mx-auto max-w-7xl px-4 py-12 sm:py-20 sm:px-6 lg:px-8">
          <div className="grid items-start gap-12 lg:grid-cols-2">
            <div className="relative aspect-[4/5] overflow-hidden border border-black/25 bg-brand-50 p-3 lg:aspect-auto lg:h-[560px]">
              {brandStory.image ? (
                <Image
                  src={brandStory.image}
                  alt={tr("home.studioAlt")}
                  fill
                  sizes="(max-width: 1024px) 100vw, 45vw"
                  className="archive-img object-cover"
                />
              ) : null}
            </div>
            <div className="lg:pt-8">
              <p className="font-display text-xs italic tracking-[0.25em] text-amber">{tr("home.ethos")}</p>
              <h2 className="mt-3 font-display text-4xl font-medium leading-tight tracking-tight sm:text-5xl">
                <Multiline text={brandStory.title} />
              </h2>
              <p className="mt-6 max-w-lg leading-relaxed text-black/60">{brandStory.description}</p>
              <div className="mt-10 grid grid-cols-3 divide-x divide-black/15 border-y border-black/15 py-6">
                {[
                  { n: "480", l: tr("home.statGsm") },
                  { n: "2.4k+", l: tr("home.statReviews") },
                  { n: tr("home.stat30day"), l: tr("home.statReturns") },
                ].map((stat) => (
                  <div key={stat.l} className="px-4 first:ps-0">
                    <p className="font-display text-3xl sm:text-4xl">{stat.n}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-black/40">{stat.l}</p>
                  </div>
                ))}
              </div>
              {brandStory.ctaText && (
                <Link
                  href={brandStory.ctaLink || "/shop"}
                  className="rd-cta mt-10 inline-flex items-center gap-2 rounded-full bg-ink px-8 py-4 text-sm font-semibold uppercase tracking-widest text-bone transition-transform hover:scale-105"
                >
                  {brandStory.ctaText}
                  <ArrowRightIcon className="h-4 w-4 rtl:-scale-x-100" />
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      {/* NEW ARRIVALS — recent acquisitions */}
      {data.newArrivals.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-12 sm:pb-20 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4 border-b-2 border-ink pb-4">
            <div>
              <p className="font-display text-xs italic tracking-[0.25em] text-amber">{tr("home.freshIn")}</p>
              <h2 className="mt-2 font-display text-4xl font-medium tracking-tight sm:text-5xl">{tr("shop.newArrivals")}</h2>
            </div>
            <Link href="/shop?filter=new" className="hidden shrink-0 items-center gap-1.5 text-sm font-semibold uppercase tracking-wide hover:opacity-60 sm:flex">
              {tr("home.seeAllNew")} <ArrowRightIcon className="h-4 w-4 rtl:-scale-x-100" />
            </Link>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-4">
            {data.newArrivals.map((p, i) => (
              <ArchiveCard key={p.slug} product={p} tr={tr} fmt={fmt} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* VALUES — colophon row */}
      <section className="border-t border-black/15 bg-brand-50">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-10 sm:py-14 sm:px-6 lg:grid-cols-4 lg:px-8">
          {VALUES.map((v) => (
            <div key={v.titleKey} className="flex flex-col gap-3">
              <v.icon className="h-7 w-7 text-amber" />
              <h3 className="font-display text-base font-medium">{tr(v.titleKey)}</h3>
              <p className="text-sm text-black/55">{tr(v.copyKey, { amount: data.freeShipAmount })}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
