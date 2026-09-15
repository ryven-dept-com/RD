import Link from "next/link";
import { CardBadges } from "@/storefront/shared/badges";
import { CardMedia } from "@/storefront/shared/card-media";
import type { CardProduct, Fmt, Tr } from "@/storefront/types";

/**
 * ATELIER card — the lookbook still. A tall hairline-framed photograph,
 * badge pills, then a captioned line: category kicker, display-face title
 * and a tabular price separated by a hairline. Hover: the photo breathes
 * (scale) and the title takes an accent underline. Calm, editorial,
 * image-led — the reference's product presentation translated for RYVEN.
 */
export function AtelierCard({
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
      className="at-card group block animate-fade-up"
      style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}
    >
      <div className="rd-card-frame relative aspect-[4/5] overflow-hidden border border-black/10 bg-brand-50">
        <CardMedia
          images={product.images}
          name={product.name}
          priority={priority}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          imgClassName="transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        />
        <CardBadges product={product} tr={tr} />
      </div>

      <div className="mt-3 border-b border-black/10 pb-3">
        <p className="rd-card-kicker text-[10px] font-semibold uppercase tracking-[0.22em] text-amber">
          {product.category}
        </p>
        <h3 className="rd-card-title mt-1.5 font-display text-[15px] uppercase leading-snug tracking-[0.04em] text-ink transition-colors group-hover:text-amber">
          {product.name}
        </h3>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-semibold tabular-nums text-ink">{fmt(product.price)}</span>
          {onSale && (
            <s className="text-brand-400 tabular-nums">{fmt(product.compareAtPrice!)}</s>
          )}
        </div>
        {product.colors.length > 0 && (
          <p className="mt-1.5 truncate text-[11px] text-brand-400">
            {product.colors.slice(0, 3).join(" · ")}
            {product.colors.length > 3 ? " · …" : ""}
          </p>
        )}
      </div>
    </Link>
  );
}
