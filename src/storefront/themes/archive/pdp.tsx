import Link from "next/link";
import { ProductGallery } from "@/app/(store)/products/[slug]/product-gallery";
import { ProductPurchase } from "@/app/(store)/products/[slug]/product-purchase";
import { CheckIcon, RefreshIcon, TruckIcon } from "@/components/icons";
import { StarRating } from "@/components/star-rating";
import { ProductReviews } from "@/storefront/shared/product-reviews";
import type { PdpProps } from "@/storefront/types";
import { ArchiveCard } from "./card";

/**
 * ARCHIVE product page — the catalog entry: framed plate on the left, an
 * accession-style record on the right (ruled reference rows, serif title),
 * related pieces as "see also".
 */
export function ArchivePdp({ data, tr, fmt }: PdpProps) {
  const { product, reviews, avgRating, reviewCount, related, badge, onSale, dist } = data;

  return (
    <div className="rd-pdp rd-pdp--catalog rd-needs-offset bg-bone pt-16">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <nav className="flex items-center gap-2 font-display text-xs italic tracking-[0.2em] text-black/40">
          <Link href="/" className="hover:text-ink">{tr("shop.home")}</Link>
          <span className="text-amber">❦</span>
          <Link href={`/shop?category=${encodeURIComponent(product.category)}`} className="hover:text-ink">
            {product.category}
          </Link>
          <span className="text-amber">❦</span>
          <span className="truncate text-ink">{product.name}</span>
        </nav>
      </div>

      <div className="rd-pdp-grid mx-auto grid max-w-7xl gap-10 px-4 pb-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
        <ProductGallery images={product.images} name={product.name} badge={badge} />

        <div className="rd-pdp-info lg:py-2">
          {/* accession record */}
          <div className="border-b border-black/20 pb-4">
            <p className="rd-pdp-kicker font-display text-xs italic tracking-[0.25em] text-amber">
              {product.collection} · {product.category}
            </p>
            <h1 className="mt-3 font-display text-4xl font-medium leading-tight tracking-tight sm:text-5xl">
              {product.name}
            </h1>
            <p className="mt-2 font-display italic text-black/50">{product.tagline}</p>
          </div>

          {reviewCount > 0 && (
            <a href="#reviews" className="mt-4 inline-flex items-center gap-2 text-sm text-black/60 hover:text-ink">
              <StarRating rating={avgRating} size={16} />
              <span className="font-medium">{avgRating}</span>
              <span className="text-black/40">
                ({tr(reviewCount === 1 ? "product.reviewCountOne" : "product.reviewCountMany", { count: reviewCount })})
              </span>
            </a>
          )}

          {/* price row */}
          <div className="mt-5 flex items-baseline justify-between border-b border-black/20 pb-4">
            <span className="font-display text-3xl">{fmt(product.price)}</span>
            {onSale && (
              <span className="flex items-center gap-2">
                <span className="text-lg text-black/35 line-through">{fmt(product.compareAtPrice!)}</span>
                <span className="rounded-full bg-amber/20 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-amber-800">
                  {tr("product.save", { amount: fmt(product.compareAtPrice! - product.price) })}
                </span>
              </span>
            )}
          </div>

          <p className="mt-6 leading-relaxed text-black/70">{product.description}</p>

          <div className="mt-7">
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

          {/* perks — colophon style */}
          <div className="mt-8 grid grid-cols-1 gap-3 border-y border-black/15 bg-brand-50 p-5 sm:grid-cols-3">
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

          {/* details — numbered entries */}
          {product.details.length > 0 && (
            <div className="mt-8">
              <h2 className="font-display text-xs italic tracking-[0.25em] text-amber">
                {tr("product.detailsTitle")}
              </h2>
              <ul className="mt-3 space-y-2">
                {product.details.map((d, i) => (
                  <li key={d} className="flex items-start gap-3 border-b border-black/10 pb-2 text-sm text-black/70">
                    <span className="font-display text-xs italic text-black/40">{String(i + 1).padStart(2, "0")}</span>
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
        className="border-t border-black/15 bg-brand-50 py-16"
      />

      {/* SEE ALSO */}
      {related.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between border-b-2 border-ink pb-4">
            <h2 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">{tr("product.relatedTitle")}</h2>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-4">
            {related.map((p, i) => (
              <ArchiveCard key={p.slug} product={p} tr={tr} fmt={fmt} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
