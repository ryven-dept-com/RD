import Link from "next/link";
import {
  DesktopFilters,
  MobileFilters,
  SearchBar,
  SortSelect,
} from "@/app/(store)/shop/shop-controls";
import type { ShopProps } from "@/storefront/types";
import { ArchiveCard } from "./card";

/**
 * ARCHIVE shop — the catalogue room: serif heading with double rules,
 * ledger filter column, framed plates in a measured grid.
 */
export function ArchiveShop({ data, tr, fmt }: ShopProps) {
  const { products, options, heading, categoryDescription } = data;

  return (
    <div className="rd-needs-offset bg-bone pt-16">
      {/* catalogue header */}
      <div className="border-b border-black/15 bg-brand-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <nav className="mb-3 flex items-center gap-2 font-display text-xs italic tracking-[0.2em] text-black/40">
            <Link href="/" className="hover:text-ink">{tr("shop.home")}</Link>
            <span className="text-amber">❦</span>
            <span className="text-ink">{heading}</span>
          </nav>
          <h1 className="font-display text-5xl font-medium tracking-tight sm:text-6xl">{heading}</h1>
          <div className="mt-3 h-px w-44 bg-ink" aria-hidden />
          <div className="mt-1 h-px w-24 bg-ink/50" aria-hidden />
          <p className="mt-4 max-w-xl font-display text-sm italic text-black/50">
            {tr("shop.subtitle", { count: products.length })}
          </p>
          {categoryDescription && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-black/60">{categoryDescription}</p>
          )}
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:px-8">
        <DesktopFilters options={options} />

        <div className="min-w-0 flex-1">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-black/15 pb-4">
            <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:flex-1">
              <MobileFilters options={options} />
              <SearchBar className="max-w-md flex-1" />
            </div>
            <SortSelect resultCount={products.length} />
          </div>

          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 border border-dashed border-black/25 py-24 text-center">
              <p className="font-display text-3xl font-medium tracking-wide">{tr("shop.nothingHere")}</p>
              <p className="max-w-sm text-sm text-black/50">{tr("shop.noResults")}</p>
              <Link
                href="/shop"
                className="rd-cta rounded-full bg-ink px-6 py-3 text-xs font-semibold uppercase tracking-widest text-bone"
              >
                {tr("shop.viewAll")}
              </Link>
            </div>
          ) : (
            <div className="rd-shop-products grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3">
              {products.map((p, i) => (
                <ArchiveCard key={p.slug} product={p} tr={tr} fmt={fmt} index={i} priority={i < 3} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
