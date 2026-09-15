import Link from "next/link";
import { ProductGallery } from "@/app/(store)/products/[slug]/product-gallery";
import { ProductPurchase } from "@/app/(store)/products/[slug]/product-purchase";
import { CheckIcon, RefreshIcon, TruckIcon } from "@/components/icons";
import { StarRating } from "@/components/star-rating";
import { ProductReviews } from "@/storefront/shared/product-reviews";
import type { PdpProps } from "@/storefront/types";
import { SeventhCard } from "./card";

/**
 * BLOCK SEVEN product page — the drop sheet: poster breadcrumb strip,
 * hard-framed gallery with offset shadow, sticker price plate, stamped
 * logistics rows. Same purchase machinery underneath.
 */
export function SeventhPdp({ data, tr, fmt }: PdpProps) {
  const { product, reviews, avgRating, reviewCount, related, badge, onSale, dist } = data;

  return (
    <div className="rd-pdp rd-pdp--drop rd-needs-offset bg-bone pt-16">
      {/* breadcrumb strip */}
      <div className="border-b-[3px] border-ink bg-brand-100/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <nav className="flex min-w-0 items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] text-brand-400">
            <Link href="/" className="hover:text-ink">{tr("shop.home")}</Link>
            <span className="text-amber" aria-hidden>▮</span>
            <Link href={`/shop?category=${encodeURIComponent(product.category)}`} className="hover:text-ink">
              {product.category}
            </Link>
            <span className="text-amber" aria-hidden>▮</span>
            <span className="truncate text-ink">{product.name}</span>
          </nav>
          <span className="hidden shrink-0 bg-ink px-2.5 py-1 font-display text-[11px] uppercase tracking-[0.15em] text-bone sm:block">
            BLK·{String(product.id).padStart(3, "0")}
          </span>
        </div>
      </div>

      {/* main drop grid */}
      <div className="rd-pdp-grid mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:gap-14 lg:px-8">
        <div>
          <ProductGallery images={product.images} name={product.name} badge={badge} />
        </div>

        <div className="rd-pdp-info">
          <p className="rd-pdp-kicker text-[11px] font-bold uppercase tracking-[0.25em]">
            {product.collection} · {product.category}
          </p>
          <h1 className="mt-3 font-display uppercase leading-[0.98] tracking-tight">
            {product.name}
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-brand-500">{product.tagline}</p>

          {reviewCount > 0 && (
            <a href="#reviews" className="mt-4 inline-flex items-center gap-2 text-sm text-brand-500 hover:text-ink">
              <StarRating rating={avgRating} size={16} />
              <span className="font-medium">{avgRating}</span>
              <span className="text-brand-400">
                ({tr(reviewCount === 1 ? "product.reviewCountOne" : "product.reviewCountMany", { count: reviewCount })})
              </span>
            </a>
          )}

          {/* sticker price plate */}
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <span className="sb-sticker bg-amber px-4 py-2 font-display text-2xl text-bone">
              {fmt(product.price)}
            </span>
            {onSale && (
              <span className="flex items-center gap-2">
                <span className="text-lg text-brand-400 line-through">{fmt(product.compareAtPrice!)}</span>
                <span className="border-2 border-ink bg-olive px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-ink">
                  {tr("product.save", { amount: fmt(product.compareAtPrice! - product.price) })}
                </span>
              </span>
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

          {/* stamped logistics rows */}
          <div className="mt-9 border-[3px] border-ink bg-brand-50">
            {[
              { icon: TruckIcon, label: tr("product.perkShipping", { amount: data.freeShipAmount }) },
              { icon: RefreshIcon, label: tr("home.usp2Title") },
              { icon: CheckIcon, label: tr("home.usp3Title") },
            ].map((perk, i) => (
              <div
                key={perk.label}
                className={`flex items-center gap-3 px-4 py-3.5 text-xs font-bold uppercase tracking-wide ${i < 2 ? "border-b-2 border-ink" : ""}`}
              >
                <perk.icon className="h-4 w-4 shrink-0 text-amber" />
                {perk.label}
              </div>
            ))}
          </div>

          {/* details */}
          {product.details.length > 0 && (
            <div className="mt-8">
              <p className="mb-3 font-display text-sm uppercase tracking-tight text-ink">
                {tr("product.detailsTitle")}
              </p>
              <ul className="border-t-2 border-ink">
                {product.details.map((d, i) => (
                  <li key={d} className={`flex items-start gap-3 py-2.5 text-sm text-brand-500 ${i < product.details.length - 1 ? "border-b border-black/10" : ""}`}>
                    <span className="bg-ink px-1.5 font-display text-[10px] leading-5 text-bone">{String(i + 1).padStart(2, "0")}</span>
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
        className="border-t-[3px] border-ink bg-brand-100/60 py-16"
      />

      {/* RELATED WALL */}
      {related.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-end justify-between border-b-[3px] border-ink pb-4">
            <h2 className="font-display text-3xl uppercase tracking-tight sm:text-4xl">{tr("product.relatedTitle")}</h2>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
            {related.map((p, i) => (
              <SeventhCard key={p.slug} product={p} tr={tr} fmt={fmt} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
