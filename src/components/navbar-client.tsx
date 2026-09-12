"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "@/context/cart-context";
import { useStoreConfig } from "@/context/store-context";
import { useT } from "@/i18n/language-context";
import { BagIcon, CloseIcon, MenuIcon } from "./icons";
import { LanguageSwitcher } from "./language-switcher";

export type NavLink = {
  label: string;
  href: string;
  /** Optional i18n key for SYSTEM links (category names are data — never keyed). */
  systemKey?: string;
};

export function NavbarClient({ links }: { links: NavLink[] }) {
  const { count, openCart } = useCart();
  const { logoUrl, storeName } = useStoreConfig();
  const t = useT();
  const pathname = usePathname();
  const label = (l: NavLink) => (l.systemKey ? t(l.systemKey) : l.label);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu on navigation. Adjusting state during render (the
  // React-recommended pattern) avoids an extra committed render that a
  // useEffect-based reset would cause.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setMobileOpen(false);
  }

  const onHome = pathname === "/";
  // transparent over hero only at top of home page
  const transparent = onHome && !scrolled && !mobileOpen;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        transparent
          ? "bg-transparent text-bone"
          : "bg-bone/90 text-ink backdrop-blur-md border-b border-black/10"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <button
            className="lg:hidden -ms-1 p-1"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={t("nav.toggleMenu")}
          >
            {mobileOpen ? (
              <CloseIcon className="h-6 w-6" />
            ) : (
              <MenuIcon className="h-6 w-6" />
            )}
          </button>

          <Link href="/" className="flex items-baseline gap-1.5">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={storeName}
                className="h-7 w-auto object-contain sm:h-8"
              />
            ) : (
              <>
                <span className="font-display text-xl tracking-tight sm:text-2xl">
                  RUVEN
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.25em] opacity-70">
                  Dept.
                </span>
              </>
            )}
          </Link>

          <ul className="hidden items-center gap-6 text-[13px] font-medium uppercase tracking-wide lg:flex">
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
            className="relative flex items-center gap-2 rounded-full px-1 py-1 transition-opacity hover:opacity-70"
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

      {/* Mobile menu */}
      <div
        className={`overflow-hidden border-t border-black/10 bg-bone text-ink transition-[max-height] duration-300 lg:hidden ${
          mobileOpen ? "max-h-[30rem]" : "max-h-0"
        }`}
      >
        <ul className="flex flex-col gap-1 px-4 py-4">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="block rounded-lg px-3 py-3 text-sm font-semibold uppercase tracking-wide hover:bg-black/5"
              >
                {label(l)}
              </Link>
            </li>
          ))}
          <li className="px-3 pt-2">
            <LanguageSwitcher compact />
          </li>
        </ul>
      </div>
    </header>
  );
}
