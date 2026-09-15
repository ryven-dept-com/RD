import Link from "next/link";
import { ProductGallery } from "@/app/(store)/products/[slug]/product-gallery";
import { ProductPurchase } from "@/app/(store)/products/[slug]/product-purchase";
import { CheckIcon, RefreshIcon, TruckIcon } from "@/components/icons";
import { StarRating } from "@/components/star-rating";
import { ProductReviews } from "@/storefront/shared/product-reviews";
import type { PdpProps } from "@/storefront/types";
import { NightshiftCard } from "./card";

/**
 * NIGHT SHIFT product page — technical readout: glowing kicker, luminous
 * gallery frame, sticky purchase column, atmosphere kept premium.
 */
export function NightshiftPdp({ data, tr, fmt }: PdpProps) {
  const { product, reviews, avgRating, reviewCount, related, badge, onSale, dist } = data;

  return (
    <div className="rd-pdp rd-pdp--immersive rd-needs-offset bg-bone pt-16">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <nav className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-brand-400">
          <Link href="/" className="hover:text-ink">{tr("shop.home")}</Link>
          <span className="text-amber">◦</span>
          <Link href={`/shop?category=${encodeURIComponent(product.category)}`} className="hover:text-ink">
            {product.category}
          </Link>
          <span className="text-amber">◦</span>
          <span className="truncate text-ink">{product.name}</span>
        </nav>
      </div>

      <div className="rd-pdp-grid mx-auto grid max-w-7xl gap-10 px-4 pb-16 sm:px-6 lg:grid-cols-2 lg:gap-14 lg:px-8">
        <ProductGallery images={product.images} name={product.name} badge={badge} />

        <div className="rd-pdp-info lg:py-2">
          <p className="rd-pdp-kicker flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-black/40">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber" aria-hidden />
            {product.collection} · {product.category}
          </p>
          <h1 className="mt-3 font-display text-4xl uppercase leading-[0.95] tracking-tight sm:text-5xl">
            {product.name}
          </h1>
          <p className="mt-3 text-black/60">{product.tagline}</p>

          {reviewCount > 0 && (
            <a href="#reviews" className="mt-4 inline-flex items-center gap-2 text-sm text-black/60 hover:text-ink">
              <StarRating rating={avgRating} size={16} />
              <span className="font-medium">{avgRating}</span>
              <span className="text-black/40">
                ({tr(reviewCount === 1 ? "product.reviewCountOne" : "product.reviewCountMany", { count: reviewCount })})
              </span>
            </a>
          )}

          <div className="mt-6 flex items-center gap-3">
            <span className="font-display text-3xl">{fmt(product.price)}</span>
            {onSale && (
              <>
                <span className="text-lg text-black/35 line-through">{fmt(product.compareAtPrice!)}</span>
                <span className="rounded-full bg-amber/20 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-amber-800">
                  {tr("product.save", { amount: fmt(product.compareAtPrice! - product.price) })}
                </span>
              </>
            )}
          </div>

          <p className="mt-6 leading-relaxed text-black/70">{product.description}</p>

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

          <div className="mt-9 grid grid-cols-1 gap-3 rounded-lg border border-brand-100 bg-brand-50 p-5 sm:grid-cols-3">
            {[
              { icon: TruckIcon, label: tr("product.perkShipping", { amount: data.freeShipAmount }) },
              { icon: RefreshIcon, label: tr("home.usp2Title") },
              { icon: CheckIcon, label: tr("home.usp3Title") },
            ].map((perk) => (
              <div key={perk.label} className="flex items-center gap-2.5 text-xs text-black/70">
                <perk.icon className="h-4 w-4 shrink-0 text-amber" />
                {perk.label}
              </div>
            ))}
          </div>

          {product.details.length > 0 && (
            <div className="mt-9">
              <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-black/40">
                <span className="h-1 w-4 bg-amber" aria-hidden />
                {tr("product.detailsTitle")}
              </h2>
              <ul className="mt-3 space-y-2">
                {product.details.map((d) => (
                  <li key={d} className="flex items-start gap-2.5 text-sm text-black/70">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber" />
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <ProductReviews
        productId={product.id}
        reviews={reviews}
        avgRating={avgRating}
        reviewCount={reviewCount}
        dist={dist}
        locale={data.locale}
        tr={tr}
        className="border-t border-brand-100 bg-brand-50 py-16"
      />

      {related.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl uppercase tracking-tight sm:text-4xl">
            {tr("product.relatedTitle")}
          </h2>
          <div className="no-scrollbar mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
            {related.map((p, i) => (
              <div key={p.slug} className="w-[60vw] shrink-0 snap-start sm:w-[30vw] lg:w-[23vw]">
                <NightshiftCard product={p} tr={tr} fmt={fmt} index={i} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
