import Link from "next/link";
import {
  DesktopFilters,
  MobileFilters,
  SearchBar,
  SortSelect,
} from "@/app/(store)/shop/shop-controls";
import type { ShopProps } from "@/storefront/types";
import { NightshiftCard } from "./card";

/**
 * NIGHT SHIFT shop — the night catalogue: glowing-underline header, dark
 * filter column, a stage-lit four-column grid on wide screens.
 */
export function NightshiftShop({ data, tr, fmt }: ShopProps) {
  const { products, options, heading, categoryDescription } = data;

  return (
    <div className="rd-needs-offset bg-bone pt-16">
      <div className="border-b border-brand-100 bg-brand-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <nav className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-brand-400">
            <Link href="/" className="hover:text-ink">{tr("shop.home")}</Link>
            <span className="text-amber">◦</span>
            <span className="text-ink">{heading}</span>
          </nav>
          <h1 className="font-display text-5xl uppercase tracking-tight sm:text-6xl">{heading}</h1>
          <div className="ns-underline mt-4 h-px w-40 bg-gradient-to-r from-amber to-transparent" aria-hidden />
          <p className="mt-3 max-w-xl text-sm text-brand-400">
            {tr("shop.subtitle", { count: products.length })}
          </p>
          {categoryDescription && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-brand-500">{categoryDescription}</p>
          )}
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:px-8">
        <DesktopFilters options={options} />

        <div className="min-w-0 flex-1">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:flex-1">
              <MobileFilters options={options} />
              <SearchBar className="max-w-md flex-1" />
            </div>
            <SortSelect resultCount={products.length} />
          </div>

          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-brand-100 py-24 text-center">
              <p className="font-display text-3xl uppercase tracking-wide">{tr("shop.nothingHere")}</p>
              <p className="max-w-sm text-sm text-brand-400">{tr("shop.noResults")}</p>
              <Link
                href="/shop"
                className="rd-cta rounded-full bg-ink px-6 py-3 text-xs font-semibold uppercase tracking-widest text-bone"
              >
                {tr("shop.viewAll")}
              </Link>
            </div>
          ) : (
            <div className="rd-shop-products grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 xl:grid-cols-4">
              {products.map((p, i) => (
                <NightshiftCard key={p.slug} product={p} tr={tr} fmt={fmt} index={i} priority={i < 4} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
