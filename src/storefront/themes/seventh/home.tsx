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
import { SeventhCard } from "./card";

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
 * BLOCK SEVEN homepage — a poster wall, not a template:
 * cobalt type-block hero with a hard-shadow image plate, safety-orange
 * ticker, numbered collection slabs, a dense drop grid, story as a
 * broadsheet panel. Loud composition, premium execution.
 */
export function SeventhHome({ data, tr, fmt }: HomeProps) {
  const { hero, brandStory, banners, collections, marquee, announcementLink } = data;

  return (
    <div className="seventh-home">
      {/* HERO — bone stage, cobalt type block, framed image plate */}
      {hero.enabled && (
        <section className="rd-hero rd-hero--pop relative overflow-hidden border-b-[3px] border-ink bg-bone text-ink">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-16 pt-28 sm:px-6 md:grid-cols-[1.15fr_1fr] md:items-center md:gap-8 lg:px-8 lg:pb-24 lg:pt-36">
            <div className="animate-fade-up">
              {hero.eyebrow && (
                <p className="rd-hero-eyebrow mb-4 inline-block border-2 border-ink bg-brand-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.3em]">
                  {hero.eyebrow}
                </p>
              )}
              <h1 className="font-display uppercase">
                <Multiline text={hero.title || "RYVEN DEPT"} />
              </h1>
              {hero.subtitle && (
                <p className="mt-5 max-w-md text-base font-medium leading-relaxed text-brand-500">
                  {hero.subtitle}
                </p>
              )}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                {hero.primaryText && (
                  <Link
                    href={hero.primaryLink || "/shop"}
                    className="rd-cta sb-shadow-sm inline-flex min-h-12 items-center gap-2 border-[3px] border-ink bg-ink px-8 py-4 text-sm font-bold uppercase tracking-widest text-bone transition-transform hover:-translate-y-0.5"
                  >
                    {hero.primaryText}
                    <ArrowRightIcon className="h-4 w-4 rtl:rotate-180" />
                  </Link>
                )}
                {hero.secondaryText && (
                  <Link
                    href={hero.secondaryLink || "/shop"}
                    className="inline-flex min-h-12 items-center border-[3px] border-ink bg-brand-50 px-8 py-4 text-sm font-bold uppercase tracking-widest text-ink transition-colors hover:bg-olive"
                  >
                    {hero.secondaryText}
                  </Link>
                )}
              </div>
            </div>

            {(hero.backgroundImage || hero.backgroundImageMobile) && (
              <div className="relative animate-fade-in">
                <div className="sb-frame sb-shadow overflow-hidden border-[3px] border-ink bg-brand-50">
                  <Image
                    src={(hero.backgroundImage || hero.backgroundImageMobile)!}
                    alt={hero.title || "Campaign"}
                    width={1200}
                    height={1400}
                    priority
                    className="aspect-[6/7] w-full object-cover"
                  />
                </div>
                <span className="sb-sticker absolute -bottom-4 start-6 bg-amber px-3 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-bone">
                  DROP — 07
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* TICKER — safety orange strip */}
      {marquee.length > 0 && (
        <div className="rd-ticker border-b-[3px] border-ink">
          <Marquee items={marquee} link={announcementLink} accent="●" className="py-3" />
        </div>
      )}

      {/* PROMO BANNERS — framed slab pair */}
      {banners.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className={`grid gap-6 ${banners.length > 1 ? "md:grid-cols-2" : ""}`}>
            {banners.map((b) => (
              <Link
                key={b.id}
                href={b.ctaLink || "/shop"}
                className="group relative overflow-hidden border-[3px] border-ink bg-brand-50"
              >
                {b.image ? (
                  <Image
                    src={b.image}
                    alt={b.title}
                    width={900}
                    height={500}
                    className="aspect-[16/9] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="aspect-[16/9] w-full bg-amber" />
                )}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 border-t-[3px] border-ink bg-brand-50 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-display text-sm uppercase tracking-tight text-ink">{b.title}</p>
                    {b.text && (
                      <p className="truncate text-xs font-medium text-brand-400">{b.text}</p>
                    )}
                  </div>
                  <ArrowRightIcon className="h-5 w-5 shrink-0 text-amber transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* COLLECTIONS — numbered concrete slabs */}
      {collections.length > 0 && (
        <section className="border-y-[3px] border-ink bg-brand-100/60">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="mb-8 flex items-end justify-between gap-4">
              <h2 className="font-display text-3xl uppercase tracking-tight text-ink sm:text-4xl">
                {tr("home.shopByCollection")}
              </h2>
              <Link href="/shop" className="hidden shrink-0 items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-amber hover:opacity-70 sm:flex">
                {tr("home.viewAll")}
                <ArrowRightIcon className="h-4 w-4 rtl:rotate-180" />
              </Link>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {collections.map((c, i) => (
                <Link
                  key={c.title}
                  href={c.link || "/shop"}
                  className="group relative overflow-hidden border-[3px] border-ink bg-brand-50"
                >
                  {c.image ? (
                    <Image
                      src={c.image}
                      alt={c.title}
                      width={800}
                      height={600}
                      className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="aspect-[4/3] w-full bg-sand" />
                  )}
                  <div className="absolute start-3 top-3 bg-ink px-2 py-1 font-display text-xs uppercase text-bone">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between border-t-[3px] border-ink bg-brand-50/95 px-4 py-3">
                    <span className="font-display text-lg uppercase tracking-tight text-ink">{c.title}</span>
                    <ArrowRightIcon className="h-4 w-4 text-amber rtl:rotate-180" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FEATURED DROP — dense poster grid */}
      {data.featured.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-end justify-between gap-4">
            <h2 className="font-display text-3xl uppercase tracking-tight text-ink sm:text-4xl">
              {tr("home.featuredPieces")}
            </h2>
            <Link href="/shop" className="hidden shrink-0 items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-amber hover:opacity-70 sm:flex">
              {tr("home.viewAll")}
              <ArrowRightIcon className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
            {data.featured.map((p, i) => (
              <SeventhCard key={p.slug} product={p} tr={tr} fmt={fmt} index={i} priority={i < 2} />
            ))}
          </div>
        </section>
      )}

      {/* BRAND STORY — broadsheet panel */}
      {brandStory.enabled && (
        <section className="rd-dark-panel border-y-[3px] border-ink bg-ink text-bone">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:items-center lg:px-8 lg:py-20">
            <div>
              <p className="mb-3 inline-block bg-olive px-3 py-1 text-[11px] font-bold uppercase tracking-[0.25em] text-ink">
                {tr("home.ethos")}
              </p>
              <h2 className="font-display text-3xl uppercase leading-tight tracking-tight sm:text-4xl">
                {brandStory.title}
              </h2>
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-bone/70">{brandStory.description}</p>
              {brandStory.ctaText && (
                <Link
                  href={brandStory.ctaLink || "/shop"}
                  className="mt-8 inline-flex items-center gap-2 border-2 border-bone px-7 py-3.5 text-sm font-bold uppercase tracking-widest text-bone transition-colors hover:bg-bone hover:text-ink"
                >
                  {brandStory.ctaText}
                  <ArrowRightIcon className="h-4 w-4 rtl:rotate-180" />
                </Link>
              )}
            </div>
            {brandStory.image && (
              <div className="sb-shadow overflow-hidden border-[3px] border-bone">
                <Image
                  src={brandStory.image}
                  alt={brandStory.title}
                  width={900}
                  height={700}
                  className="aspect-[4/3] w-full object-cover"
                />
              </div>
            )}
          </div>
        </section>
      )}

      {/* NEW ARRIVALS — second drop row */}
      {data.newArrivals.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-end justify-between gap-4">
            <h2 className="font-display text-3xl uppercase tracking-tight text-ink sm:text-4xl">
              {tr("home.freshIn")}
            </h2>
            <Link href="/shop?filter=new" className="hidden shrink-0 items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-amber hover:opacity-70 sm:flex">
              {tr("home.seeAllNew")}
              <ArrowRightIcon className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
            {data.newArrivals.map((p, i) => (
              <SeventhCard key={p.slug} product={p} tr={tr} fmt={fmt} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* VALUES — stamped strip */}
      <section className="border-t-[3px] border-ink bg-brand-100/60">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-px bg-ink/15 px-0 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map(({ icon: Icon, titleKey, copyKey }) => (
            <div key={titleKey} className="flex items-start gap-4 bg-bone px-6 py-8">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center border-2 border-ink bg-brand-50 text-amber">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-display text-sm uppercase tracking-tight text-ink">
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
