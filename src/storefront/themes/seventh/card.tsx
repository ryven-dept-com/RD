import Link from "next/link";
import { CardBadges } from "@/storefront/shared/badges";
import { CardMedia } from "@/storefront/shared/card-media";
import type { CardProduct, Fmt, Tr } from "@/storefront/types";

/**
 * BLOCK SEVEN card — a poster on the wall. White 3px-framed plate with a
 * hard offset shadow, a rotated sticker price tag and a slab index chip.
 * Hover lifts the plate off the wall (shadow grows) — tactile, never slick.
 */
export function SeventhCard({
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
      className="sb-card group block animate-fade-up"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <div className="sb-frame rd-card-frame relative aspect-[4/5] overflow-hidden border-[3px] border-ink bg-brand-50">
        <CardMedia
          images={product.images}
          name={product.name}
          priority={priority}
          sizes="(max-width: 640px) 80vw, (max-width: 1024px) 45vw, 30vw"
        />
        <CardBadges product={product} tr={tr} />
        {/* slab index chip */}
        <span className="absolute start-0 top-3 bg-ink px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-bone">
          {String((index % 99) + 1).padStart(2, "0")}
        </span>
      </div>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="rd-card-kicker text-[10px] font-bold uppercase tracking-[0.18em] text-amber">
            {product.category}
          </p>
          <h3 className="rd-card-title mt-1 font-display text-base uppercase leading-tight tracking-tight text-ink">
            {product.name}
          </h3>
        </div>
        {/* sticker price plate */}
        <span className="sb-sticker shrink-0 bg-olive px-2.5 py-1 text-xs font-bold tabular-nums text-ink">
          {onSale ? (
            <>
              {fmt(product.price)}{" "}
              <s className="opacity-60">{fmt(product.compareAtPrice!)}</s>
            </>
          ) : (
            fmt(product.price)
          )}
        </span>
      </div>
    </Link>
  );
}
