"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  initialMenuState,
  menuReducer,
  type MenuAction,
  type MenuState,
} from "./mobile-menu-state";

export { initialMenuState, menuReducer };
export type { MenuAction, MenuState };

/**
 * Mobile menu state machine — the root-cause fix for the "stuck menu" bug.
 *
 * Root causes of the stuck menu (all fixed here, no z-index/CSS hacks):
 *
 *  1. Same-page navigation never closed the menu. The old logic closed only
 *     when usePathname() changed — but category/filter links navigate by
 *     QUERY STRING (/shop?category=…) and pathname excludes the search
 *     string, so the menu stayed open on most navigation.
 *     → The menu now closes on ANY link click (explicit), with pathname
 *       change kept as a backstop.
 *  2. Changing language re-rendered the page without changing the route, so
 *     the open menu survived the switch.
 *     → localeChange() closes the menu.
 *  3. There was no way out: no outside-tap-to-close, no Escape key.
 *     → close() is wired to Escape.
 *  4. Rotating/resizing to desktop hid the menu via lg:hidden while the open
 *     state stayed true — shrinking back made the menu re-cover the page.
 *     → a matchMedia listener force-closes at the desktop breakpoint.
 *  5. The page behind the menu kept its own scroll, producing double-scroll
 *     and the impression of a detached overlay.
 *     → body scroll is locked while open and ALWAYS restored on close and
 *       on unmount (cleanup), so no session can end with body overflow
 *       locked or an invisible overlay mounted.
 *
 * The reducer is a pure function so the full close-matrix is unit-tested
 * without a browser.
 */

const DESKTOP_QUERY = "(min-width: 1024px)";

export function useMobileMenu(localeKey?: string) {
  const [state, dispatch] = useReducer(menuReducer, initialMenuState);
  const open = state.open;

  // Backstop: hard route changes always close the menu (covers deep links,
  // back/forward and programmatic navigation).
  const pathname = usePathname();
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      dispatch({ type: "navigate" });
    }
  }, [pathname]);

  // Language switches re-render without a route change — close explicitly.
  const lastLocale = useRef(localeKey);
  useEffect(() => {
    if (lastLocale.current !== localeKey) {
      lastLocale.current = localeKey;
      dispatch({ type: "localeChange" });
    }
  }, [localeKey]);

  // Escape closes; only bound while open (no global listener otherwise).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dispatch({ type: "escape" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Reaching the desktop breakpoint while open must not leave a hidden-open
  // menu that re-appears when the viewport shrinks again.
  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) dispatch({ type: "viewportDesktop" });
    };
    if (mql.matches) dispatch({ type: "viewportDesktop" });
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Body scroll lock while open — always restored on close/unmount, so the
  // page can never end up with a locked body or a stale overlay.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const toggle = useCallback(() => dispatch({ type: "toggle" }), []);
  const close = useCallback(() => dispatch({ type: "close" }), []);
  const openMenu = useCallback(() => dispatch({ type: "open" }), []);

  return { open, toggle, close, openMenu };
}
