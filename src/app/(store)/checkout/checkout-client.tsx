"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { lineKey, useCart } from "@/context/cart-context";
import { useStoreConfig } from "@/context/store-context";
import { trackBuiltPixelEvent } from "@/components/meta-pixel";
import {
  buildInitiateCheckoutEvent,
  buildPurchaseEvent,
  markPurchaseTracked,
  wasPurchaseTracked,
} from "@/lib/pixel-events";
import { ArrowRightIcon, CheckIcon, ShieldIcon } from "@/components/icons";
import { useT } from "@/i18n/language-context";

const SHIPPING_FLAT = 995;

/**
 * The free-shipping threshold is a store SETTING expressed in WHOLE DZD
 * (the number the admin enters, e.g. 5000 = 5,000 DA). Every amount in
 * the cart/order pipeline (subtotal, shipping, totals) is INTEGER CENTS,
 * so the threshold is converted once here and all comparisons use cents.
 * Comparing DZD against cents directly made every cart look "free".
 *
 * Rule: free shipping applies to STOP DESK / BUREAU only, at or above the
 * threshold. HOME DELIVERY always keeps the configured wilaya price.
 */
const DZD_TO_CENTS = 100;

type Confirmation = {
  orderNumber: string;
  total: number;
  shipping: number;
  subtotal: number;
  phone: string;
};

// Phase 8: public delivery configuration (server is the source of truth —
// the checkout API recomputes the final shipping fee on its own).
type PublicZoneMethod = { price: number; estimatedTime: string } | null;
type PublicZone = {
  code: number;
  wilaya: string;
  city: string;
  methods: { home: PublicZoneMethod; office: PublicZoneMethod };
};
type ShippingQuote = {
  method: "home" | "office";
  shipping: number;
  freeShipping: boolean;
  estimatedTime: string;
};

