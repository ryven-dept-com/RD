"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { formatPriceWithSymbol } from "@/lib/format";

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
  freeShippingThreshold: 15000,
  minOrderAmount: 0,
  requirePhone: false,
  requireAddress: true,
  pixel: {
    enabled: false,
    id: "",
    events: {
      pageView: true,
      viewContent: true,
      addToCart: true,
      initiateCheckout: true,
      purchase: true,
    },
  },
};

type StoreContextValue = StoreConfig & {
  /** Format a price (stored in cents) using the configured currency symbol. */
  formatPrice: (cents: number) => string;
};

const StoreContext = createContext<StoreContextValue | null>(null);



export function StoreConfigProvider({
  config,
  children,
}: {
  config: StoreConfig;
  children: ReactNode;
}) {
  const value = useMemo<StoreContextValue>(
    () => ({
      ...config,
      formatPrice: (cents: number) => formatPriceWithSymbol(cents, config.currency),
    }),
    [config],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStoreConfig(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStoreConfig must be used within StoreConfigProvider");
  return ctx;
}
