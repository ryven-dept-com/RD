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
import { ConcreteCard } from "./card";

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
 * RAW CONCRETE homepage — industrial grid: utility ticker, split framed
 * hero, numbered collection blocks, a border-fused product grid, spec-block
 * brand story. Zero rounded corners, maximum structure.
 */
export function ConcreteHome({ data, tr, fmt }: HomeProps) {
  const { hero, brandStory, banners, collections, marquee, announcementLink } = data;

  return (
    <div className="concrete-home">
      {/* utility ticker — framed strip */}
      <section className="rd-dark-panel border-b-2 border-ink bg-ink py-2.5 text-bone">
        <Marquee items={marquee} link={announcementLink} accent="▪" />
      </section>

      {/* HERO — split framed composition */}
      {hero.enabled && (
        <section className="rd-hero rd-hero--brutalist border-b-2 border-ink">
          <div className="mx-auto grid max-w-7xl gap-0 px-4 pt-24 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:px-8 lg:pt-28">
            <div className="flex flex-col justify-end pb-12 lg:pb-16">
              <p className="rd-hero-eyebrow animate-fade-up text-xs font-bold uppercase tracking-[0.4em]">
                {hero.eyebrow}
              </p>
              <h1 className="animate-fade-up delay-100 mt-5 font-display text-6xl uppercase leading-[0.92] tracking-tight sm:text-7xl lg:text-8xl">
                <Multiline text={hero.title} />
              </h1>
              <p className="animate-fade-up delay-200 mt-6 max-w-md border-s-2 border-amber ps-4 text-sm leading-relaxed text-black/60">
                {hero.subtitle}
              </p>
              <div className="animate-fade-up delay-300 mt-8 flex flex-wrap items-center gap-3">
                {hero.primaryText && (
                  <Link
                    href={hero.primaryLink || "/shop"}
                    className="rd-cta group inline-flex items-center gap-2 border-2 border-ink bg-ink px-7 py-3.5 text-sm font-bold uppercase tracking-widest text-bone transition-colors hover:bg-transparent hover:text-ink"
                  >
                    {hero.primaryText}
                    <ArrowRightIcon className="h-4 w-4 rtl:-scale-x-100" />
                  </Link>
                )}
                {hero.secondaryText && (
                  <Link
                    href={hero.secondaryLink || "/shop"}
                    className="rd-cta inline-flex items-center border-2 border-ink px-7 py-3.5 text-sm font-bold uppercase tracking-widest transition-colors hover:bg-ink hover:text-bone"
                  >
                    {hero.secondaryText}
                  </Link>
                )}
              </div>
            </div>

            {/* framed image tower */}
            <div className="relative">
              {(hero.backgroundImage || hero.backgroundImageMobile) && (
                <div className="relative aspect-[4/5] border-2 border-ink bg-brand-100 lg:aspect-auto lg:h-full lg:min-h-[560px]">
                  <Image
                    src={(hero.backgroundImage || hero.backgroundImageMobile)!}
                    alt={tr("home.heroAlt")}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 42vw"
                    className="concrete-img object-cover"
                  />
                  <span className="absolute end-0 top-0 border-s-2 border-b-2 border-ink bg-bone px-2.5 py-1 font-display text-xs font-bold tracking-[0.2em]">
                    A/01
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* CAMPAIGN BANNERS (CMS) — framed blocks */}
      {banners.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
          <div className="space-y-4">
            {banners.map((b) => (
              <div key={b.id ?? b.title} className="relative overflow-hidden border-2 border-ink bg-ink text-bone">
                {b.image && (
                  <Image src={b.image} alt="" fill sizes="100vw" className="concrete-img object-cover opacity-50" />
                )}
                <div className="relative flex flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-10">
                  <div className="min-w-0">
                    {b.title && <h3 className="font-display text-2xl uppercase tracking-tight sm:text-3xl">{b.title}</h3>}
                    {b.text && <p className="mt-2 max-w-xl text-sm text-bone/70">{b.text}</p>}
                  </div>
                  {b.ctaText && (
                    <Link
                      href={b.ctaLink || "/shop"}
                      className="rd-cta shrink-0 border-2 border-bone bg-bone px-6 py-3 text-center text-xs font-bold uppercase tracking-widest text-ink transition-colors hover:bg-transparent hover:text-bone"
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

      {/* COLLECTIONS — numbered framed blocks */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between border-b-2 border-ink pb-4">
          <h2 className="font-display text-4xl uppercase tracking-tight sm:text-5xl">
            {tr("home.shopByCollection")}
          </h2>
          <Link href="/shop" className="hidden items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] hover:text-amber sm:flex">
            {tr("home.viewAll")} <ArrowRightIcon className="h-4 w-4 rtl:-scale-x-100" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {collections.map((c, i) => (
            <Link
              key={`${c.title}-${i}`}
              href={c.link || "/shop"}
              className={`group relative overflow-hidden border-2 border-ink bg-ink ${i === 0 ? "sm:col-span-2" : ""}`}
            >
              <div className="relative aspect-[4/3]">
                {c.image && (
                  <Image
                    src={c.image}
                    alt={c.title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 25vw"
                    className="concrete-img img-zoom object-cover opacity-90"
                  />
                )}
                <span className="absolute start-0 top-0 border-e-2 border-b-2 border-ink bg-bone px-2.5 py-1 font-display text-xs font-bold tracking-[0.2em] text-ink">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="absolute inset-x-0 bottom-0 border-t-2 border-ink bg-bone p-4">
                  {c.tag && <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber">{c.tag}</p>}
                  <h3 className="mt-0.5 font-display text-xl uppercase tracking-tight">{c.title}</h3>
                  <span className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest">
                    {tr("home.explore")}
                    <ArrowRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1 rtl:-scale-x-100" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* FEATURED — border-fused industrial grid */}
      <section className="border-y-2 border-ink bg-brand-50">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-end justify-between border-b-2 border-ink pb-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-amber">{tr("home.theEssentials")}</p>
              <h2 className="mt-1 font-display text-4xl uppercase tracking-tight sm:text-5xl">{tr("home.featuredPieces")}</h2>
            </div>
            <Link href="/shop" className="hidden items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] hover:text-amber sm:flex">
              {tr("nav.shopAll")} <ArrowRightIcon className="h-4 w-4 rtl:-scale-x-100" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {data.featured.map((p, i) => (
              <ConcreteCard key={p.slug} product={p} tr={tr} fmt={fmt} index={i} priority={i < 4} />
            ))}
          </div>
        </div>
      </section>

      {/* BRAND STORY — spec block */}
      {brandStory.enabled && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid border-2 border-ink lg:grid-cols-2">
            <div className="border-b-2 border-ink p-8 lg:border-b-0 lg:border-e-2 lg:p-12">
              <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-amber">{tr("home.ethos")}</p>
              <h2 className="mt-3 font-display text-4xl uppercase leading-tight tracking-tight sm:text-5xl">
                <Multiline text={brandStory.title} />
              </h2>
              <p className="mt-6 text-black/70">{brandStory.description}</p>
              {brandStory.ctaText && (
                <Link
                  href={brandStory.ctaLink || "/shop"}
                  className="rd-cta mt-8 inline-flex items-center gap-2 border-2 border-ink bg-ink px-7 py-3.5 text-sm font-bold uppercase tracking-widest text-bone transition-colors hover:bg-transparent hover:text-ink"
                >
                  {brandStory.ctaText}
                  <ArrowRightIcon className="h-4 w-4 rtl:-scale-x-100" />
                </Link>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 lg:grid-rows-3">
              {[
                { n: "480", l: tr("home.statGsm") },
                { n: "2.4k+", l: tr("home.statReviews") },
                { n: tr("home.stat30day"), l: tr("home.statReturns") },
              ].map((stat, i) => (
                <div key={stat.l} className={`flex items-center gap-5 p-6 ${i < 2 ? "border-b-2 border-ink" : ""}`}>
                  <p className="font-display text-4xl">{stat.n}</p>
                  <p className="text-xs font-bold uppercase tracking-widest text-black/50">{stat.l}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* NEW ARRIVALS — framed strip */}
      {data.newArrivals.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-end justify-between border-b-2 border-ink pb-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-amber">{tr("home.freshIn")}</p>
              <h2 className="mt-1 font-display text-4xl uppercase tracking-tight sm:text-5xl">{tr("shop.newArrivals")}</h2>
            </div>
            <Link href="/shop?filter=new" className="hidden items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] hover:text-amber sm:flex">
              {tr("home.seeAllNew")} <ArrowRightIcon className="h-4 w-4 rtl:-scale-x-100" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {data.newArrivals.map((p, i) => (
              <ConcreteCard key={p.slug} product={p} tr={tr} fmt={fmt} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* VALUES — four fused cells */}
      <section className="border-t-2 border-ink">
        <div className="mx-auto grid max-w-7xl grid-cols-2 lg:grid-cols-4">
          {VALUES.map((v, i) => (
            <div key={v.titleKey} className={`flex flex-col gap-3 border-ink p-6 ${i % 2 === 0 ? "border-e-2" : ""} ${i < 2 ? "border-b-2 lg:border-b-0" : ""}`}>
              <v.icon className="h-7 w-7 text-amber" />
              <h3 className="text-sm font-bold uppercase tracking-wide">{tr(v.titleKey)}</h3>
              <p className="text-sm text-black/55">{tr(v.copyKey, { amount: data.freeShipAmount })}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
