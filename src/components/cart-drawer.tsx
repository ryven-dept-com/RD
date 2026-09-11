"use client";

import Link from "next/link";
import { lineKey, useCart } from "@/context/cart-context";
import { formatPrice } from "@/lib/format";
import { ArrowRightIcon, CloseIcon, MinusIcon, PlusIcon, TruckIcon } from "./icons";

const FREE_SHIP_THRESHOLD = 15000; // $150

export function CartDrawer() {
  const {
    items,
    isOpen,
    closeCart,
    removeItem,
    setQuantity,
    subtotal,
    count,
  } = useCart();

  const remaining = Math.max(0, FREE_SHIP_THRESHOLD - subtotal);
  const progress = Math.min(100, (subtotal / FREE_SHIP_THRESHOLD) * 100);

  return (
    <div
      className={`fixed inset-0 z-[60] ${isOpen ? "" : "pointer-events-none"}`}
      aria-hidden={!isOpen}
    >
      {/* backdrop */}
      <div
        className={`absolute inset-0 bg-ink/50 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={closeCart}
      />

      {/* panel */}
      <aside
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-bone text-ink shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-label="Shopping cart"
      >
        <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
          <h2 className="font-display text-lg uppercase tracking-wide">
            Your Bag{" "}
            <span className="text-sm font-sans text-black/40">({count})</span>
          </h2>
          <button
            onClick={closeCart}
            className="p-1 transition-opacity hover:opacity-60"
            aria-label="Close cart"
          >
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>

        {/* free shipping bar */}
        {items.length > 0 && (
          <div className="border-b border-black/10 px-5 py-3">
            <p className="flex items-center gap-2 text-xs text-black/70">
              <TruckIcon className="h-4 w-4" />
              {remaining > 0 ? (
                <span>
                  You&apos;re{" "}
                  <strong className="text-ink">{formatPrice(remaining)}</strong>{" "}
                  away from free shipping
                </span>
              ) : (
                <span className="font-semibold text-olive">
                  You&apos;ve unlocked free shipping!
                </span>
              )}
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/10">
              <div
                className="h-full rounded-full bg-ink transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* items */}
        <div className="flex-1 overflow-y-auto px-5">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 py-16 text-center">
              <p className="font-display text-2xl uppercase tracking-wide">
                Your bag is empty
              </p>
              <p className="max-w-xs text-sm text-black/50">
                Nothing in here yet. Find your next favorite piece.
              </p>
              <button
                onClick={closeCart}
                className="mt-2 rounded-full bg-ink px-6 py-3 text-xs font-semibold uppercase tracking-widest text-bone transition-transform hover:scale-[1.03]"
              >
                Start shopping
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-black/10">
              {items.map((item) => {
                const key = lineKey(item);
                return (
                  <li key={key} className="flex gap-4 py-4">
                    <Link
                      href={`/products/${item.slug}`}
                      onClick={closeCart}
                      className="relative h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-black/5"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    </Link>
                    <div className="flex flex-1 flex-col">
                      <div className="flex justify-between gap-2">
                        <Link
                          href={`/products/${item.slug}`}
                          onClick={closeCart}
                          className="text-sm font-semibold leading-tight hover:underline"
                        >
                          {item.name}
                        </Link>
                        <span className="text-sm font-semibold tabular-nums">
                          {formatPrice(item.price * item.quantity)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-black/50">
                        {item.color} · {item.size}
                      </p>

                      <div className="mt-auto flex items-center justify-between pt-2">
                        <div className="flex items-center rounded-full border border-black/15">
                          <button
                            onClick={() =>
                              setQuantity(key, item.quantity - 1)
                            }
                            className="flex h-7 w-7 items-center justify-center transition-opacity hover:opacity-60 disabled:opacity-30"
                            disabled={item.quantity <= 1}
                            aria-label="Decrease quantity"
                          >
                            <MinusIcon className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-7 text-center text-xs font-semibold tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              setQuantity(key, item.quantity + 1)
                            }
                            className="flex h-7 w-7 items-center justify-center transition-opacity hover:opacity-60 disabled:opacity-30"
                            disabled={item.quantity >= item.maxStock}
                            aria-label="Increase quantity"
                          >
                            <PlusIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeItem(key)}
                          className="text-xs text-black/40 underline-offset-2 transition-colors hover:text-ink hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* footer */}
        {items.length > 0 && (
          <div className="border-t border-black/10 px-5 py-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-black/60">Subtotal</span>
              <span className="font-display text-xl">
                {formatPrice(subtotal)}
              </span>
            </div>
            <p className="mt-1 text-xs text-black/40">
              Shipping &amp; taxes calculated at checkout.
            </p>
            <Link
              href="/checkout"
              onClick={closeCart}
              className="group mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-ink py-4 text-sm font-semibold uppercase tracking-widest text-bone transition-transform hover:scale-[1.02]"
            >
              Checkout
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <button
              onClick={closeCart}
              className="mt-2 w-full py-2 text-xs font-medium uppercase tracking-widest text-black/50 transition-colors hover:text-ink"
            >
              Continue shopping
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
