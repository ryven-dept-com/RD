import Link from "next/link";
import { StarRating } from "@/components/star-rating";
import { CardBadges } from "@/storefront/shared/badges";
import { CardMedia } from "@/storefront/shared/card-media";
import type { CardProduct, Fmt, Tr } from "@/storefront/types";

/**
 * DISTRICT card — the house classic: rounded frame, hover image swap,
 * captioned grid card. Balanced fashion-commerce UX.
 */
export function DistrictCard({
  product,
  tr,
  fmt,
  index = 0,
  priority = false,
}: {
  product: CardProduct;
  tr: Tr;
  fmt: Fmt;
  index?: number;
  priority?: boolean;
}) {
  const onSale =
    product.compareAtPrice != null && product.compareAtPrice > product.price;

  return (
    <Link
      href={`/products/${product.slug}`}
      className="rd-card group block animate-fade-up"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <div className="rd-card-img rd-card-frame relative aspect-[3/4] overflow-hidden rounded-xl bg-brand-100">
        <CardMedia images={product.images} name={product.name} priority={priority} />
        <CardBadges product={product} tr={tr} />
        {/* quick view hint (pointer devices) */}
        <div className="absolute inset-x-3 bottom-3 translate-y-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <span className="flex w-full items-center justify-center rounded-full bg-bone/95 py-2.5 text-xs font-semibold uppercase tracking-widest text-ink backdrop-blur">
            {tr("product.viewProduct")}
          </span>
        </div>
      </div>

      <div className="rd-card-meta mt-3 px-0.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-black/40">{product.category}</p>
          {product.reviewCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-black/40">
              <StarRating rating={product.avgRating} size={11} />
              <span className="tabular-nums">({product.reviewCount})</span>
            </span>
          )}
        </div>
        <h3 className="rd-card-title mt-1 text-sm font-semibold leading-snug text-ink">{product.name}</h3>
        <div className="mt-1 flex items-center gap-2">
          <span className="rd-price text-sm font-semibold tabular-nums">{fmt(product.price)}</span>
          {onSale && (
            <span className="text-xs text-black/35 line-through tabular-nums">
              {fmt(product.compareAtPrice!)}
            </span>
          )}
          {product.colors.length > 1 && (
            <span className="ms-auto text-[11px] text-black/40">
              {tr("product.colors", { count: product.colors.length })}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
