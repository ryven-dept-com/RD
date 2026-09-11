import Link from "next/link";
import { Fragment } from "react";
import {
  getFeaturedProducts,
  getNewProducts,
  getProductsByIds,
} from "@/lib/queries";
import {
  DEFAULT_COLLECTIONS,
  activeAnnouncement,
  activeBanners,
  getCmsData,
  marqueeItems,
} from "@/lib/cms";
import { ProductCard } from "@/components/product-card";
import {
  ArrowRightIcon,
  RefreshIcon,
  ShieldIcon,
  StarBadgeIcon,
  TruckIcon,
} from "@/components/icons";

export const dynamic = "force-dynamic";

const VALUES = [
  {
    icon: TruckIcon,
    title: "Free express shipping",
    copy: "On all orders over $150, delivered in 2–4 days.",
  },
  {
    icon: RefreshIcon,
    title: "30-day easy returns",
    copy: "Not right? Send it back, no questions asked.",
  },
  {
    icon: ShieldIcon,
    title: "Built to outlast",
    copy: "Heavyweight fabrics and reinforced construction.",
  },
  {
    icon: StarBadgeIcon,
    title: "Loved by thousands",
    copy: "4.8/5 average across 2,400+ verified reviews.",
  },
];

/** Render multi-line CMS titles with the original <br/> line breaks. */
function Multiline({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {line}
        </Fragment>
      ))}
    </>
  );
}

