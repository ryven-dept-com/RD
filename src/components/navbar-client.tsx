"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "@/context/cart-context";
import { useStoreConfig } from "@/context/store-context";
import { useLanguage } from "@/i18n/language-context";
import { SearchBar } from "@/app/(store)/shop/shop-controls";
import { BagIcon, CloseIcon, MenuIcon } from "./icons";
import { LanguageSwitcher } from "./language-switcher";
import { useMobileMenu } from "./use-mobile-menu";

export type NavLink = {
  label: string;
  href: string;
  /** Optional i18n key for SYSTEM links (category names are data — never keyed). */
  systemKey?: string;
};

/**
 * Per-theme navigation identity — the SAME state/search/cart/language logic,
 * expressed as six different headers:
 *   noir      → editorial wide-tracked links, monumental mobile menu
 *   concrete  → industrial tight links with amber hover rule, framed mobile
 *   district  → the house balanced bar
 *   nightshift→ spaced technical links with glow dot, HUD mobile menu
 *   archive   → serif accents, catalog mobile list
 *   signature → whispered small-caps links, airy centered mobile menu
 */
const NAV_THEME = {
  noir: {
    wordmark: "font-display text-xl sm:text-2xl",
    dept: "text-[10px] font-semibold uppercase tracking-[0.5em] opacity-70",
    links: "text-[12px] uppercase tracking-[0.25em] font-semibold",
    mobileLink: "block px-3 py-3.5 font-display text-3xl uppercase tracking-tight hover:opacity-60",
    mobileWrap: "",
  },
  concrete: {
    wordmark: "font-display text-xl font-bold sm:text-2xl",
    dept: "text-[10px] font-bold uppercase tracking-[0.3em] text-amber",
    links: "text-[12px] font-bold uppercase tracking-[0.15em]",
    mobileLink:
      "block border-2 border-ink px-3 py-3 text-sm font-bold uppercase tracking-[0.15em] hover:bg-ink hover:text-bone",
    mobileWrap: "gap-2",
  },
  district: {
    wordmark: "font-display text-xl tracking-tight sm:text-2xl",
    dept: "text-[10px] font-semibold uppercase tracking-[0.25em] opacity-70",
    links: "text-[13px] font-medium uppercase tracking-wide",
    mobileLink:
      "block rounded-lg px-3 py-3 text-sm font-semibold uppercase tracking-wide hover:bg-black/5",
    mobileWrap: "gap-1",
  },
  nightshift: {
    wordmark: "font-display text-xl sm:text-2xl",
    dept: "text-[10px] font-semibold uppercase tracking-[0.4em] text-amber",
    links: "text-[12px] font-semibold uppercase tracking-[0.3em]",
    mobileLink:
      "block rounded-md border border-brand-100 px-3 py-3 text-sm font-semibold uppercase tracking-[0.2em] hover:border-amber",
    mobileWrap: "gap-2",
  },
  archive: {
    wordmark: "font-display text-xl font-medium sm:text-2xl",
    dept: "font-display text-[11px] italic tracking-[0.2em] opacity-70",
    links: "font-display text-[13px] tracking-[0.05em]",
    mobileLink:
      "block border-b border-black/10 px-3 py-3.5 font-display text-lg hover:bg-black/5",
    mobileWrap: "gap-0",
  },
  signature: {
    wordmark: "font-display text-lg font-normal tracking-[0.08em] sm:text-xl",
    dept: "text-[9px] font-medium uppercase tracking-[0.5em] opacity-60",
    links: "text-[11px] font-medium uppercase tracking-[0.35em]",
    mobileLink:
      "block py-4 text-center text-xs font-medium uppercase tracking-[0.35em] hover:opacity-60",
    mobileWrap: "gap-0 divide-y divide-black/10",
  },
  seventh: {
    wordmark: "font-display text-xl uppercase sm:text-2xl",
    dept: "bg-olive px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-ink",
    links: "text-[12px] font-bold uppercase tracking-[0.1em]",
    mobileLink:
      "block border-2 border-ink bg-brand-50 px-3 py-3 font-display text-sm uppercase tracking-[0.08em] hover:bg-olive",
    mobileWrap: "gap-2",
  },
} as const;

