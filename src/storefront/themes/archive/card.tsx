import Link from "next/link";
import { CardMedia } from "@/storefront/shared/card-media";
import type { CardProduct, Fmt, Tr } from "@/storefront/types";

/**
 * ARCHIVE card — a catalogued plate: cream matte frame, hairline border,
 * "No." accession chip, serif title and a ledger rule under the caption.
 */
export function ArchiveCard({
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
      className="archive-card group block animate-fade-up"
      style={{ animationDelay: `${Math.min(index, 8) * 65}ms` }}
    >
      {/* matte-framed plate */}
      <div className="relative border border-black/25 bg-brand-50 p-2.5">
        <div className="relative aspect-[3/4] overflow-hidden bg-brand-100">
          <CardMedia
            images={product.images}
            name={product.name}
            priority={priority}
            imgClassName="archive-img"
          />
          {/* accession chip */}
          <span className="absolute bottom-2 start-2 z-10 border border-black/30 bg-bone px-2 py-0.5 font-display text-[11px] italic tracking-wide text-brand-500">
            No. {String((index % 99) + 1).padStart(2, "0")}
          </span>
          {product.soldOut && (
            <span className="absolute end-2 top-2 z-10 bg-ink px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-bone">
              {tr("product.soldOut")}
            </span>
          )}
          {!product.soldOut && product.isNew && (
            <span className="absolute end-2 top-2 z-10 bg-amber px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-bone">
              {tr("product.new")}
            </span>
          )}
        </div>
      </div>

      {/* ledger caption */}
      <div className="mt-3 border-b border-black/15 px-0.5 pb-3">
        <p className="text-[10px] uppercase tracking-[0.3em] text-black/40">{product.category}</p>
        <h3 className="rd-card-title mt-1 font-display text-lg font-medium leading-snug">{product.name}</h3>
        <div className="mt-1.5 flex items-baseline justify-between">
          <span className="rd-price text-sm font-semibold tabular-nums">{fmt(product.price)}</span>
          {onSale ? (
            <span className="text-xs text-black/35 line-through tabular-nums">{fmt(product.compareAtPrice!)}</span>
          ) : (
            <span className="font-display text-xs italic text-black/40">
              {tr("product.colors", { count: product.colors.length })}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