export default async function HomePage() {
  const cms = await getCmsData();

  // CMS-curated product lists fall back to the original flag-based queries
  // whenever they are empty or resolve to nothing, so the page never blanks.
  const [cmsFeatured, cmsNewArrivals] = await Promise.all([
    getProductsByIds(cms.featured.map((f) => f.productId)),
    getProductsByIds(cms.newArrivals.map((n) => n.productId)),
  ]);
  const [flagFeatured, flagNewArrivals] = await Promise.all([
    cmsFeatured.length ? [] : getFeaturedProducts(8),
    cmsNewArrivals.length ? [] : getNewProducts(4),
  ]);
  const featured = cmsFeatured.length ? cmsFeatured : flagFeatured;
  const newArrivals = cmsNewArrivals.length ? cmsNewArrivals : flagNewArrivals;

  const { hero, brandStory, announcement } = cms;
  const activeAnn = activeAnnouncement(announcement);
  const banners = activeBanners(cms.banners);
  const collections = (() => {
    const enabled = cms.collections.filter((c) => c.enabled);
    return enabled.length ? enabled : DEFAULT_COLLECTIONS;
  })();
  // The CMS announcement overrides the default marquee messages; the
  // newsletter/footer CMS content is rendered by the store layout's Footer.
  const marquee = marqueeItems(announcement);

  return (
    <>
      {/* HERO */}
      {hero.enabled && (
        <section className="relative flex min-h-[100svh] items-end overflow-hidden bg-ink text-bone">
          {hero.video ? (
            <video
              src={hero.video}
              autoPlay
              muted
              loop
              playsInline
              poster={hero.backgroundImage || undefined}
              className="absolute inset-0 h-full w-full object-cover object-center animate-fade-in"
            />
          ) : (
            <picture>
              {hero.backgroundImageMobile && (
                <source
                  media="(max-width: 767px)"
                  srcSet={hero.backgroundImageMobile}
                />
              )}
              <img
                src={hero.backgroundImage}
                alt="Ruven Dept. streetwear campaign"
                className="absolute inset-0 h-full w-full object-cover object-center animate-fade-in"
              />
            </picture>
          )}
          {hero.audio && <audio src={hero.audio} autoPlay loop className="hidden" />}
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-ink/30" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink/60 to-transparent" />

          <div className="relative mx-auto w-full max-w-7xl px-4 pb-16 pt-28 sm:px-6 lg:px-8 lg:pb-24">
            <p className="animate-fade-up text-xs font-semibold uppercase tracking-[0.3em] text-bone/70 delay-100">
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
                  className="group flex items-center gap-2 rounded-full bg-bone px-8 py-4 text-sm font-semibold uppercase tracking-widest text-ink transition-transform hover:scale-105"
                >
                  {hero.primaryText}
                  <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              )}
              {hero.secondaryText && (
                <Link
                  href={hero.secondaryLink || "/shop"}
                  className="rounded-full border border-bone/40 px-8 py-4 text-sm font-semibold uppercase tracking-widest text-bone transition-colors hover:bg-bone/10"
                >
                  {hero.secondaryText}
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      {/* MARQUEE */}
      <section className="border-y border-ink/10 bg-ink py-3 text-bone">
        <div className="relative flex overflow-hidden">
          <div className="animate-marquee flex shrink-0 items-center gap-8 whitespace-nowrap pr-8">
            {[...marquee, ...marquee].map((m, i) => (
              <span
                key={i}
                className="flex items-center gap-8 text-xs font-semibold uppercase tracking-[0.2em]"
              >
                {activeAnn?.link ? (
                  <Link href={activeAnn.link} className="hover:opacity-70">
                    {m}
                  </Link>
                ) : (
                  m
                )}
                <span className="text-amber">✦</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* PROMOTIONAL BANNERS (CMS, only when an enabled one is scheduled) */}
      {banners.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8">
          <div className="space-y-4">
            {banners.map((b) => (
              <div
                key={b.id ?? b.title}
                className="relative overflow-hidden rounded-2xl bg-ink text-bone"
              >
                {b.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={b.image}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-40"
                  />
                )}
                <div className="relative flex flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-10">
                  <div className="min-w-0">
                    {b.title && (
                      <h3 className="font-display text-2xl uppercase tracking-tight sm:text-3xl">
                        {b.title}
                      </h3>
                    )}
                    {b.text && (
                      <p className="mt-2 max-w-xl text-sm text-bone/70">
                        {b.text}
                      </p>
                    )}
                  </div>
                  {b.ctaText && (
                    <Link
                      href={b.ctaLink || "/shop"}
                      className="shrink-0 rounded-full bg-bone px-6 py-3 text-center text-xs font-semibold uppercase tracking-widest text-ink transition-transform hover:scale-105"
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

      {/* COLLECTIONS */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-black/40">
              Curated Lines
            </p>
            <h2 className="mt-2 font-display text-4xl uppercase tracking-tight sm:text-5xl">
              Shop by collection
            </h2>
          </div>
          <Link
            href="/shop"
            className="hidden shrink-0 items-center gap-1.5 text-sm font-semibold uppercase tracking-wide hover:opacity-60 sm:flex"
          >
            View all <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-8 grid auto-rows-[260px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {collections.map((c, i) => {
            const tall = i === 0;
            return (
              <Link
                key={`${c.title}-${i}`}
                href={c.link || "/shop"}
                className={`group relative overflow-hidden rounded-2xl bg-ink ${
                  tall ? "lg:col-span-2 lg:row-span-2" : ""
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.image}
                  alt={c.title}
                  className="img-zoom absolute inset-0 h-full w-full object-cover opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6 text-bone">
                  {c.tag && (
                    <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-bone/70">
                      {c.tag}
                    </p>
                  )}
                  <h3
                    className={`mt-1 font-display uppercase tracking-tight ${
                      tall ? "text-4xl sm:text-5xl" : "text-2xl"
                    }`}
                  >
                    {c.title}
                  </h3>
                  <p className="mt-1 text-sm text-bone/70">{c.description}</p>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest">
                    Explore
                    <ArrowRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      <section className="bg-brand-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-black/40">
                The Essentials
              </p>
              <h2 className="mt-2 font-display text-4xl uppercase tracking-tight sm:text-5xl">
                Featured pieces
              </h2>
            </div>
            <Link
              href="/shop"
              className="hidden shrink-0 items-center gap-1.5 text-sm font-semibold uppercase tracking-wide hover:opacity-60 sm:flex"
            >
              Shop all <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
            {featured.map((p, i) => (
              <ProductCard key={p.slug} product={p} index={i} priority={i < 4} />
            ))}
          </div>
        </div>
      </section>

      {/* BRAND STORY */}
      {brandStory.enabled && (
        <section className="relative overflow-hidden bg-ink text-bone">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-28">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-bone/50">
                The Ruven Ethos
              </p>
              <h2 className="mt-3 font-display text-4xl uppercase leading-tight tracking-tight sm:text-5xl">
                <Multiline text={brandStory.title} />
              </h2>
              <p className="mt-6 max-w-lg text-bone/70">
                {brandStory.description}
              </p>
              <div className="mt-10 grid grid-cols-3 gap-6">
                {[
                  { n: "480", l: "GSM fleece" },
                  { n: "2.4k+", l: "5-star reviews" },
                  { n: "30-day", l: "returns" },
                ].map((s) => (
                  <div key={s.l}>
                    <p className="font-display text-3xl sm:text-4xl">{s.n}</p>
                    <p className="mt-1 text-xs uppercase tracking-widest text-bone/50">
                      {s.l}
                    </p>
                  </div>
                ))}
              </div>
              {brandStory.ctaText && (
                <Link
                  href={brandStory.ctaLink || "/shop"}
                  className="mt-10 inline-flex items-center gap-2 rounded-full bg-bone px-8 py-4 text-sm font-semibold uppercase tracking-widest text-ink transition-transform hover:scale-105"
                >
                  {brandStory.ctaText}
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              )}
            </div>
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl lg:aspect-auto lg:h-[560px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={brandStory.image}
                alt="Ruven Dept. studio"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </section>
      )}

      {/* NEW ARRIVALS */}
      {newArrivals.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-black/40">
                Fresh In
              </p>
              <h2 className="mt-2 font-display text-4xl uppercase tracking-tight sm:text-5xl">
                New arrivals
              </h2>
            </div>
            <Link
              href="/shop?filter=new"
              className="hidden shrink-0 items-center gap-1.5 text-sm font-semibold uppercase tracking-wide hover:opacity-60 sm:flex"
            >
              See all new <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
            {newArrivals.map((p, i) => (
              <ProductCard key={p.slug} product={p} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* VALUES */}
      <section className="border-t border-black/10 bg-brand-50">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-14 sm:px-6 lg:grid-cols-4 lg:px-8">
          {VALUES.map((v) => (
            <div key={v.title} className="flex flex-col gap-3">
              <v.icon className="h-7 w-7 text-ink" />
              <h3 className="text-sm font-semibold uppercase tracking-wide">
                {v.title}
              </h3>
              <p className="text-sm text-black/55">{v.copy}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
