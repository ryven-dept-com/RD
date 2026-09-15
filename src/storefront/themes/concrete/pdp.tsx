import Link from "next/link";
import { ProductGallery } from "@/app/(store)/products/[slug]/product-gallery";
import { ProductPurchase } from "@/app/(store)/products/[slug]/product-purchase";
import { CheckIcon, RefreshIcon, TruckIcon } from "@/components/icons";
import { StarRating } from "@/components/star-rating";
import { ProductReviews } from "@/storefront/shared/product-reviews";
import type { PdpProps } from "@/storefront/types";
import { ConcreteCard } from "./card";

/**
 * RAW CONCRETE product page — a technical spec sheet: numbered sections,
 * framed imagery, hard rule lines, squared controls.
 */
export function ConcretePdp({ data, tr, fmt }: PdpProps) {
  const { product, reviews, avgRating, reviewCount, related, badge, onSale, dist } = data;

  return (
    <div className="rd-pdp rd-pdp--technical rd-needs-offset bg-bone pt-16">
      {/* breadcrumb plate */}
      <div className="border-b-2 border-ink">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.25em] text-black/40">
            <Link href="/" className="hover:text-ink">{tr("shop.home")}</Link>
            <span className="text-amber">▪</span>
            <Link href={`/shop?category=${encodeURIComponent(product.category)}`} className="hover:text-ink">
              {product.category}
            </Link>
            <span className="text-amber">▪</span>
            <span className="truncate text-ink">{product.name}</span>
          </nav>
          <span className="hidden border-2 border-ink px-2 py-0.5 font-display text-[11px] font-bold tracking-[0.2em] sm:block">
            RD-{product.slug.slice(0, 4).toUpperCase()}
          </span>
        </div>
      </div>

      {/* main spec grid */}
      <div className="rd-pdp-grid mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:gap-14 lg:px-8">
        <div>
          <p className="mb-3 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.3em] text-black/40">
            <span className="border-2 border-ink px-1.5 py-0.5 font-display text-ink">01</span>
            {product.category}
          </p>
          <ProductGallery images={product.images} name={product.name} badge={badge} />
        </div>

        <div className="rd-pdp-info">
          <p className="rd-pdp-kicker text-[11px] font-bold uppercase tracking-[0.3em] text-black/40">
            {product.collection} · {product.category}
          </p>
          <h1 className="mt-3 font-display text-4xl uppercase leading-[0.95] tracking-tight sm:text-5xl">
            {product.name}
          </h1>
          <p className="mt-3 border-s-2 border-amber ps-3 text-sm text-black/60">{product.tagline}</p>

          {reviewCount > 0 && (
            <a href="#reviews" className="mt-4 inline-flex items-center gap-2 text-sm text-black/60 hover:text-ink">
              <StarRating rating={avgRating} size={16} />
              <span className="font-medium">{avgRating}</span>
              <span className="text-black/40">
                ({tr(reviewCount === 1 ? "product.reviewCountOne" : "product.reviewCountMany", { count: reviewCount })})
              </span>
            </a>
          )}

          {/* price rule */}
          <div className="mt-6 flex items-center justify-between border-y-2 border-ink py-4">
            <span className="font-display text-3xl">{fmt(product.price)}</span>
            {onSale && (
              <span className="flex items-center gap-2">
                <span className="text-lg text-black/35 line-through">{fmt(product.compareAtPrice!)}</span>
                <span className="border-2 border-amber px-2 py-0.5 text-xs font-bold uppercase tracking-wide">
                  {tr("product.save", { amount: fmt(product.compareAtPrice! - product.price) })}
                </span>
              </span>
            )}
          </div>

          <p className="mt-6 leading-relaxed text-black/70">{product.description}</p>

          <div className="mt-8">
            <p className="mb-3 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.3em] text-black/40">
              <span className="border-2 border-ink px-1.5 py-0.5 font-display text-ink">02</span>
              {product.collection}
            </p>
            <ProductPurchase
              productId={product.id}
              slug={product.slug}
              name={product.name}
              price={product.price}
              image={product.images[0] ?? ""}
              sizes={product.sizes}
              colors={product.colors}
              stock={product.stock}
              category={product.category}
              variants={data.variants}
            />
          </div>

          {/* logistics rule rows */}
          <div className="mt-9 border-2 border-ink">
            {[
              { icon: TruckIcon, label: tr("product.perkShipping", { amount: data.freeShipAmount }) },
              { icon: RefreshIcon, label: tr("home.usp2Title") },
              { icon: CheckIcon, label: tr("home.usp3Title") },
            ].map((perk, i) => (
              <div
                key={perk.label}
                className={`flex items-center gap-3 p-4 text-xs font-semibold ${i < 2 ? "border-b-2 border-ink" : ""}`}
              >
                <perk.icon className="h-4 w-4 shrink-0 text-amber" />
                {perk.label}
              </div>
            ))}
          </div>

          {/* details list */}
          {product.details.length > 0 && (
            <div className="mt-8">
              <p className="mb-3 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.3em] text-black/40">
                <span className="border-2 border-ink px-1.5 py-0.5 font-display text-ink">03</span>
                {tr("product.detailsTitle")}
              </p>
              <ul className="border-t-2 border-ink">
                {product.details.map((d, i) => (
                  <li key={d} className={`flex items-start gap-3 py-2.5 text-sm text-black/70 ${i < product.details.length - 1 ? "border-b border-black/10" : ""}`}>
                    <span className="font-display text-xs font-bold text-black/40">{String(i + 1).padStart(2, "0")}</span>
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* REVIEWS */}
      <ProductReviews
        productId={product.id}
        reviews={reviews}
        avgRating={avgRating}
        reviewCount={reviewCount}
        dist={dist}
        locale={data.locale}
        tr={tr}
        className="border-t-2 border-ink bg-brand-50 py-16"
      />

      {/* RELATED */}
      {related.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-end justify-between border-b-2 border-ink pb-4">
            <h2 className="font-display text-3xl uppercase tracking-tight sm:text-4xl">{tr("product.relatedTitle")}</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {related.map((p, i) => (
              <ConcreteCard key={p.slug} product={p} tr={tr} fmt={fmt} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
