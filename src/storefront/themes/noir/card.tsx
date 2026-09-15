import Link from "next/link";
import { CardBadges } from "@/storefront/shared/badges";
import { CardMedia } from "@/storefront/shared/card-media";
import type { CardProduct, Fmt, Tr } from "@/storefront/types";

/**
 * NOIR DEPT card — editorial luxury. The product name sits ON the image in
 * oversized condensed type over a cinematic veil; the caption below is a
 * slim gold-ruled price line. Deliberately unlike a standard grid card.
 */
export function NoirCard({
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
      className="noir-card group block animate-fade-up"
      style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}
    >
      <div className="rd-card-img relative aspect-[4/5] overflow-hidden rounded-md bg-brand-100">
        <CardMedia
          images={product.images}
          name={product.name}
          priority={priority}
          sizes="(max-width: 640px) 80vw, (max-width: 1024px) 45vw, 30vw"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent opacity-90 transition-opacity duration-500 group-hover:opacity-100" />
        <CardBadges product={product} tr={tr} />
        {/* editorial caption over the image */}
        <div className="absolute inset-x-0 bottom-0 p-5">
          <p className="noir-card-kicker text-[10px] font-semibold uppercase tracking-[0.35em] text-bone/60">
            {String((index % 99) + 1).padStart(2, "0")} — {product.category}
          </p>
          <h3 className="mt-1.5 font-display text-2xl uppercase leading-none tracking-tight text-bone sm:text-3xl">
            {product.name}
          </h3>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 px-0.5">
        <span className="h-px w-8 shrink-0 bg-amber" aria-hidden />
        <span className="text-sm font-semibold tabular-nums tracking-wide">
          {fmt(product.price)}
        </span>
        {onSale ? (
          <span className="text-xs tabular-nums text-brand-400 line-through">
            {fmt(product.compareAtPrice!)}
          </span>
        ) : (
          <span className="text-[11px] uppercase tracking-[0.2em] text-brand-400">
            {tr("product.viewProduct")}
          </span>
        )}
      </div>
    </Link>
  );
}
