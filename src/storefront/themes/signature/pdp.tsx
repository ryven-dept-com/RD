import Link from "next/link";
import { ProductGallery } from "@/app/(store)/products/[slug]/product-gallery";
import { ProductPurchase } from "@/app/(store)/products/[slug]/product-purchase";
import { CheckIcon, RefreshIcon, TruckIcon } from "@/components/icons";
import { StarRating } from "@/components/star-rating";
import { ProductReviews } from "@/storefront/shared/product-reviews";
import type { PdpProps } from "@/storefront/types";
import { SignatureCard } from "./card";

/**
 * SIGNATURE product page — the gallery wall: imagery first at full width,
 * a centered narrow column for the record below, hairlines and air.
 */
export function SignaturePdp({ data, tr, fmt }: PdpProps) {
  const { product, reviews, avgRating, reviewCount, related, badge, onSale, dist } = data;

  return (
    <div className="rd-pdp rd-pdp--luxury rd-needs-offset bg-bone pt-16">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <nav className="flex items-center justify-center gap-3 text-[11px] uppercase tracking-[0.35em] text-black/40">
          <Link href="/" className="hover:text-ink">{tr("shop.home")}</Link>
          <span aria-hidden>—</span>
          <Link href={`/shop?category=${encodeURIComponent(product.category)}`} className="hover:text-ink">
            {product.category}
          </Link>
          <span aria-hidden>—</span>
          <span className="truncate text-ink">{product.name}</span>
        </nav>
      </div>

      <div className="rd-pdp-grid mx-auto grid max-w-7xl gap-14 px-4 pb-24 sm:px-6 lg:grid-cols-2 lg:gap-20 lg:px-8">
        <ProductGallery images={product.images} name={product.name} badge={badge} />

        <div className="rd-pdp-info">
          <p className="rd-pdp-kicker text-[11px] font-medium uppercase tracking-[0.5em] text-black/40">
            {product.collection} · {product.category}
          </p>
          <h1 className="mt-4 font-display text-4xl font-normal leading-[1.05] tracking-tight sm:text-5xl">
            {product.name}
          </h1>
          <p className="mt-3 text-black/55">{product.tagline}</p>

          {reviewCount > 0 && (
            <a href="#reviews" className="mt-4 inline-flex items-center gap-2 text-sm text-black/55 hover:text-ink">
              <StarRating rating={avgRating} size={16} />
              <span className="font-medium">{avgRating}</span>
              <span className="text-black/40">
                ({tr(reviewCount === 1 ? "product.reviewCountOne" : "product.reviewCountMany", { count: reviewCount })})
              </span>
            </a>
          )}

          <div className="mt-7 flex items-baseline gap-3 border-y border-black/10 py-5">
            <span className="font-display text-3xl">{fmt(product.price)}</span>
            {onSale && (
              <>
                <span className="text-lg text-black/35 line-through">{fmt(product.compareAtPrice!)}</span>
                <span className="text-xs font-medium uppercase tracking-[0.2em] text-black/50">
                  {tr("product.save", { amount: fmt(product.compareAtPrice! - product.price) })}
                </span>
              </>
            )}
          </div>

          <p className="mt-7 leading-relaxed text-black/65">{product.description}</p>

          <div className="mt-9">
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

          {/* perks — hairline list */}
          <ul className="mt-10 border-t border-black/10">
            {[
              { icon: TruckIcon, label: tr("product.perkShipping", { amount: data.freeShipAmount }) },
              { icon: RefreshIcon, label: tr("home.usp2Title") },
              { icon: CheckIcon, label: tr("home.usp3Title") },
            ].map((perk) => (
              <li key={perk.label} className="flex items-center gap-3 border-b border-black/10 py-3.5 text-xs text-black/60">
                <perk.icon className="h-4 w-4 shrink-0 text-black/45" />
                {perk.label}
              </li>
            ))}
          </ul>

          {product.details.length > 0 && (
            <div className="mt-10">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.4em] text-black/40">
                {tr("product.detailsTitle")}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {product.details.map((d) => (
                  <li key={d} className="flex items-start gap-3 text-sm text-black/60">
                    <span className="mt-2 h-px w-4 shrink-0 bg-black/30" aria-hidden />
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
        className="border-t border-black/10 py-20"
      />

      {related.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <p className="text-center text-[11px] font-medium uppercase tracking-[0.5em] text-black/40">
            {tr("product.relatedTitle")}
          </p>
          <div className="mt-14 grid grid-cols-2 gap-x-6 gap-y-16 md:grid-cols-4">
            {related.map((p, i) => (
              <SignatureCard key={p.slug} product={p} tr={tr} fmt={fmt} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