export function CheckoutClient() {
  const { items, subtotal, clearCart } = useCart();
  const {
    formatPrice,
    codEnabled,
    freeShippingThreshold,
    minOrderAmount,
    pixel,
    currencyCode,
  } = useStoreConfig();
  const t = useT();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    card: "",
    exp: "",
    cvc: "",
  });

  // Phase 8: delivery zone + method selection.
  const [zones, setZones] = useState<PublicZone[]>([]);
  const [zonesError, setZonesError] = useState("");
  const [deliveryZone, setDeliveryZone] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<"home" | "office">("home");
  const [commune, setCommune] = useState("");
  // Keyed quote result: `quoteBusy`/`quote` are DERIVED, so no state is
  // written synchronously inside effects (the fetch resolves into the key).
  const [quoteResult, setQuoteResult] = useState<{
    key: string;
    quote: ShippingQuote | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/delivery/zones")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ok && Array.isArray(data.zones)) setZones(data.zones);
        else setZonesError(t("checkout.zonesError"));
      })
      .catch(() => {
        if (!cancelled) setZonesError(t("checkout.zonesError"));
      });
    return () => {
      cancelled = true;
    };
    // Fetches once per checkout visit; the translated error message uses the
    // locale active when checkout loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const quoteKey = deliveryZone
    ? `${deliveryZone}|${deliveryMethod}|${Math.max(0, Math.floor(subtotal))}`
    : "";

  // Server-computed shipping quote — the client only displays it.
  useEffect(() => {
    if (!quoteKey) return;
    const [zone, method, sub] = quoteKey.split("|");
    let cancelled = false;
    fetch(
      `/api/delivery/quote?zone=${encodeURIComponent(zone)}&method=${method}&subtotal=${sub}`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setQuoteResult({ key: quoteKey, quote: data.ok ? data.quote : null });
        }
      })
      .catch(() => {
        if (!cancelled) setQuoteResult({ key: quoteKey, quote: null });
      });
    return () => {
      cancelled = true;
    };
  }, [quoteKey]);

  const selectedZone = zones.find((z) => String(z.code) === deliveryZone) ?? null;
  const quoteBusy = Boolean(quoteKey) && quoteResult?.key !== quoteKey;
  const quote = quoteResult?.key === quoteKey ? quoteResult.quote : null;
  const effectiveQuote = deliveryZone ? quote : null;

  // Cents-based threshold for comparison against the cents subtotal.
  const freeShippingThresholdCents = freeShippingThreshold * DZD_TO_CENTS;

  // Before a wilaya is selected there is no zone quote: show the legacy
  // flat preview. Free shipping is bureau-only and requires a zone, so the
  // preview is never "Free" (the server recomputes everything at order time).
  const shipping = effectiveQuote ? effectiveQuote.shipping : SHIPPING_FLAT;
  const total = subtotal + shipping;
  const belowMinimum = minOrderAmount > 0 && subtotal < minOrderAmount;

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  // InitiateCheckout standard event — fires once when the checkout flow
  // actually starts (page reached with a non-empty cart).
  useEffect(() => {
    if (items.length && pixel.enabled && pixel.events.initiateCheckout) {
      trackBuiltPixelEvent(
        buildInitiateCheckoutEvent(
          items.map((i) => ({
            slug: i.slug,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
          })),
          currencyCode,
        ),
      );
    }
    // Fire once per checkout visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          phone: form.phone,
          commune: commune.trim(),
          // Phase 8: delivery selection — the server re-verifies the zone,
          // method and price (client values are never trusted).
          ...(deliveryZone
            ? {
                deliveryZone: Number(deliveryZone),
                deliveryMethod,
                wilaya: selectedZone?.wilaya ?? "",
              }
            : {}),
          items: items.map((i) => ({
            slug: i.slug,
            size: i.size,
            color: i.color,
            quantity: i.quantity,
            // Exact variant + SKU so the server can validate live stock
            // for the precise combination in the bag (Phase 5).
            variantId: i.variantId ?? null,
            sku: i.sku ?? null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (data.error === "ORDER_BELOW_MINIMUM") {
          throw new Error(
            t("checkout.minOrder", { amount: formatPrice(minOrderAmount) }),
          );
        }
        throw new Error(data.error ?? t("checkout.errorDefault"));
      }
      setConfirmation({
        orderNumber: data.orderNumber,
        total: data.total,
        shipping: data.shipping,
        subtotal: data.subtotal,
        phone: form.phone,
      });
      clearCart();
      // Purchase event — only after a real order was created. Guarded per
      // order number so refresh/reload/back-forward never fires it twice.
      // The eventId comes from the order API and is shared with the
      // server-side Conversions API event for Meta deduplication.
      if (
        pixel.enabled &&
        pixel.events.purchase &&
        !wasPurchaseTracked(data.orderNumber)
      ) {
        markPurchaseTracked(data.orderNumber);
        trackBuiltPixelEvent(
          buildPurchaseEvent({
            orderNumber: data.orderNumber,
            items: items.map((i) => ({
              slug: i.slug,
              name: i.name,
              price: i.price,
              quantity: i.quantity,
            })),
            total: data.total,
            currency: data.currency || currencyCode,
            eventId: data.purchaseEventId,
          }),
        );
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("checkout.errorDefault"));
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Confirmation ----
  if (confirmation) {
    return (
      <div className="rd-needs-offset min-h-screen bg-bone pt-16">
        <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
          <div className="mx-auto flex h-16 w-16 animate-scale-in items-center justify-center rounded-full bg-olive text-bone">
            <CheckIcon className="h-8 w-8" />
          </div>
          <h1 className="mt-6 font-display text-4xl uppercase tracking-tight sm:text-5xl">
            {t("checkout.confirmedTitle")}
          </h1>
          <p className="mt-3 text-black/60">
            {t("checkout.confirmedText", { phone: confirmation.phone })}
          </p>

          <div className="mt-8 rounded-2xl border border-black/10 bg-brand-50 p-6 text-start">
            <div className="flex items-center justify-between border-b border-black/10 pb-4">
              <span className="text-sm text-black/50">{t("checkout.orderNumber")}</span>
              <span className="font-display text-lg tracking-wide">
                {confirmation.orderNumber}
              </span>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-black/50">{t("checkout.subtotal")}</dt>
                <dd className="tabular-nums">
                  {formatPrice(confirmation.subtotal)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-black/50">{t("checkout.shipping")}</dt>
                <dd className="tabular-nums">
                  {confirmation.shipping === 0
                    ? t("checkout.free")
                    : formatPrice(confirmation.shipping)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-black/10 pt-3 text-base font-semibold">
                <dt>{t("checkout.total")}</dt>
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
            {t("cart.continueShopping")}
            <ArrowRightIcon className="h-4 w-4 rtl:-scale-x-100" />
          </Link>
        </div>
      </div>
    );
  }

  // ---- Empty cart ----
  if (items.length === 0) {
    return (
      <div className="rd-needs-offset min-h-screen bg-bone pt-16">
        <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
          <h1 className="font-display text-4xl uppercase tracking-tight sm:text-5xl">
            {t("checkout.emptyTitle")}
          </h1>
          <p className="mt-3 text-black/60">
            {t("checkout.emptyText")}
          </p>
          <Link
            href="/shop"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-ink px-8 py-4 text-sm font-semibold uppercase tracking-widest text-bone transition-transform hover:scale-105"
          >
            {t("checkout.shopCollection")}
            <ArrowRightIcon className="h-4 w-4 rtl:-scale-x-100" />
          </Link>
        </div>
      </div>
    );
  }

  // ---- Checkout form ----
  const inputClass =
    "w-full rounded-lg border border-black/15 bg-bone px-4 py-3 text-sm focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink";

  return (
    <div className="rd-needs-offset min-h-screen bg-bone pt-16">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="font-display text-4xl uppercase tracking-tight sm:text-5xl">
          {t("checkout.title")}
        </h1>

        {belowMinimum && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {t("checkout.minOrder", { amount: formatPrice(minOrderAmount) })}
          </p>
        )}

        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_400px]">
          {/* form */}
          <form onSubmit={submit} className="space-y-8">
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">
                {t("checkout.contact")}
              </h2>
              <input
                type="tel"
                required
                value={form.phone}
                onChange={set("phone")}
                placeholder={t("checkout.phone")}
                className={`mt-3 ${inputClass}`}
              />
            </section>

            <section>
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">
                {t("checkout.shippingAddress")}
              </h2>
              <div className="mt-3 space-y-3">
                <input
                  required
                  value={form.fullName}
                  onChange={set("fullName")}
                  placeholder={t("checkout.fullName")}
                  className={inputClass}
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <select
                    required
                    value={deliveryZone}
                    onChange={(e) => {
                      const code = e.target.value;
                      setDeliveryZone(code);
                      // Reset the method when the new zone doesn't offer it.
                      const z = zones.find((x) => String(x.code) === code);
                      if (z) {
                        if (deliveryMethod === "home" && !z.methods.home) {
                          setDeliveryMethod("office");
                        } else if (deliveryMethod === "office" && !z.methods.office) {
                          setDeliveryMethod("home");
                        }
                      }
                    }}
                    aria-label={t("checkout.wilayaLabel")}
                    className={inputClass}
                  >
                    <option value="">
                      {zonesError
                        ? t("checkout.wilayaUnavailable")
                        : zones.length === 0
                          ? t("checkout.loadingWilayas")
                          : t("checkout.selectWilaya")}
                    </option>
                    {zones.map((z) => (
                      <option key={z.code} value={String(z.code)}>
                        {z.wilaya}
                        {z.city ? ` — ${z.city}` : ""}
                      </option>
                    ))}
                  </select>
                  <input
                    required
                    value={commune}
                    onChange={(e) => setCommune(e.target.value)}
                    placeholder={t("checkout.commune")}
                    className={inputClass}
                  />
                </div>
                {zonesError && (
                  <p className="text-xs font-medium text-red-600">{zonesError}</p>
                )}
              </div>
            </section>

            {/* Phase 8: delivery method (server-priced, per zone) */}
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">
                {t("checkout.delivery")}
              </h2>
              {!deliveryZone ? (
                <p className="mt-3 rounded-xl border border-black/10 bg-brand-50 px-4 py-4 text-sm text-black/55">
                  {t("checkout.selectWilayaHint")}
                </p>
              ) : selectedZone ? (
                <div className="mt-3 space-y-3">
                  {(["home", "office"] as const).map((m) => {
                    const info = selectedZone.methods[m];
                    const selected = deliveryMethod === m;
                    // Free shipping is BUREAU-ONLY at/above the (cents-
                    // converted) threshold; home always shows the wilaya
                    // price. Until then show the configured price.
                    const free =
                      m === "office" && subtotal >= freeShippingThresholdCents;
                    // Method not offered in this wilaya: keep it visible but
                    // clearly unselectable so the customer understands why.
                    if (!info) {
                      return (
                        <div
                          key={m}
                          aria-disabled="true"
                          className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-black/15 bg-black/[0.03] px-4 py-3.5 opacity-70"
                        >
                          <span className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="deliveryMethod"
                              disabled
                              className="h-4 w-4 accent-ink"
                            />
                            <span>
                              <span className="block text-sm font-semibold uppercase tracking-wide text-black/45">
                                {m === "home"
                                  ? t("checkout.homeDelivery")
                                  : t("checkout.pickupOffice")}
                              </span>
                              <span className="block text-xs text-black/40">
                                {t("checkout.methodUnavailable")}
                              </span>
                            </span>
                          </span>
                          <span className="text-sm font-semibold text-black/35">
                            —
                          </span>
                        </div>
                      );
                    }
                    return (
                      <label
                        key={m}
                        className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3.5 transition-colors ${
                          selected
                            ? "border-ink bg-brand-50"
                            : "border-black/10 hover:border-black/25"
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="deliveryMethod"
                            checked={selected}
                            onChange={() => setDeliveryMethod(m)}
                            className="h-4 w-4 accent-ink"
                          />
                          <span>
                            <span className="block text-sm font-semibold uppercase tracking-wide">
                              {m === "home"
                                ? t("checkout.homeDelivery")
                                : t("checkout.pickupOffice")}
                            </span>
                            <span className="block text-xs text-black/50">
                              {info.estimatedTime || t("checkout.standardTime")}
                            </span>
                          </span>
                        </span>
                        <span className="text-sm font-semibold tabular-nums">
                          {free ? t("checkout.free") : formatPrice(info.price)}
                        </span>
                      </label>
                    );
                  })}
                  {quoteBusy && (
                    <p className="text-xs text-black/40">{t("checkout.updatingShipping")}</p>
                  )}
                  {effectiveQuote?.estimatedTime && !quoteBusy && (
                    <p className="text-xs text-black/50">
                      {t("checkout.estimatedDelivery", {
                        time: effectiveQuote.estimatedTime,
                      })}
                    </p>
                  )}
                </div>
              ) : null}
            </section>

            <section>
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">
                {t("checkout.payment")}
              </h2>
              {codEnabled ? (
                <div className="mt-3 rounded-xl border border-black/10 bg-brand-50 px-4 py-4">
                  <p className="text-sm font-semibold uppercase tracking-wide">
                    {t("checkout.codTitle")}
                  </p>
                  <p className="mt-1 text-sm text-black/55">
                    {t("checkout.codDesc")}
                  </p>
                </div>
              ) : (
                <>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-black/40">
                    <ShieldIcon className="h-3.5 w-3.5" /> {t("checkout.demoNote")}
                  </p>
                  <div className="mt-3 space-y-3">
                    <input
                      value={form.card}
                      onChange={set("card")}
                      placeholder={t("checkout.cardNumber")}
                      inputMode="numeric"
                      className={inputClass}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        value={form.exp}
                        onChange={set("exp")}
                        placeholder={t("checkout.cardExp")}
                        className={inputClass}
                      />
                      <input
                        value={form.cvc}
                        onChange={set("cvc")}
                        placeholder={t("checkout.cardCvc")}
                        inputMode="numeric"
                        className={inputClass}
                      />
                    </div>
                  </div>
                </>
              )}
            </section>

            {error && (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || belowMinimum}
              className="group flex w-full items-center justify-center gap-2 rounded-full bg-ink py-4 text-sm font-semibold uppercase tracking-widest text-bone transition-transform hover:scale-[1.01] disabled:opacity-50"
            >
              {submitting
                ? t("checkout.placingOrder")
                : codEnabled
                  ? t("checkout.placeOrder")
                  : t("checkout.pay", { amount: formatPrice(total) })}
              {!submitting && (
                <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1 rtl:-scale-x-100" />
              )}
            </button>
          </form>

          {/* summary */}
          <div className="lg:sticky lg:top-24 lg:h-fit">
            <div className="rounded-2xl border border-black/10 bg-brand-50 p-6">
              <h2 className="font-display text-lg uppercase tracking-wide">
                {t("checkout.orderSummary")}
              </h2>
              <ul className="mt-4 space-y-4">
                {items.map((item) => (
                  <li key={lineKey(item)} className="flex gap-3">
                    <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-black/5">
                      {item.image && (
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      )}
                      <span className="absolute -end-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-bold text-bone">
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
                  <dt className="text-black/50">{t("checkout.subtotal")}</dt>
                  <dd className="tabular-nums">{formatPrice(subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-black/50">
                    {t("checkout.shipping")}
                    {effectiveQuote && deliveryMethod === "office" && (
                      <span className="block text-[11px] normal-case tracking-normal text-black/40">
                        {t("checkout.pickupOffice")}
                      </span>
                    )}
                    {effectiveQuote && deliveryMethod === "home" && (
                      <span className="block text-[11px] normal-case tracking-normal text-black/40">
                        {t("checkout.homeDelivery")}
                      </span>
                    )}
                  </dt>
                  <dd className="tabular-nums">
                    {quoteBusy ? "…" : shipping === 0 ? t("checkout.free") : formatPrice(shipping)}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-black/10 pt-3 text-base font-semibold">
                  <dt>{t("checkout.total")}</dt>
                  <dd className="font-display text-xl">{formatPrice(total)}</dd>
                </div>
              </dl>
              {!deliveryZone && shipping > 0 && (
                <p className="mt-3 text-xs text-black/40">
                  {t("checkout.freeShipNote", {
                    amount: formatPrice(freeShippingThresholdCents),
                  })}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
