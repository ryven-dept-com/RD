import Link from "next/link";
import { CardMedia } from "@/storefront/shared/card-media";
import type { CardProduct, Fmt, Tr } from "@/storefront/types";

/**
 * SIGNATURE card — almost nothing: a large quiet image, a whispered
 * uppercase caption and a hairline. The product does the talking.
 */
export function SignatureCard({
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
      className="signature-card group block animate-fade-up"
      style={{ animationDelay: `${Math.min(index, 8) * 90}ms` }}
    >
      <div className="rd-card-frame relative aspect-[3/4] overflow-hidden rounded-sm bg-brand-100">
        <CardMedia
          images={product.images}
          name={product.name}
          priority={priority}
          sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 22vw"
          imgClassName="signature-img"
        />
        {product.soldOut && (
          <span className="absolute start-4 top-4 z-10 border border-black/30 bg-bone px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.3em] text-ink">
            {tr("product.soldOut")}
          </span>
        )}
      </div>

      <div className="mt-5 text-center">
        <p className="text-[10px] uppercase tracking-[0.4em] text-black/35">{product.category}</p>
        <h3 className="rd-card-title mt-1.5 text-sm font-medium uppercase tracking-[0.18em]">{product.name}</h3>
        <div className="mt-1.5 flex items-center justify-center gap-2.5">
          <span className="rd-price text-sm tabular-nums">{fmt(product.price)}</span>
          {onSale && (
            <span className="text-xs text-black/35 line-through tabular-nums">{fmt(product.compareAtPrice!)}</span>
          )}
        </div>
        <span className="mx-auto mt-3 block h-px w-8 bg-black/20 transition-all duration-500 group-hover:w-16 group-hover:bg-black/50" aria-hidden />
      </div>
    </Link>
  );
}
