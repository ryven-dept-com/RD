import Link from "next/link";
import { CardMedia } from "@/storefront/shared/card-media";
import type { CardProduct, Fmt, Tr } from "@/storefront/types";

/**
 * RAW CONCRETE card — industrial unit: hard 2px frame, squared corners,
 * corner index plate, grayscale stock that regains colour under a pointer,
 * spec-sheet caption (category code + weight-like price line).
 */
export function ConcreteCard({
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
      className="concrete-card group block animate-fade-up border-2 border-ink bg-bone"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      {/* image bay */}
      <div className="rd-card-frame relative aspect-[3/4] overflow-hidden border-b-2 border-ink bg-brand-100">
        <CardMedia
          images={product.images}
          name={product.name}
          priority={priority}
          imgClassName="concrete-img"
        />
        {/* index plate */}
        <span
          className="absolute end-0 top-0 z-10 border-s-2 border-b-2 border-ink bg-bone px-2 py-1 font-display text-xs font-bold tracking-[0.15em]"
          aria-hidden="true"
        >
          {String((index % 99) + 1).padStart(2, "0")}
        </span>
        {product.soldOut && (
          <span className="absolute start-0 top-0 z-10 border-e-2 border-b-2 border-ink bg-ink px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-bone">
            {tr("product.soldOut")}
          </span>
        )}
        {!product.soldOut && product.isNew && (
          <span className="absolute start-0 top-0 z-10 border-e-2 border-b-2 border-ink bg-amber px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-ink">
            {tr("product.new")}
          </span>
        )}
        {!product.soldOut && !product.isNew && onSale && (
          <span className="absolute start-0 top-0 z-10 border-e-2 border-b-2 border-ink bg-amber px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-ink">
            {tr("product.sale")}
          </span>
        )}
      </div>

      {/* spec caption */}
      <div className="p-3.5">
        <div className="flex items-baseline justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-400">
          <span className="truncate">{product.category}</span>
          <span className="shrink-0" aria-hidden>RD-{product.slug.slice(0, 4).toUpperCase()}</span>
        </div>
        <h3 className="rd-card-title mt-1.5 font-display text-base uppercase leading-tight tracking-tight">
          {product.name}
        </h3>
        <div className="mt-2.5 flex items-center justify-between border-t-2 border-ink pt-2.5">
          <span className="rd-price text-sm font-bold tabular-nums">{fmt(product.price)}</span>
          {onSale ? (
            <span className="text-xs tabular-nums text-brand-400 line-through">
              {fmt(product.compareAtPrice!)}
            </span>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-400">
              {tr("product.colors", { count: product.colors.length })}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
