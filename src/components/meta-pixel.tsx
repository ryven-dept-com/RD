"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useStoreConfig } from "@/context/store-context";
import { makeEventId } from "@/lib/pixel-events";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
    __fbPixelLoaded?: boolean;
  }
}

/**
 * Fire a Meta Pixel event if the pixel script is loaded. Safe no-op when the
 * pixel is disabled, not configured, or blocked (ad blockers, offline).
 * Only the Pixel ID is ever used client-side — access tokens and other Meta
 * credentials are never stored or shipped to the browser.
 *
 * `eventId` is forwarded as Meta's `eventID` option so browser events can be
 * deduplicated against server-side Conversions API events carrying the same
 * ID (used for Purchase today; available for all events).
 */
export function trackPixelEvent(
  event: string,
  data?: Record<string, unknown>,
  eventId?: string,
) {
  try {
    if (typeof window !== "undefined" && typeof window.fbq === "function") {
      if (eventId) {
        window.fbq("track", event, data ?? {}, { eventID: eventId });
      } else {
        window.fbq("track", event, data ?? {});
      }
    }
  } catch {
    // Tracking must never break the storefront.
  }
}

/** Fire a pre-built event from src/lib/pixel-events.ts. */
export function trackBuiltPixelEvent(built: {
  eventName: string;
  data: Record<string, unknown>;
  eventId: string;
}) {
  trackPixelEvent(built.eventName, built.data, built.eventId);
}

function loadPixelScript(pixelId: string) {
  if (window.__fbPixelLoaded) return;
  window.__fbPixelLoaded = true;

  /* Standard Meta Pixel bootstrap (fbevents.js), adapted to avoid lint
     complaints about inline script strings. */
  if (typeof window.fbq !== "function") {
    const stub = function (...args: unknown[]) {
      stub.callQueue.push(args);
    } as unknown as ((...args: unknown[]) => void) & { callQueue: unknown[] };
    stub.callQueue = [];
    window.fbq = stub;
    window._fbq = stub;
  }

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  script.onerror = () => {
    // Network blocked (ad blocker / offline) — keep the store working.
  };
  document.head.appendChild(script);

  window.fbq("init", pixelId);
}

/**
 * Loads the Meta Pixel when enabled in Admin → Settings → Marketing and
 * tracks PageView on every client-side navigation. All other standard
 * events (ViewContent, AddToCart, InitiateCheckout, Purchase) are fired
 * from their respective storefront components via trackPixelEvent().
 */
export function MetaPixel() {
  const { pixel } = useStoreConfig();
  const pathname = usePathname();
  const initializedFor = useRef("");

  useEffect(() => {
    if (!pixel.enabled || !pixel.id) return;
    loadPixelScript(pixel.id);
    initializedFor.current = pixel.id;
  }, [pixel.enabled, pixel.id]);

  useEffect(() => {
    if (!pixel.enabled || !pixel.id || !pixel.events.pageView) return;
    if (typeof window.fbq !== "function") return;
    try {
      window.fbq("track", "PageView", {}, { eventID: makeEventId() });
    } catch {
      // ignore
    }
  }, [pathname, pixel.enabled, pixel.id, pixel.events.pageView]);

  return null;
}
