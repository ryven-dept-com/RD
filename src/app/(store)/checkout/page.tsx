"use client";

import Link from "next/link";
import { useState } from "react";
import { lineKey, useCart } from "@/context/cart-context";
import { formatPrice } from "@/lib/format";
import { ArrowRightIcon, CheckIcon, ShieldIcon } from "@/components/icons";

const FREE_SHIP_THRESHOLD = 15000;
const SHIPPING_FLAT = 995;

type Confirmation = {
  orderNumber: string;
  total: number;
  shipping: number;
  subtotal: number;
  email: string;
};

export default function CheckoutPage() {
  const { items, subtotal, clearCart } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const [form, setForm] = useState({
    email: "",
    fullName: "",
    address: "",
    city: "",
    postalCode: "",
    country: "United States",
    card: "",
    exp: "",
    cvc: "",
  });

  const shipping = subtotal >= FREE_SHIP_THRESHOLD ? 0 : SHIPPING_FLAT;
  const total = subtotal + shipping;

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          fullName: form.fullName,
          address: form.address,
          city: form.city,
          postalCode: form.postalCode,
          country: form.country,
          items: items.map((i) => ({
            slug: i.slug,
            size: i.size,
            color: i.color,
            quantity: i.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Checkout failed");
      setConfirmation({
        orderNumber: data.orderNumber,
        total: data.total,
        shipping: data.shipping,
        subtotal: data.subtotal,
        email: form.email,
      });
      clearCart();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Confirmation ----
  if (confirmation) {
    return (
      <div className="min-h-screen bg-bone pt-16">
        <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
          <div className="mx-auto flex h-16 w-16 animate-scale-in items-center justify-center rounded-full bg-olive text-bone">
            <CheckIcon className="h-8 w-8" />
          </div>
          <h1 className="mt-6 font-display text-4xl uppercase tracking-tight sm:text-5xl">
            Order confirmed
          </h1>
          <p className="mt-3 text-black/60">
            Thanks for your order. A confirmation has been sent to{" "}
            <strong className="text-ink">{confirmation.email}</strong>.
          </p>

          <div className="mt-8 rounded-2xl border border-black/10 bg-brand-50 p-6 text-left">
            <div className="flex items-center justify-between border-b border-black/10 pb-4">
              <span className="text-sm text-black/50">Order number</span>
              <span className="font-display text-lg tracking-wide">
                {confirmation.orderNumber}
              </span>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-black/50">Subtotal</dt>
                <dd className="tabular-nums">
                  {formatPrice(confirmation.subtotal)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-black/50">Shipping</dt>
                <dd className="tabular-nums">
                  {confirmation.shipping === 0
                    ? "Free"
                    : formatPrice(confirmation.shipping)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-black/10 pt-3 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">
                  {formatPrice(confirmation.total)}
                </dd>
              </div>
            </dl>
          </div>

          <Link
            href="/shop"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-ink px-8 py-4 text-sm font-semibold uppercase tracking-widest text-bone transition-transform hover:scale-105"
          >
            Continue shopping
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  // ---- Empty cart ----
  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-bone pt-16">
        <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
          <h1 className="font-display text-4xl uppercase tracking-tight sm:text-5xl">
            Your bag is empty
          </h1>
          <p className="mt-3 text-black/60">
            Add a few pieces before heading to checkout.
          </p>
          <Link
            href="/shop"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-ink px-8 py-4 text-sm font-semibold uppercase tracking-widest text-bone transition-transform hover:scale-105"
          >
            Shop the collection
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  // ---- Checkout form ----
  const inputClass =
    "w-full rounded-lg border border-black/15 bg-bone px-4 py-3 text-sm focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink";

  return (
    <div className="min-h-screen bg-bone pt-16">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="font-display text-4xl uppercase tracking-tight sm:text-5xl">
          Checkout
        </h1>

        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_400px]">
          {/* form */}
          <form onSubmit={submit} className="space-y-8">
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">
                Contact
              </h2>
              <input
                type="email"
                required
                value={form.email}
                onChange={set("email")}
                placeholder="Email address"
                className={`mt-3 ${inputClass}`}
              />
            </section>

            <section>
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">
                Shipping address
              </h2>
              <div className="mt-3 space-y-3">
                <input
                  required
                  value={form.fullName}
                  onChange={set("fullName")}
                  placeholder="Full name"
                  className={inputClass}
                />
                <input
                  required
                  value={form.address}
                  onChange={set("address")}
                  placeholder="Street address"
                  className={inputClass}
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    required
                    value={form.city}
                    onChange={set("city")}
                    placeholder="City"
                    className={inputClass}
                  />
                  <input
                    required
                    value={form.postalCode}
                    onChange={set("postalCode")}
                    placeholder="Postal code"
                    className={inputClass}
                  />
                </div>
                <input
                  required
                  value={form.country}
                  onChange={set("country")}
                  placeholder="Country"
                  className={inputClass}
                />
              </div>
            </section>

            <section>
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">
                Payment
              </h2>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-black/40">
                <ShieldIcon className="h-3.5 w-3.5" /> Demo checkout — no real
                card is charged.
              </p>
              <div className="mt-3 space-y-3">
                <input
                  value={form.card}
                  onChange={set("card")}
                  placeholder="Card number"
                  inputMode="numeric"
                  className={inputClass}
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={form.exp}
                    onChange={set("exp")}
                    placeholder="MM / YY"
                    className={inputClass}
                  />
                  <input
                    value={form.cvc}
                    onChange={set("cvc")}
                    placeholder="CVC"
                    inputMode="numeric"
                    className={inputClass}
                  />
                </div>
              </div>
            </section>

            {error && (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="group flex w-full items-center justify-center gap-2 rounded-full bg-ink py-4 text-sm font-semibold uppercase tracking-widest text-bone transition-transform hover:scale-[1.01] disabled:opacity-50"
            >
              {submitting ? "Placing order…" : `Pay ${formatPrice(total)}`}
              {!submitting && (
                <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              )}
            </button>
          </form>

          {/* summary */}
          <div className="lg:sticky lg:top-24 lg:h-fit">
            <div className="rounded-2xl border border-black/10 bg-brand-50 p-6">
              <h2 className="font-display text-lg uppercase tracking-wide">
                Order summary
              </h2>
              <ul className="mt-4 space-y-4">
                {items.map((item) => (
                  <li key={lineKey(item)} className="flex gap-3">
                    <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-black/5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-bold text-bone">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col justify-center">
                      <p className="text-sm font-semibold leading-tight">
                        {item.name}
                      </p>
                      <p className="text-xs text-black/50">
                        {item.color} · {item.size}
                      </p>
                    </div>
                    <span className="self-center text-sm font-semibold tabular-nums">
                      {formatPrice(item.price * item.quantity)}
                    </span>
                  </li>
                ))}
              </ul>

              <dl className="mt-6 space-y-2 border-t border-black/10 pt-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-black/50">Subtotal</dt>
                  <dd className="tabular-nums">{formatPrice(subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-black/50">Shipping</dt>
                  <dd className="tabular-nums">
                    {shipping === 0 ? "Free" : formatPrice(shipping)}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-black/10 pt-3 text-base font-semibold">
                  <dt>Total</dt>
                  <dd className="font-display text-xl">{formatPrice(total)}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
