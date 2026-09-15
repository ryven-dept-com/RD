"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/cart-context";
import { useStoreConfig } from "@/context/store-context";
import { trackBuiltPixelEvent } from "@/components/meta-pixel";
import {
  buildAddToCartEvent,
  buildViewContentEvent,
} from "@/lib/pixel-events";
import { ArrowRightIcon, MinusIcon, PlusIcon } from "@/components/icons";
import { useT } from "@/i18n/language-context";
import type { StorefrontVariant } from "@/lib/queries";

type PurchaseProps = {
  productId: number;
  slug: string;
  name: string;
  price: number;
  image: string;
  sizes: string[];
  colors: string[];
  stock: number;
  category: string;
  variants?: StorefrontVariant[];
};

/** Ordered unique option values from the variant matrix. */
function optionLists(variants: StorefrontVariant[]): {
  sizes: string[];
  colors: string[];
} {
  const sizes: string[] = [];
  const colors: string[] = [];
  for (const v of variants) {
    if (v.size && !sizes.includes(v.size)) sizes.push(v.size);
    if (v.color && !colors.includes(v.color)) colors.push(v.color);
  }
  return { sizes, colors };
}

export function ProductPurchase(props: PurchaseProps) {
  const router = useRouter();
  const { buyNow } = useCart();
  const { formatPrice, pixel, currencyCode } = useStoreConfig();
  const t = useT();

  const variants = useMemo(() => props.variants ?? [], [props.variants]);
  const hasVariants = variants.length > 0;

  // Option lists come from the variant matrix when present so every button
  // maps to a real purchasable combination; legacy products fall back to the
  // product-level size/color arrays.
  const options = useMemo(
    () =>
      hasVariants
        ? optionLists(variants)
        : { sizes: props.sizes, colors: props.colors },
    [hasVariants, variants, props.sizes, props.colors],
  );

  const [color, setColor] = useState(
    options.colors[0] ?? "Default",
  );
  const [size, setSize] = useState<string>(
    options.sizes.length === 1 ? options.sizes[0] : "",
  );
  const [qty, setQty] = useState(1);
  const [error, setError] = useState(false);

  const selectedVariant = hasVariants
    ? variants.find((v) => v.size === size && v.color === color) ?? null
    : null;

  // Live stock for the exact selection (variant-level when variants exist,
  // product-level for legacy items).
  const effectiveStock = hasVariants
    ? selectedVariant?.stock ?? 0
    : props.stock;
  const lowStock = effectiveStock > 0 && effectiveStock <= 8;

  // Availability of each option given the OTHER current selection, so a
  // size/color combination with no variant (or no stock) is clearly disabled.
  const colorIsAvailable = (c: string) => {
    if (!hasVariants) return true;
    const pool = size ? variants.filter((v) => v.size === size) : variants;
    return pool.some((v) => v.color === c && v.stock > 0);
  };
  const sizeIsAvailable = (s: string) => {
    if (!hasVariants) return true;
    const pool = color ? variants.filter((v) => v.color === color) : variants;
    return pool.some((v) => v.size === s && v.stock > 0);
  };

  const handleColor = (c: string) => {
    setColor(c);
    // If the current size has no stock in this color, drop the size choice.
    if (hasVariants && size && !variants.some(
      (v) => v.size === size && v.color === c && v.stock > 0,
    )) {
      setSize("");
    }
    setQty(1);
  };
  const handleSize = (s: string) => {
    setSize(s);
    setError(false);
    setQty(1);
  };

  // ViewContent standard event for Meta Pixel — real product identifier,
  // name, price and the store's configured currency.
  useEffect(() => {
    if (pixel.enabled && pixel.events.viewContent) {
      trackBuiltPixelEvent(
        buildViewContentEvent(
          {
            slug: props.slug,
            name: props.name,
            price: props.price,
            category: props.category,
          },
          currencyCode,
        ),
      );
    }
    // Fire once per product page visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const needSize = options.sizes.length > 0 && !size;
  const canBuy = !needSize && effectiveStock > 0;

  // Direct purchase: the exact selected variant goes straight to checkout.
  // Server-side stock + variant validation still runs at /api/checkout.
  const handleBuyNow = () => {
    if (needSize) {
      setError(true);
      return;
    }
    if (effectiveStock <= 0) return;
    const quantity = Math.min(qty, effectiveStock);
    buyNow({
      productId: props.productId,
      slug: props.slug,
      name: props.name,
      price: props.price,
      image: props.image,
      size,
      color,
      quantity,
      maxStock: effectiveStock,
      variantId: selectedVariant?.id,
      sku: selectedVariant?.sku || undefined,
    });
    // AddToCart stays part of the funnel: the line is placed in the cart
    // before InitiateCheckout/Purchase fire downstream.
    if (pixel.enabled && pixel.events.addToCart) {
      trackBuiltPixelEvent(
        buildAddToCartEvent(
          { slug: props.slug, name: props.name, price: props.price },
          quantity,
          currencyCode,
        ),
      );
    }
    router.push("/checkout");
  };

  // Per-theme control shapes — identical logic, different instrument panel.
  const { theme } = useStoreConfig();
  const pt = {
    noir: { chip: "rounded-sm", size: "rounded-sm", qty: "rounded-sm", cta: "rounded-sm" },
    concrete: { chip: "rounded-none border-2", size: "rounded-none border-2", qty: "rounded-none border-2", cta: "rounded-none" },
    district: { chip: "rounded-full", size: "rounded-lg", qty: "rounded-full", cta: "rounded-full" },
    nightshift: { chip: "rounded-md", size: "rounded-md", qty: "rounded-md", cta: "rounded-full" },
    archive: { chip: "rounded-full", size: "rounded-none", qty: "rounded-full", cta: "rounded-full" },
    signature: { chip: "rounded-full", size: "rounded-full", qty: "rounded-full", cta: "rounded-full" },
    seventh: { chip: "rounded-none border-2", size: "rounded-none border-2", qty: "rounded-none border-2", cta: "rounded-sm" },
    atelier: { chip: "rounded-full", size: "rounded-full", qty: "rounded-full", cta: "rounded-full" },
  }[theme] ?? { chip: "rounded-full", size: "rounded-lg", qty: "rounded-full", cta: "rounded-full" };

  return (
    <div className="space-y-6">
      {/* color */}
      {options.colors.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-black/50">
              {t("product.color")}
            </span>
            <span className="text-sm text-black/60">{color}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {options.colors.map((c) => {
              const available = colorIsAvailable(c);
              return (
                <button
                  key={c}
                  onClick={() => available && handleColor(c)}
                  disabled={!available}
                  className={`${pt.chip} border px-4 py-2 text-sm font-medium transition-all ${
                    color === c
                      ? "border-ink bg-ink text-bone"
                      : available
                        ? "border-black/15 hover:border-ink"
                        : "cursor-not-allowed border-black/10 text-black/25 line-through"
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* size */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-black/50">
            Size
          </span>
          <button className="text-xs font-medium text-black/40 underline-offset-2 hover:text-ink hover:underline">
            Size guide
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {options.sizes.map((s) => {
            const available = sizeIsAvailable(s);
            return (
              <button
                key={s}
                onClick={() => available && handleSize(s)}
                disabled={!available}
                className={`min-w-12 ${pt.size} border px-3 py-2.5 text-sm font-medium transition-all ${
                  size === s
                    ? "border-ink bg-ink text-bone"
                    : available
                      ? "border-black/15 hover:border-ink"
                      : "cursor-not-allowed border-black/10 text-black/25 line-through"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
        {error && needSize && (
          <p className="mt-2 text-xs font-medium text-red-600">
            {t("product.selectSize")}
          </p>
        )}
      </div>

      {/* qty + add */}
      <div className="flex items-stretch gap-3 pt-2">
        <div className={`flex items-center ${pt.qty} border border-black/15`}>
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="flex h-12 w-12 items-center justify-center transition-opacity hover:opacity-60 disabled:opacity-30"
            disabled={qty <= 1}
            aria-label={t("product.decrease")}
          >
            <MinusIcon className="h-4 w-4" />
          </button>
          <span className="w-8 text-center font-semibold tabular-nums">
            {qty}
          </span>
          <button
            onClick={() => setQty((q) => Math.min(effectiveStock, q + 1))}
            className="flex h-12 w-12 items-center justify-center transition-opacity hover:opacity-60 disabled:opacity-30"
            disabled={qty >= effectiveStock}
            aria-label={t("product.increase")}
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        </div>

        <button
          onClick={handleBuyNow}
          disabled={!canBuy}
          className={`rd-atc rd-cta group flex flex-1 items-center justify-center gap-2 ${pt.cta} px-6 text-sm font-semibold uppercase tracking-widest transition-transform ${
            canBuy
              ? "bg-ink text-bone hover:scale-[1.02]"
              : "cursor-not-allowed bg-black/10 text-black/40"
          }`}
        >
          {!canBuy && effectiveStock <= 0 && !needSize ? (
            <>{t("product.soldOut")}</>
          ) : (
            <>
              {t("product.buyNow")} · {formatPrice(props.price * qty)}
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
            </>
          )}
        </button>
      </div>

      {lowStock && (
        <p className="text-center text-xs font-medium text-amber-700">
          {t("product.onlyLeft", { count: effectiveStock })}
        </p>
      )}
    </div>
  );
}
