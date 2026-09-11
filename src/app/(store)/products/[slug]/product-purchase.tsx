"use client";

import { useState } from "react";
import { useCart } from "@/context/cart-context";
import { formatPrice } from "@/lib/format";
import { BagIcon, CheckIcon, MinusIcon, PlusIcon } from "@/components/icons";

type PurchaseProps = {
  productId: number;
  slug: string;
  name: string;
  price: number;
  image: string;
  sizes: string[];
  colors: string[];
  stock: number;
};

export function ProductPurchase(props: PurchaseProps) {
  const { addItem } = useCart();
  const [color, setColor] = useState(props.colors[0] ?? "Default");
  const [size, setSize] = useState<string>(
    props.sizes.length === 1 ? props.sizes[0] : "",
  );
  const [qty, setQty] = useState(1);
  const [error, setError] = useState(false);
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    if (!size) {
      setError(true);
      return;
    }
    addItem({
      productId: props.productId,
      slug: props.slug,
      name: props.name,
      price: props.price,
      image: props.image,
      size,
      color,
      quantity: qty,
      maxStock: props.stock,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  const lowStock = props.stock <= 8;

  return (
    <div className="space-y-6">
      {/* color */}
      {props.colors.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-black/50">
              Color
            </span>
            <span className="text-sm text-black/60">{color}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {props.colors.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                  color === c
                    ? "border-ink bg-ink text-bone"
                    : "border-black/15 hover:border-ink"
                }`}
              >
                {c}
              </button>
            ))}
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
          {props.sizes.map((s) => (
            <button
              key={s}
              onClick={() => {
                setSize(s);
                setError(false);
              }}
              className={`min-w-12 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                size === s
                  ? "border-ink bg-ink text-bone"
                  : "border-black/15 hover:border-ink"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        {error && (
          <p className="mt-2 text-xs font-medium text-red-600">
            Please select a size.
          </p>
        )}
      </div>

      {/* qty + add */}
      <div className="flex items-stretch gap-3 pt-2">
        <div className="flex items-center rounded-full border border-black/15">
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="flex h-12 w-12 items-center justify-center transition-opacity hover:opacity-60 disabled:opacity-30"
            disabled={qty <= 1}
            aria-label="Decrease quantity"
          >
            <MinusIcon className="h-4 w-4" />
          </button>
          <span className="w-8 text-center font-semibold tabular-nums">
            {qty}
          </span>
          <button
            onClick={() => setQty((q) => Math.min(props.stock, q + 1))}
            className="flex h-12 w-12 items-center justify-center transition-opacity hover:opacity-60 disabled:opacity-30"
            disabled={qty >= props.stock}
            aria-label="Increase quantity"
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        </div>

        <button
          onClick={handleAdd}
          className="group flex flex-1 items-center justify-center gap-2 rounded-full bg-ink px-6 text-sm font-semibold uppercase tracking-widest text-bone transition-transform hover:scale-[1.02]"
        >
          {added ? (
            <>
              <CheckIcon className="h-5 w-5" /> Added to bag
            </>
          ) : (
            <>
              <BagIcon className="h-5 w-5" /> Add to bag ·{" "}
              {formatPrice(props.price * qty)}
            </>
          )}
        </button>
      </div>

      {lowStock && (
        <p className="text-center text-xs font-medium text-amber-700">
          Only {props.stock} left in stock — order soon.
        </p>
      )}
    </div>
  );
}
