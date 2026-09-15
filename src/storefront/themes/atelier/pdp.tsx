import Link from "next/link";
import { ProductGallery } from "@/app/(store)/products/[slug]/product-gallery";
import { ProductPurchase } from "@/app/(store)/products/[slug]/product-purchase";
import { CheckIcon, RefreshIcon, TruckIcon } from "@/components/icons";
import { StarRating } from "@/components/star-rating";
import { ProductReviews } from "@/storefront/shared/product-reviews";
import type { PdpProps } from "@/storefront/types";
import { AtelierCard } from "./card";

/**
 * ATELIER product page — the editorial spread: a sticky lookbook gallery
 * beside a hairline-ruled info column. Pill controls, tabular price line,
 * quiet perk rows. Same purchase machinery underneath every storefront.
 */
export function AtelierPdp({ data, tr, fmt }: PdpProps) {
  const { product, reviews, avgRating, reviewCount, related, badge, onSale, dist } = data;

  return (
    <div className="rd-pdp rd-pdp--lookbook rd-needs-offset bg-bone pt-16">
      {/* breadcrumb hairline */}
      <div className="border-b border-black/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6 lg:px-8">
          <nav className="flex min-w-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-400">
            <Link href="/" className="transition-colors hover:text-ink">{tr("shop.home")}</Link>
            <span aria-hidden>/</span>
            <Link href={`/shop?category=${encodeURIComponent(product.category)}`} className="transition-colors hover:text-ink">
              {product.category}
            </Link>
            <span aria-hidden>/</span>
            <span className="truncate text-ink">{product.name}</span>
          </nav>
          <span className="hidden shrink-0 text-[11px] font-semibold uppercase tracking-[0.25em] text-brand-400 tabular-nums sm:block">
            Nº {String(product.id).padStart(3, "0")}
          </span>
        </div>
      </div>

      {/* editorial spread */}
      <div className="rd-pdp-grid mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-14">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <ProductGallery images={product.images} name={product.name} badge={badge} />
        </div>

        <div className="rd-pdp-info">
          <p className="rd-pdp-kicker text-[11px] font-semibold uppercase tracking-[0.3em] text-amber">
            {product.collection} · {product.category}
          </p>
          <h1 className="mt-3 font-display uppercase leading-[1.04] tracking-tight">
            {product.name}
            <span className="at-dot" aria-hidden>.</span>
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-brand-500">{product.tagline}</p>

          {reviewCount > 0 && (
            <a href="#reviews" className="mt-4 inline-flex items-center gap-2 text-sm text-brand-500 transition-colors hover:text-ink">
              <StarRating rating={avgRating} size={16} />
              <span className="font-medium tabular-nums">{avgRating}</span>
              <span className="text-brand-400">
                ({tr(reviewCount === 1 ? "product.reviewCountOne" : "product.reviewCountMany", { count: reviewCount })})
              </span>
            </a>
          )}

          {/* price line */}
          <div className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-y border-black/10 py-5">
            <span className="font-display text-3xl tabular-nums text-ink sm:text-4xl">
              {fmt(product.price)}
            </span>
            {onSale && (
              <>
                <s className="text-lg text-brand-400 tabular-nums">{fmt(product.compareAtPrice!)}</s>
                <span className="rounded-full bg-amber px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-bone">
                  {tr("product.save", { amount: fmt(product.compareAtPrice! - product.price) })}
                </span>
              </>
            )}
          </div>

          <p className="mt-6 leading-relaxed text-brand-500">{product.description}</p>

          <div className="mt-8">
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

          {/* quiet perk rows */}
          <div className="mt-9 divide-y divide-black/10 border-y border-black/10">
            {[
              { icon: TruckIcon, label: tr("product.perkShipping", { amount: data.freeShipAmount }) },
              { icon: RefreshIcon, label: tr("home.usp2Title") },
              { icon: CheckIcon, label: tr("home.usp3Title") },
            ].map((perk) => (
              <div key={perk.label} className="flex items-center gap-3 py-3.5 text-[13px] font-medium text-brand-500">
                <perk.icon className="h-4 w-4 shrink-0 text-amber" />
                {perk.label}
              </div>
            ))}
          </div>

          {/* details */}
          {product.details.length > 0 && (
            <div className="mt-8">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-brand-400">
                {tr("product.detailsTitle")}
              </p>
              <ul className="border-t border-black/10">
                {product.details.map((d, i) => (
                  <li
                    key={d}
                    className={`flex items-start gap-3 py-3 text-sm leading-relaxed text-brand-500 ${i < product.details.length - 1 ? "border-b border-black/10" : ""}`}
                  >
                    <span className="mt-0.5 text-[10px] font-semibold tracking-[0.2em] text-amber tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
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
        className="border-t border-black/10 bg-brand-50 py-16"
      />

      {/* RELATED — the rail */}
      {related.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
          <div className="mb-8 flex items-end justify-between gap-4 border-b border-black/10 pb-5">
            <h2 className="font-display text-2xl uppercase tracking-tight sm:text-4xl">
              {tr("product.relatedTitle")}
              <span className="at-dot" aria-hidden>.</span>
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-5 md:grid-cols-4">
            {related.map((p, i) => (
              <AtelierCard key={p.slug} product={p} tr={tr} fmt={fmt} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