export function NavbarClient({ links }: { links: NavLink[] }) {
  const { count, openCart } = useCart();
  const { logoUrl, storeName, theme } = useStoreConfig();
  const navTheme = NAV_THEME[theme] ?? NAV_THEME.district;
  const { locale, t } = useLanguage();
  const pathname = usePathname();
  const label = (l: NavLink) => (l.systemKey ? t(l.systemKey) : l.label);
  const [scrolled, setScrolled] = useState(false);

  // Mobile menu lives in a dedicated state machine (see use-mobile-menu):
  // closed by default, closes on link click / route change / language change
  // / Escape / desktop breakpoint, locks + restores body scroll, and never
  // leaves a stale overlay mounted.
  const menu = useMobileMenu(locale);
  const mobileOpen = menu.open;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const onHome = pathname === "/";
  // transparent over hero only at top of home page
  const transparent = onHome && !scrolled && !mobileOpen;

  return (
    <header
      className={`rd-store-header fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        transparent
          ? "rd-nav-over-hero bg-transparent text-bone"
          : "rd-header-solid bg-bone/90 text-ink backdrop-blur-md border-b border-black/10"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <button
            className="-ms-2 flex h-11 w-11 items-center justify-center lg:hidden"
            onClick={menu.toggle}
            aria-label={t("nav.toggleMenu")}
            aria-expanded={mobileOpen}
            aria-controls="rd-mobile-menu"
          >
            {mobileOpen ? (
              <CloseIcon className="h-6 w-6" />
            ) : (
              <MenuIcon className="h-6 w-6" />
            )}
          </button>

          <Link href="/" className="flex items-baseline gap-1.5" onClick={menu.close}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={storeName}
                className="h-7 w-auto object-contain sm:h-8"
              />
            ) : (
              <>
                <span className={navTheme.wordmark}>RUVEN</span>
                <span className={navTheme.dept}>Dept.</span>
              </>
            )}
          </Link>

          <ul className={`hidden items-center gap-6 lg:flex ${navTheme.links}`}>
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="relative py-1 transition-opacity hover:opacity-60"
                >
                  {label(l)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/shop"
            className="hidden text-[13px] font-medium uppercase tracking-wide transition-opacity hover:opacity-60 sm:block"
          >
            {t("nav.search")}
          </Link>
          <div className="hidden sm:block">
            <LanguageSwitcher compact />
          </div>
          <button
            onClick={openCart}
            className="relative flex h-11 w-11 items-center justify-center rounded-full transition-opacity hover:opacity-70"
            aria-label={t("nav.openCart")}
          >
            <BagIcon className="h-6 w-6" />
            <span
              className={`absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums transition-transform ${
                count > 0 ? "scale-100" : "scale-0"
              } ${transparent ? "bg-bone text-ink" : "bg-ink text-bone"}`}
            >
              {count}
            </span>
          </button>
        </div>
      </nav>

      {/* Mobile menu — search and language first, then navigation links.
          Scrollable when the content is taller than the viewport. The
          container closes on ANY tap inside it: most nav links navigate by
          query string (same pathname), so a click-level close is required —
          pathname-change alone leaves the menu stuck open. `inert` keeps the
          collapsed menu out of the tab order and off the a11y tree. */}
      <div
        id="rd-mobile-menu"
        inert={!mobileOpen}
        aria-hidden={!mobileOpen}
        className={`rd-mobile-menu border-t border-black/10 bg-bone text-ink transition-[max-height] duration-300 lg:hidden ${
          mobileOpen
            ? "max-h-[calc(100svh-4rem)] overflow-y-auto"
            : "max-h-0 overflow-hidden"
        }`}
      >
        <div className="flex flex-col gap-4 px-4 py-4">
          <SearchBar targetPath="/shop" onNavigate={menu.close} />
          {/* language switches re-render without a route change — the menu
              must close explicitly when the visitor picks a language */}
          <div onClick={menu.close}>
            <LanguageSwitcher />
          </div>
          <ul className={`flex flex-col ${navTheme.mobileWrap}`}>
            {links.map((l) => (
              <li key={l.href}>
                {/* closes on click: category links navigate by query string,
                    which never changes usePathname() */}
                <Link href={l.href} className={navTheme.mobileLink} onClick={menu.close}>
                  {label(l)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </header>
  );
}
