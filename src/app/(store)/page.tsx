import Link from "next/link";
import { getFeaturedProducts, getNewProducts } from "@/lib/queries";
import { ProductCard } from "@/components/product-card";
import {
  ArrowRightIcon,
  RefreshIcon,
  ShieldIcon,
  StarBadgeIcon,
  TruckIcon,
} from "@/components/icons";

export const dynamic = "force-dynamic";

const COLLECTIONS = [
  {
    name: "Vault 01",
    tag: "Core Blacks",
    copy: "Heavyweight everyday armor.",
    href: "/shop?collection=Vault+01",
    image: "/images/collection-vault.jpg",
    span: "lg:col-span-2 lg:row-span-2",
    tall: true,
  },
  {
    name: "Terrain",
    tag: "Utility Outerwear",
    copy: "Built for the elements.",
    href: "/shop?collection=Terrain",
    image:
      "https://images.pexels.com/photos/7880141/pexels-photo-7880141.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=700",
    span: "",
    tall: false,
  },
  {
    name: "Static",
    tag: "Graphic Capsule",
    copy: "Statement prints, faded finish.",
    href: "/shop?collection=Static",
    image:
      "https://images.pexels.com/photos/33222517/pexels-photo-33222517.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=700",
    span: "",
    tall: false,
  },
];

const MARQUEE = [
  "FREE SHIPPING OVER $150",
  "480 GSM HEAVYWEIGHT FLEECE",
  "30-DAY RETURNS",
  "DESIGNED IN-HOUSE",
  "NEW DROP — TERRAIN COLLECTION",
  "10% OFF YOUR FIRST ORDER",
];

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

export default async function HomePage() {
  const [featured, newArrivals] = await Promise.all([
    getFeaturedProducts(8),
    getNewProducts(4),
  ]);

  return (
    <>
      {/* HERO */}
      <section className="relative flex min-h-[100svh] items-end overflow-hidden bg-ink text-bone">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/hero.jpg"
          alt="Ruven Dept. streetwear campaign"
          className="absolute inset-0 h-full w-full object-cover object-center animate-fade-in"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-ink/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/60 to-transparent" />

        <div className="relative mx-auto w-full max-w-7xl px-4 pb-16 pt-28 sm:px-6 lg:px-8 lg:pb-24">
          <p className="animate-fade-up text-xs font-semibold uppercase tracking-[0.3em] text-bone/70 delay-100">
            Fall / Winter — Vol. 01
          </p>
          <h1 className="animate-fade-up delay-200 mt-4 max-w-4xl font-display text-6xl uppercase leading-[0.9] tracking-tight sm:text-7xl lg:text-8xl">
            Weight you
            <br />
            can feel.
          </h1>
          <p className="animate-fade-up delay-300 mt-6 max-w-md text-base leading-relaxed text-bone/70">
            Heavyweight essentials and utility outerwear, engineered in-house and
            built for the street. No logos shouting — just fabric that speaks.
          </p>
          <div className="animate-fade-up delay-400 mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/shop"
              className="group flex items-center gap-2 rounded-full bg-bone px-8 py-4 text-sm font-semibold uppercase tracking-widest text-ink transition-transform hover:scale-105"
            >
              Shop the drop
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/shop?collection=Terrain"
              className="rounded-full border border-bone/40 px-8 py-4 text-sm font-semibold uppercase tracking-widest text-bone transition-colors hover:bg-bone/10"
            >
              Terrain Collection
            </Link>
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <section className="border-y border-ink/10 bg-ink py-3 text-bone">
        <div className="relative flex overflow-hidden">
          <div className="animate-marquee flex shrink-0 items-center gap-8 whitespace-nowrap pr-8">
            {[...MARQUEE, ...MARQUEE].map((m, i) => (
              <span
                key={i}
                className="flex items-center gap-8 text-xs font-semibold uppercase tracking-[0.2em]"
              >
                {m}
                <span className="text-amber">✦</span>
              </span>
            ))}
          </div>
        </div>
      </section>

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
          {COLLECTIONS.map((c) => (
            <Link
              key={c.name}
              href={c.href}
              className={`group relative overflow-hidden rounded-2xl bg-ink ${c.span}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.image}
                alt={c.name}
                className="img-zoom absolute inset-0 h-full w-full object-cover opacity-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-bone">
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-bone/70">
                  {c.tag}
                </p>
                <h3
                  className={`mt-1 font-display uppercase tracking-tight ${
                    c.tall ? "text-4xl sm:text-5xl" : "text-2xl"
                  }`}
                >
                  {c.name}
                </h3>
                <p className="mt-1 text-sm text-bone/70">{c.copy}</p>
                <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest">
                  Explore
                  <ArrowRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
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
      <section className="relative overflow-hidden bg-ink text-bone">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-28">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-bone/50">
              The Ruven Ethos
            </p>
            <h2 className="mt-3 font-display text-4xl uppercase leading-tight tracking-tight sm:text-5xl">
              We obsess over grams,
              <br />
              stitches, and drape.
            </h2>
            <p className="mt-6 max-w-lg text-bone/70">
              Ruven Dept. started in a small studio with a simple frustration:
              streetwear that looked the part but fell apart. So we went the
              other way — heavier fabrics, reinforced seams, and cuts refined
              over dozens of samples. Every piece is a tool you&apos;ll reach for
              on repeat.
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
            <Link
              href="/shop"
              className="mt-10 inline-flex items-center gap-2 rounded-full bg-bone px-8 py-4 text-sm font-semibold uppercase tracking-widest text-ink transition-transform hover:scale-105"
            >
              Explore the range
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl lg:aspect-auto lg:h-[560px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.pexels.com/photos/30410057/pexels-photo-30410057.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=900"
              alt="Ruven Dept. studio"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </section>

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
