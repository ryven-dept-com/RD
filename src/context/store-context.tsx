"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { formatMoney, isoCurrencyCode } from "@/lib/money";
import { useLanguage } from "@/i18n/language-context";

/**
 * Storefront configuration provided by the server (read from the database in
 * (store)/layout.tsx) to every client component. This is how admin-managed
 * settings (currency, checkout rules, branding, Meta Pixel) reach the
 * storefront without any client-side storage.
 */
export type PixelEventsConfig = {
  pageView: boolean;
  viewContent: boolean;
  addToCart: boolean;
  initiateCheckout: boolean;
  purchase: boolean;
};

export type StoreConfig = {
  storeName: string;
  currency: string;
  logoUrl: string;
  checkoutEnabled: boolean;
  codEnabled: boolean;
  freeShippingThreshold: number;
  minOrderAmount: number;
  requirePhone: boolean;
  requireAddress: boolean;
  pixel: {
    enabled: boolean;
    id: string;
    events: PixelEventsConfig;
  };
};

export const DEFAULT_STORE_CONFIG: StoreConfig = {
  storeName: "RUVEN DEPT",
  currency: "دج",
  logoUrl: "",
  checkoutEnabled: true,
  codEnabled: true,
  freeShippingThreshold: 5000,
  minOrderAmount: 0,
  requirePhone: false,
  requireAddress: true,
  pixel: {
    enabled: false,
    id: "",
    events: {
      pageView: true,
      viewContent: true,
      addToCart: false,
      initiateCheckout: true,
      purchase: true,
    },
  },
};

type StoreContextValue = StoreConfig & {
  /** Format a price (stored in cents) for the current UI language. */
  formatPrice: (cents: number) => string;
  /**
   * ISO-4217 currency code (default DZD) — the ONLY currency value allowed
   * in Meta Pixel/CAPI payloads, the catalog feed and order snapshots.
   * Never send the localized display symbol ("DA"/"دج") to Meta.
   */
  currencyCode: string;
};

const StoreContext = createContext<StoreContextValue | null>(null);



export function StoreConfigProvider({
  config,
  children,
}: {
  config: StoreConfig;
  children: ReactNode;
}) {
  const { locale } = useLanguage();
  const value = useMemo<StoreContextValue>(
    () => ({
      ...config,
      formatPrice: (cents: number) =>
        formatMoney(cents, locale, isoCurrencyCode(config.currency)),
      currencyCode: isoCurrencyCode(config.currency),
    }),
    [config, locale],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStoreConfig(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStoreConfig must be used within StoreConfigProvider");
  return ctx;
}
