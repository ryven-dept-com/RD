import Link from "next/link";
import { CardBadges } from "@/storefront/shared/badges";
import { CardMedia } from "@/storefront/shared/card-media";
import type { CardProduct, Fmt, Tr } from "@/storefront/types";

/**
 * NIGHT SHIFT card — a dark display stage: corner ticks, a technical label
 * line and a controlled glow that answers the pointer. Fashion-first, not
 * arcade.
 */
export function NightshiftCard({
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
      className="ns-card group block animate-fade-up"
      style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}
    >
      <div className="ns-card-frame relative aspect-[3/4] overflow-hidden rounded-lg border border-brand-100 bg-brand-50 transition-all duration-500">
        <CardMedia images={product.images} name={product.name} priority={priority} />
        <CardBadges product={product} tr={tr} />
        {/* corner ticks */}
        <span className="ns-tick pointer-events-none absolute start-2 top-2 h-3 w-3 border-s border-t border-bone/50 opacity-0 transition-opacity duration-500 group-hover:opacity-100" aria-hidden />
        <span className="ns-tick pointer-events-none absolute end-2 top-2 h-3 w-3 border-e border-t border-bone/50 opacity-0 transition-opacity duration-500 group-hover:opacity-100" aria-hidden />
        <span className="ns-tick pointer-events-none absolute bottom-2 start-2 h-3 w-3 border-b border-s border-bone/50 opacity-0 transition-opacity duration-500 group-hover:opacity-100" aria-hidden />
        <span className="ns-tick pointer-events-none absolute bottom-2 end-2 h-3 w-3 border-b border-e border-bone/50 opacity-0 transition-opacity duration-500 group-hover:opacity-100" aria-hidden />
        {/* floating price chip */}
        <div className="absolute inset-x-3 bottom-3 translate-y-3 opacity-0 transition-all duration-400 group-hover:translate-y-0 group-hover:opacity-100">
          <span className="flex w-full items-center justify-center gap-2 rounded-md border border-brand-100 bg-bone/95 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-ink backdrop-blur">
            {tr("product.viewProduct")}
          </span>
        </div>
      </div>

      <div className="mt-3 px-0.5">
        {/* technical label line */}
        <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-brand-400">
          <span className="truncate">{product.category}</span>
          <span className="ns-dot flex items-center gap-1.5" aria-hidden>
            <span className="h-1 w-1 rounded-full bg-amber" />
            NS-{String((index % 99) + 1).padStart(2, "0")}
          </span>
        </div>
        <h3 className="mt-1.5 font-display text-lg uppercase leading-tight tracking-tight">{product.name}</h3>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm font-semibold tabular-nums">{fmt(product.price)}</span>
          {onSale && (
            <span className="text-xs text-brand-400 line-through tabular-nums">{fmt(product.compareAtPrice!)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
