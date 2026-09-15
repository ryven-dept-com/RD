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
import type { HomeProps } from "@/storefront/types";
import { SignatureCard } from "./card";

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
 * SIGNATURE homepage — whitespace as a material: a washed centered hero,
 * one quiet announcement line, two monumental collection images, a sparse
 * grid, a centered essay, hairline everything.
 */
export function SignatureHome({ data, tr, fmt }: HomeProps) {
  const { hero, brandStory, banners, collections, marquee, announcementLink } = data;

  return (
    <div className="signature-home">
      {/* HERO — whisper over wash */}
      {hero.enabled && (
        <section className="rd-hero rd-hero--minimal relative flex min-h-[100svh] items-end overflow-hidden bg-bone">
          {(hero.backgroundImage || hero.backgroundImageMobile) && (
            <>
              {hero.video ? (
                <video
                  src={hero.video}
                  autoPlay
                  muted
                  loop
                  playsInline
                  poster={hero.backgroundImage || undefined}
                  className="absolute inset-0 h-full w-full object-cover opacity-90"
                />
              ) : (
                <Image
                  src={(hero.backgroundImage || hero.backgroundImageMobile)!}
                  alt={tr("home.heroAlt")}
                  fill
                  priority
                  sizes="100vw"
                  className="object-cover animate-fade-in"
                />
              )}
            </>
          )}
          {hero.audio && <audio src={hero.audio} autoPlay loop className="hidden" />}
          <div className="rd-hero-veil rd-hero-veil-a absolute inset-0" />

          <div className="rd-hero-inner relative mx-auto w-full max-w-7xl px-4 pb-20 pt-32 sm:px-6 lg:px-8">
            <p className="animate-fade-up text-[11px] font-medium uppercase tracking-[0.6em] text-black/50">
              {hero.eyebrow}
            </p>
            <h1 className="animate-fade-up delay-200 mx-auto mt-6 max-w-3xl font-display text-5xl font-normal leading-[1.04] tracking-tight sm:text-6xl lg:text-7xl">
              <Multiline text={hero.title} />
            </h1>
            <p className="animate-fade-up delay-300 mx-auto mt-6 max-w-md text-base leading-relaxed text-black/60">
              {hero.subtitle}
            </p>
            <div className="animate-fade-up delay-400 mt-10 flex flex-wrap items-center justify-center gap-4">
              {hero.primaryText && (
                <Link
                  href={hero.primaryLink || "/shop"}
                  className="rd-cta group flex items-center gap-2 rounded-full bg-ink px-9 py-4 text-xs font-semibold uppercase tracking-[0.25em] text-bone transition-transform hover:scale-[1.03]"
                >
                  {hero.primaryText}
                  <ArrowRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1 rtl:-scale-x-100" />
                </Link>
              )}
              {hero.secondaryText && (
                <Link
                  href={hero.secondaryLink || "/shop"}
                  className="rd-cta rounded-full border border-black/25 px-9 py-4 text-xs font-semibold uppercase tracking-[0.25em] text-ink transition-colors hover:bg-black/5"
                >
                  {hero.secondaryText}
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      {/* quiet announcement — one line, no motion */}
      {marquee.length > 0 && (
        <p className="border-y border-black/10 px-4 py-4 text-center text-[11px] font-medium uppercase tracking-[0.35em] text-black/50">
          {announcementLink ? (
            <Link href={announcementLink} className="hover:text-ink">{marquee[0]}</Link>
          ) : (
            marquee[0]
          )}
        </p>
      )}

      {/* CAMPAIGN BANNERS (CMS) — restrained strips */}
      {banners.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 pt-24 sm:px-6 lg:px-8">
          <div className="space-y-16">
            {banners.map((b) => (
              <div key={b.id ?? b.title} className="text-center">
                {b.title && <h3 className="font-display text-3xl font-normal tracking-tight sm:text-4xl">{b.title}</h3>}
                {b.text && <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-black/55">{b.text}</p>}
                {b.ctaText && (
                  <Link
                    href={b.ctaLink || "/shop"}
                    className="rd-cta mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-8 py-3.5 text-xs font-semibold uppercase tracking-[0.25em] text-bone"
                  >
                    {b.ctaText}
                    <ArrowRightIcon className="h-3.5 w-3.5 rtl:-scale-x-100" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* COLLECTIONS — two monumental images */}
      <section className="mx-auto max-w-7xl px-4 py-28 sm:px-6 lg:px-8">
        <p className="text-center text-[11px] font-medium uppercase tracking-[0.5em] text-black/40">{tr("home.curatedLines")}</p>
        <h2 className="mt-4 text-center font-display text-4xl font-normal tracking-tight sm:text-5xl">
          {tr("home.shopByCollection")}
        </h2>

        <div className="mt-16 space-y-20">
          {collections.slice(0, 4).map((c, i) => (
            <Link
              key={`${c.title}-${i}`}
              href={c.link || "/shop"}
              className="group block"
            >
              <div className="relative aspect-[16/9] overflow-hidden rounded-sm bg-brand-100 sm:aspect-[21/9]">
                {c.image && (
                  <Image
                    src={c.image}
                    alt={c.title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 90vw"
                    className="img-zoom object-cover"
                  />
                )}
              </div>
              <div className="mt-5 flex items-baseline justify-between border-b border-black/10 pb-5">
                <div>
                  {c.tag && <p className="text-[10px] uppercase tracking-[0.4em] text-black/40">{c.tag}</p>}
                  <h3 className="mt-1 font-display text-2xl font-normal tracking-tight sm:text-3xl">{c.title}</h3>
                </div>
                <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.3em]">
                  {tr("home.explore")}
                  <ArrowRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1 rtl:-scale-x-100" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* FEATURED — sparse grid */}
      <section className="border-t border-black/10 py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-[11px] font-medium uppercase tracking-[0.5em] text-black/40">{tr("home.theEssentials")}</p>
          <h2 className="mt-4 text-center font-display text-4xl font-normal tracking-tight sm:text-5xl">{tr("home.featuredPieces")}</h2>

          <div className="mt-16 grid grid-cols-1 gap-x-6 gap-y-20 sm:grid-cols-2">
            {data.featured.slice(0, 6).map((p, i) => (
              <SignatureCard key={p.slug} product={p} tr={tr} fmt={fmt} index={i} priority={i < 2} />
            ))}
          </div>

          <div className="mt-20 text-center">
            <Link
              href="/shop"
              className="rd-cta inline-flex items-center gap-2 rounded-full border border-black/25 px-9 py-4 text-xs font-semibold uppercase tracking-[0.25em] transition-colors hover:bg-black/5"
            >
              {tr("nav.shopAll")}
              <ArrowRightIcon className="h-3.5 w-3.5 rtl:-scale-x-100" />
            </Link>
          </div>
        </div>
      </section>

      {/* BRAND STORY — centered essay */}
      {brandStory.enabled && (
        <section className="border-t border-black/10 py-28">
          <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.5em] text-black/40">{tr("home.ethos")}</p>
            <h2 className="mt-5 font-display text-4xl font-normal leading-tight tracking-tight sm:text-5xl">
              <Multiline text={brandStory.title} />
            </h2>
            <p className="mt-8 leading-relaxed text-black/60">{brandStory.description}</p>

            <div className="mx-auto mt-12 flex max-w-md items-center justify-between border-y border-black/10 py-6">
              {[
                { n: "480", l: tr("home.statGsm") },
                { n: "2.4k+", l: tr("home.statReviews") },
                { n: tr("home.stat30day"), l: tr("home.statReturns") },
              ].map((stat) => (
                <div key={stat.l}>
                  <p className="font-display text-2xl">{stat.n}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-black/40">{stat.l}</p>
                </div>
              ))}
            </div>

            {brandStory.ctaText && (
              <Link
                href={brandStory.ctaLink || "/shop"}
                className="rd-cta mt-12 inline-flex items-center gap-2 rounded-full bg-ink px-9 py-4 text-xs font-semibold uppercase tracking-[0.25em] text-bone transition-transform hover:scale-[1.03]"
              >
                {brandStory.ctaText}
                <ArrowRightIcon className="h-3.5 w-3.5 rtl:-scale-x-100" />
              </Link>
            )}
          </div>
        </section>
      )}

      {/* NEW ARRIVALS */}
      {data.newArrivals.length > 0 && (
        <section className="border-t border-black/10 py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <p className="text-center text-[11px] font-medium uppercase tracking-[0.5em] text-black/40">{tr("home.freshIn")}</p>
            <h2 className="mt-4 text-center font-display text-4xl font-normal tracking-tight sm:text-5xl">{tr("shop.newArrivals")}</h2>
            <div className="mt-16 grid grid-cols-2 gap-x-6 gap-y-16 md:grid-cols-4">
              {data.newArrivals.map((p, i) => (
                <SignatureCard key={p.slug} product={p} tr={tr} fmt={fmt} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* VALUES — hairline row */}
      <section className="border-t border-black/10">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-8 gap-y-12 px-4 py-20 sm:px-6 lg:grid-cols-4 lg:px-8">
          {VALUES.map((v) => (
            <div key={v.titleKey} className="flex flex-col items-center gap-3 text-center">
              <v.icon className="h-6 w-6 text-black/50" />
              <h3 className="text-[11px] font-medium uppercase tracking-[0.3em]">{tr(v.titleKey)}</h3>
              <p className="text-sm text-black/50">{tr(v.copyKey, { amount: data.freeShipAmount })}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
