"use client";

import Image from "next/image";
import Link from "next/link";
import { lineKey, useCart } from "@/context/cart-context";
import { useStoreConfig } from "@/context/store-context";
import { useT } from "@/i18n/language-context";
import { ArrowRightIcon, CloseIcon, MinusIcon, PlusIcon, TruckIcon } from "./icons";


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
  const { formatPrice, freeShippingThreshold } = useStoreConfig();
  const t = useT();

  // The threshold setting is whole DZD; the cart subtotal is integer cents
  // — convert once so the progress bar compares like-for-like amounts.
  const thresholdCents = freeShippingThreshold * 100;
  const remaining = Math.max(0, thresholdCents - subtotal);
  const progress = Math.min(100, thresholdCents > 0 ? (subtotal / thresholdCents) * 100 : 100);

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
        className={`absolute end-0 top-0 flex h-full w-full max-w-md flex-col bg-bone text-ink shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isOpen ? "translate-x-0" : "ltr:translate-x-full rtl:-translate-x-full"
        }`}
        role="dialog"
        aria-label={t("cart.title")}
      >
        <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
          <h2 className="font-display text-lg uppercase tracking-wide">
            {t("cart.title")}{" "}
            <span className="text-sm font-sans text-black/40">({count})</span>
          </h2>
          <button
            onClick={closeCart}
            className="p-1 transition-opacity hover:opacity-60"
            aria-label={t("cart.close")}
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
                  {t("cart.freeShipAway", {
                    amount: formatPrice(remaining),
                  })}
                </span>
              ) : (
                <span className="font-semibold text-olive">
                  {t("cart.freeShipUnlocked")}
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
                {t("cart.empty")}
              </p>
              <p className="max-w-xs text-sm text-black/50">
                {t("cart.emptyText")}
              </p>
              <button
                onClick={closeCart}
                className="mt-2 rounded-full bg-ink px-6 py-3 text-xs font-semibold uppercase tracking-widest text-bone transition-transform hover:scale-[1.03]"
              >
                {t("cart.startShopping")}
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
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      ) : null}
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
                            aria-label={t("cart.decrease")}
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
                            aria-label={t("cart.increase")}
                          >
                            <PlusIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeItem(key)}
                          className="text-xs text-black/40 underline-offset-2 transition-colors hover:text-ink hover:underline"
                        >
                          {t("cart.remove")}
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
              <span className="text-black/60">{t("cart.subtotal")}</span>
              <span className="font-display text-xl">
                {formatPrice(subtotal)}
              </span>
            </div>
            <p className="mt-1 text-xs text-black/40">
              {t("cart.checkoutNote")}
            </p>
            <Link
              href="/checkout"
              onClick={closeCart}
              className="group mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-ink py-4 text-sm font-semibold uppercase tracking-widest text-bone transition-transform hover:scale-[1.02]"
            >
              {t("cart.checkout")}
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
            </Link>
            <button
              onClick={closeCart}
              className="mt-2 w-full py-2 text-xs font-medium uppercase tracking-widest text-black/50 transition-colors hover:text-ink"
            >
              {t("cart.continueShopping")}
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
