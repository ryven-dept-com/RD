"use client";

import Image from "next/image";
import Link from "next/link";
import { useStoreConfig } from "@/context/store-context";
import { useT } from "@/i18n/language-context";
import { StarRating } from "./star-rating";

export type ProductCardData = {
  slug: string;
  name: string;
  tagline: string;
  price: number;
  compareAtPrice: number | null;
  category: string;
  images: string[];
  colors: string[];
  isNew: boolean;
  bestSeller: boolean;
  soldOut: boolean;
  avgRating: number;
  reviewCount: number;
};

export function ProductCard({
  product,
  priority = false,
  index = 0,
}: {
  product: ProductCardData;
  priority?: boolean;
  index?: number;
}) {
  const { formatPrice } = useStoreConfig();
  const t = useT();
  const onSale =
    product.compareAtPrice != null && product.compareAtPrice > product.price;
  const secondImage = product.images[1] ?? product.images[0];
  // A distinct hover image is worth downloading; otherwise the base image
  // simply stays visible on hover (no blank card, no duplicate payload).
  const hasHoverImage = Boolean(secondImage) && secondImage !== product.images[0];

  return (
    <Link
      href={`/products/${product.slug}`}
      className="rd-card group block animate-fade-up"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <div className="rd-card-img relative aspect-[3/4] overflow-hidden rounded-xl bg-brand-100">
        {/* theme index chip — markup always present, visibility is decided
            by the active theme's CSS (RAW CONCRETE / ARCHIVE show it) */}
        <span className="rd-card-index" aria-hidden="true">
          {String((index % 99) + 1).padStart(2, "0")}
        </span>
        {/* base image — server-optimized (AVIF/WebP + responsive srcset),
            sized for the card instead of the full-resolution original */}
        {product.images[0] ? (
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            priority={priority}
            className={`img-zoom object-cover transition-opacity duration-500 ${
              hasHoverImage ? "group-hover:opacity-0" : ""
            }`}
          />
        ) : null}
        {/* hover image (pointer devices only): rendered exclusively where
            hover exists, so touch-first phones never download a second
            large image per card they can never see. */}
        {hasHoverImage ? (
          <Image
            src={secondImage}
            alt=""
            aria-hidden="true"
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="hidden object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100 [@media(hover:hover)]:block"
          />
        ) : null}

        {/* badges */}
        <div className="absolute start-3 top-3 flex flex-col gap-1.5">
          {product.soldOut && (
            <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-ink shadow-sm">
              {t("product.soldOut")}
            </span>
          )}
          {product.isNew && (
            <span className="rounded-full bg-ink px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-bone">
              {t("product.new")}
            </span>
          )}
          {onSale && (
            <span className="rounded-full bg-amber px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-ink">
              {t("product.sale")}
            </span>
          )}
          {product.bestSeller && !product.isNew && (
            <span className="rounded-full bg-bone px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-ink">
              {t("product.bestSeller")}
            </span>
          )}
        </div>

        {/* quick view hint */}
        <div className="absolute inset-x-3 bottom-3 translate-y-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <span className="flex w-full items-center justify-center rounded-full bg-bone/95 py-2.5 text-xs font-semibold uppercase tracking-widest text-ink backdrop-blur">
            {t("product.viewProduct")}
          </span>
        </div>
      </div>

      <div className="rd-card-meta mt-3 px-0.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-black/40">
            {product.category}
          </p>
          {product.reviewCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-black/40">
              <StarRating rating={product.avgRating} size={11} />
              <span className="tabular-nums">({product.reviewCount})</span>
            </span>
          )}
        </div>
        <h3 className="mt-1 text-sm font-semibold leading-snug text-ink">
          {product.name}
        </h3>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm font-semibold tabular-nums">
            {formatPrice(product.price)}
          </span>
          {onSale && (
            <span className="text-xs text-black/35 line-through tabular-nums">
              {formatPrice(product.compareAtPrice!)}
            </span>
          )}
          {product.colors.length > 1 && (
            <span className="ms-auto text-[11px] text-black/40">
              {t("product.colors", { count: product.colors.length })}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
