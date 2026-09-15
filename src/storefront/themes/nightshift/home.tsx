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
import { NightshiftCard } from "./card";

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
 * NIGHT SHIFT homepage — a deep-space stage: radial-glow hero with HUD
 * brackets, glowing ticker, a rail of luminous collection tiles, grid of
 * stage cards, readout-style brand story.
 */
export function NightshiftHome({ data, tr, fmt }: HomeProps) {
  const { hero, brandStory, banners, collections, marquee, announcementLink } = data;

  return (
    <div className="ns-home">
      {/* HERO — immersive radial stage */}
      {hero.enabled && (
        <section className="rd-hero rd-hero--immersive rd-dark-panel relative flex min-h-[100svh] items-end overflow-hidden bg-ink text-bone">
          {hero.video ? (
            <video
              src={hero.video}
              autoPlay
              muted
              loop
              playsInline
              poster={hero.backgroundImage || undefined}
              className="absolute inset-0 h-full w-full object-cover object-center opacity-80 animate-fade-in"
            />
          ) : hero.backgroundImage || hero.backgroundImageMobile ? (
            <Image
              src={(hero.backgroundImage || hero.backgroundImageMobile)!}
              alt={tr("home.heroAlt")}
              fill
              priority
              sizes="100vw"
              className="object-cover object-center opacity-80 animate-fade-in"
            />
          ) : null}
          {hero.audio && <audio src={hero.audio} autoPlay loop className="hidden" />}
          <div className="rd-hero-veil rd-hero-veil-a absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-ink/30" />
          {/* HUD corner brackets */}
          <div className="pointer-events-none absolute inset-6 hidden border border-bone/10 sm:block" aria-hidden>
            <span className="absolute -start-px -top-px h-6 w-6 border-s-2 border-t-2 border-amber" />
            <span className="absolute -end-px -top-px h-6 w-6 border-e-2 border-t-2 border-amber" />
            <span className="absolute -bottom-px -start-px h-6 w-6 border-b-2 border-s-2 border-amber" />
            <span className="absolute -bottom-px -end-px h-6 w-6 border-b-2 border-e-2 border-amber" />
          </div>

          <div className="rd-hero-inner relative mx-auto w-full max-w-7xl px-4 pb-16 pt-28 sm:px-6 lg:px-8 lg:pb-24">
            <p className="rd-hero-eyebrow animate-fade-up inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-bone/70 delay-100">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber" aria-hidden />
              {hero.eyebrow}
            </p>
            <h1 className="animate-fade-up delay-200 mt-4 max-w-4xl font-display text-6xl uppercase leading-[0.9] tracking-tight sm:text-7xl lg:text-8xl">
              <Multiline text={hero.title} />
            </h1>
            <p className="animate-fade-up delay-300 mt-6 max-w-md text-base leading-relaxed text-bone/70">
              {hero.subtitle}
            </p>
            <div className="animate-fade-up delay-400 mt-8 flex flex-wrap items-center gap-4">
              {hero.primaryText && (
                <Link
                  href={hero.primaryLink || "/shop"}
                  className="rd-cta group flex items-center gap-2 rounded-full bg-bone px-8 py-4 text-sm font-semibold uppercase tracking-widest text-ink transition-transform hover:scale-105"
                >
                  {hero.primaryText}
                  <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1 rtl:-scale-x-100" />
                </Link>
              )}
              {hero.secondaryText && (
                <Link
                  href={hero.secondaryLink || "/shop"}
                  className="rd-cta rounded-full border border-bone/40 px-8 py-4 text-sm font-semibold uppercase tracking-widest text-bone transition-colors hover:bg-bone/10"
                >
                  {hero.secondaryText}
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      {/* glow ticker */}
      <section className="rd-dark-panel border-y border-ink/10 bg-ink py-3 text-bone">
        <Marquee items={marquee} link={announcementLink} accent="◦" />
      </section>

      {/* CAMPAIGN BANNERS (CMS) */}
      {banners.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-14 sm:px-6 lg:px-8">
          <div className="space-y-4">
            {banners.map((b) => (
              <div key={b.id ?? b.title} className="rd-dark-panel ns-panel relative overflow-hidden rounded-lg border border-brand-100 bg-ink text-bone">
                {b.image && <Image src={b.image} alt="" fill sizes="100vw" className="object-cover opacity-40" />}
                <div className="relative flex flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-10">
                  <div className="min-w-0">
                    {b.title && <h3 className="font-display text-2xl uppercase tracking-tight sm:text-3xl">{b.title}</h3>}
                    {b.text && <p className="mt-2 max-w-xl text-sm text-bone/70">{b.text}</p>}
                  </div>
                  {b.ctaText && (
                    <Link
                      href={b.ctaLink || "/shop"}
                      className="rd-cta shrink-0 rounded-full bg-bone px-6 py-3 text-center text-xs font-semibold uppercase tracking-widest text-ink transition-transform hover:scale-105"
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

      {/* COLLECTIONS — luminous rail */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-amber">
              <span className="h-1.5 w-1.5 rounded-full bg-amber" aria-hidden />
              {tr("home.curatedLines")}
            </p>
            <h2 className="mt-2 font-display text-4xl uppercase tracking-tight sm:text-5xl">{tr("home.shopByCollection")}</h2>
          </div>
          <Link href="/shop" className="hidden shrink-0 items-center gap-1.5 text-sm font-semibold uppercase tracking-wide hover:opacity-60 sm:flex">
            {tr("home.viewAll")} <ArrowRightIcon className="h-4 w-4 rtl:-scale-x-100" />
          </Link>
        </div>

        <div className="no-scrollbar mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
          {collections.map((c, i) => (
            <Link
              key={`${c.title}-${i}`}
              href={c.link || "/shop"}
              className={`rd-dark-panel ns-tile group relative shrink-0 snap-start overflow-hidden rounded-lg border border-brand-100 bg-ink ${
                i === 0 ? "w-[80vw] sm:w-[46vw] lg:w-[38vw]" : "w-[70vw] sm:w-[38vw] lg:w-[28vw]"
              }`}
            >
              <div className="relative aspect-[16/10]">
                {c.image && (
                  <Image
                    src={c.image}
                    alt={c.title}
                    fill
                    sizes="(max-width: 1024px) 80vw, 35vw"
                    className="img-zoom object-cover opacity-90"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 text-bone">
                  {c.tag && <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-amber">{c.tag}</p>}
                  <h3 className="mt-1 font-display text-2xl uppercase tracking-tight">{c.title}</h3>
                  <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest">
                    {tr("home.explore")}
                    <ArrowRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1 rtl:-scale-x-100" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* FEATURED — stage grid */}
      <section className="border-y border-brand-100 bg-brand-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-amber">
                <span className="h-1.5 w-1.5 rounded-full bg-amber" aria-hidden />
                {tr("home.theEssentials")}
              </p>
              <h2 className="mt-2 font-display text-4xl uppercase tracking-tight sm:text-5xl">{tr("home.featuredPieces")}</h2>
            </div>
            <Link href="/shop" className="hidden shrink-0 items-center gap-1.5 text-sm font-semibold uppercase tracking-wide hover:opacity-60 sm:flex">
              {tr("nav.shopAll")} <ArrowRightIcon className="h-4 w-4 rtl:-scale-x-100" />
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
            {data.featured.map((p, i) => (
              <NightshiftCard key={p.slug} product={p} tr={tr} fmt={fmt} index={i} priority={i < 4} />
            ))}
          </div>
        </div>
      </section>

      {/* BRAND STORY — system readout */}
      {brandStory.enabled && (
        <section className="rd-dark-panel relative overflow-hidden bg-ink text-bone">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute inset-0 bg-[radial-gradient(50%_40%_at_80%_20%,rgba(var(--rd-glow),0.10),transparent_70%)]" />
          </div>
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-28">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-bone/50">
                <span className="h-1.5 w-1.5 rounded-full bg-amber" aria-hidden />
                {tr("home.ethos")}
              </p>
              <h2 className="mt-3 font-display text-4xl uppercase leading-tight tracking-tight sm:text-5xl">
                <Multiline text={brandStory.title} />
              </h2>
              <p className="mt-6 max-w-lg text-bone/70">{brandStory.description}</p>
              {brandStory.ctaText && (
                <Link
                  href={brandStory.ctaLink || "/shop"}
                  className="rd-cta mt-10 inline-flex items-center gap-2 rounded-full bg-bone px-8 py-4 text-sm font-semibold uppercase tracking-widest text-ink transition-transform hover:scale-105"
                >
                  {brandStory.ctaText}
                  <ArrowRightIcon className="h-4 w-4 rtl:-scale-x-100" />
                </Link>
              )}
            </div>
            {/* readout stats */}
            <div className="grid grid-cols-1 gap-3">
              {[
                { n: "480", l: tr("home.statGsm") },
                { n: "2.4k+", l: tr("home.statReviews") },
                { n: tr("home.stat30day"), l: tr("home.statReturns") },
              ].map((stat) => (
                <div key={stat.l} className="ns-readout flex items-center justify-between rounded-lg border border-brand-100 bg-bone/5 px-6 py-5">
                  <p className="font-display text-3xl sm:text-4xl">{stat.n}</p>
                  <p className="text-xs uppercase tracking-[0.25em] text-bone/50">{stat.l}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* NEW ARRIVALS */}
      {data.newArrivals.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-amber">
                <span className="h-1.5 w-1.5 rounded-full bg-amber" aria-hidden />
                {tr("home.freshIn")}
              </p>
              <h2 className="mt-2 font-display text-4xl uppercase tracking-tight sm:text-5xl">{tr("shop.newArrivals")}</h2>
            </div>
            <Link href="/shop?filter=new" className="hidden shrink-0 items-center gap-1.5 text-sm font-semibold uppercase tracking-wide hover:opacity-60 sm:flex">
              {tr("home.seeAllNew")} <ArrowRightIcon className="h-4 w-4 rtl:-scale-x-100" />
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
            {data.newArrivals.map((p, i) => (
              <NightshiftCard key={p.slug} product={p} tr={tr} fmt={fmt} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* VALUES */}
      <section className="border-t border-brand-100 bg-brand-50">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-14 sm:px-6 lg:grid-cols-4 lg:px-8">
          {VALUES.map((v) => (
            <div key={v.titleKey} className="flex flex-col gap-3">
              <v.icon className="h-7 w-7 text-amber" />
              <h3 className="text-sm font-semibold uppercase tracking-wide">{tr(v.titleKey)}</h3>
              <p className="text-sm text-black/55">{tr(v.copyKey, { amount: data.freeShipAmount })}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
