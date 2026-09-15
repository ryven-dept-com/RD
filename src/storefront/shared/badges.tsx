import type { CardProduct, Tr } from "../types";

/**
 * Shared card badges. Themes may re-skin them via CSS (squared for
 * brutalist, hairline for luxury) — the markup/semantics stay shared.
 */
export function CardBadges({ product, tr }: { product: CardProduct; tr: Tr }) {
  const onSale =
    product.compareAtPrice != null && product.compareAtPrice > product.price;
  return (
    <div className="rd-card-badges absolute start-3 top-3 z-10 flex flex-col items-start gap-1.5">
      {product.soldOut && (
        <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-ink shadow-sm">
          {tr("product.soldOut")}
        </span>
      )}
      {product.isNew && (
        <span className="rounded-full bg-ink px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-bone">
          {tr("product.new")}
        </span>
      )}
      {onSale && (
        <span className="rounded-full bg-amber px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-ink">
          {tr("product.sale")}
        </span>
      )}
      {product.bestSeller && !product.isNew && (
        <span className="rounded-full bg-bone px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-ink">
          {tr("product.bestSeller")}
        </span>
      )}
    </div>
  );
}
