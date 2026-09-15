import Link from "next/link";
import {
  DesktopFilters,
  MobileFilters,
  SearchBar,
  SortSelect,
} from "@/app/(store)/shop/shop-controls";
import type { ShopProps } from "@/storefront/types";
import { AtelierCard } from "./card";

/**
 * ATELIER shop — the collection index: an airy editorial header with a
 * trailing-dot heading, a hairline toolbar and a calm lookbook grid.
 * Same filter/sort/search machinery as every other storefront.
 */
export function AtelierShop({ data, tr, fmt }: ShopProps) {
  const { products, options, heading, categoryDescription } = data;

  return (
    <div className="rd-needs-offset bg-bone pt-16">
      {/* editorial header */}
      <div className="border-b border-black/10">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <nav className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-400">
            <Link href="/" className="transition-colors hover:text-ink">{tr("shop.home")}</Link>
            <span aria-hidden>/</span>
            <span className="text-ink">{heading}</span>
          </nav>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h1 className="font-display text-4xl uppercase tracking-tight text-ink sm:text-6xl">
              {heading}
              <span className="at-dot" aria-hidden>.</span>
            </h1>
            <span className="pb-1 text-xs font-semibold uppercase tracking-[0.25em] text-brand-400 tabular-nums">
              {products.length} {products.length === 1 ? tr("shop.item") : tr("shop.items")}
            </span>
          </div>
          {categoryDescription && (
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-brand-500">
              {categoryDescription}
            </p>
          )}
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <DesktopFilters options={options} />

        <div className="min-w-0 flex-1">
          <div className="mb-7 flex flex-wrap items-center justify-between gap-4 border-b border-black/10 pb-4">
            <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:flex-1">
              <MobileFilters options={options} />
              <SearchBar className="max-w-md flex-1" />
            </div>
            <SortSelect resultCount={products.length} />
          </div>

          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 border border-black/15 bg-brand-50 py-24 text-center">
              <p className="font-display text-3xl uppercase tracking-tight">
                {tr("shop.nothingHere")}
                <span className="at-dot" aria-hidden>.</span>
              </p>
              <p className="max-w-sm text-sm text-brand-400">{tr("shop.noResults")}</p>
              <Link
                href="/shop"
                className="rd-cta rounded-full bg-ink px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.18em] text-bone transition-opacity hover:opacity-85"
              >
                {tr("shop.viewAll")}
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-5 md:grid-cols-3">
              {products.map((p, i) => (
                <AtelierCard key={p.slug} product={p} tr={tr} fmt={fmt} index={i} priority={i < 3} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
