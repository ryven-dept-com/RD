import Link from "next/link";
import { CheckoutClient } from "./checkout-client";
import { getStoreSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata = { title: "Checkout" };

/**
 * Server entry for checkout. Reads Admin → Settings → Checkout from the
 * database: when checkout is disabled the order flow is blocked here (the
 * checkout API enforces the same rule server-side).
 */
export default async function CheckoutPage() {
  let checkoutEnabled = true;
  try {
    const store = await getStoreSettings();
    checkoutEnabled = store.checkoutEnabled;
  } catch {
    // database unavailable — keep the default behaviour
  }

  if (!checkoutEnabled) {
    return (
      <div className="min-h-screen bg-bone pt-16">
        <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
          <h1 className="font-display text-4xl uppercase tracking-tight sm:text-5xl">
            Checkout unavailable
          </h1>
          <p className="mt-3 text-black/60">
            We are not accepting orders right now. Please check back soon.
          </p>
          <Link
            href="/shop"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-ink px-8 py-4 text-sm font-semibold uppercase tracking-widest text-bone transition-transform hover:scale-105"
          >
            Back to shop
          </Link>
        </div>
      </div>
    );
  }

  return <CheckoutClient />;
}
