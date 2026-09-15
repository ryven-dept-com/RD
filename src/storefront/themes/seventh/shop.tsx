import Link from "next/link";
import {
  DesktopFilters,
  MobileFilters,
  SearchBar,
  SortSelect,
} from "@/app/(store)/shop/shop-controls";
import type { ShopProps } from "@/storefront/types";
import { SeventhCard } from "./card";

/**
 * BLOCK SEVEN shop — the drop wall: a loud framed header slab, chunky
 * toolbar and a dense grid of poster plates. Same filters/sort/search
 * machinery as every other storefront, composed like a streetwear lookbook.
 */
export function SeventhShop({ data, tr, fmt }: ShopProps) {
  const { products, options, heading, categoryDescription } = data;

  return (
    <div className="rd-needs-offset bg-bone pt-16">
      {/* header slab */}
      <div className="border-b-[3px] border-ink bg-amber text-bone">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <nav className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-bone/70">
            <Link href="/" className="hover:text-bone">{tr("shop.home")}</Link>
            <span aria-hidden>▮</span>
            <span className="text-bone">{heading}</span>
          </nav>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h1 className="font-display text-4xl uppercase tracking-tight sm:text-6xl">{heading}</h1>
            <span className="border-2 border-bone px-3 py-1.5 font-display text-sm tabular-nums">
              {products.length} {products.length === 1 ? tr("shop.item") : tr("shop.items")}
            </span>
          </div>
          {categoryDescription && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-bone/80">
              {categoryDescription}
            </p>
          )}
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <DesktopFilters options={options} />

        <div className="min-w-0 flex-1">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b-2 border-ink pb-4">
            <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:flex-1">
              <MobileFilters options={options} />
              <SearchBar className="max-w-md flex-1" />
            </div>
            <SortSelect resultCount={products.length} />
          </div>

          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 border-[3px] border-ink bg-brand-50 py-24 text-center">
              <p className="font-display text-3xl uppercase tracking-wide">{tr("shop.nothingHere")}</p>
              <p className="max-w-sm text-sm text-brand-400">{tr("shop.noResults")}</p>
              <Link
                href="/shop"
                className="rd-cta border-[3px] border-ink bg-ink px-6 py-3 text-xs font-bold uppercase tracking-widest text-bone transition-colors hover:bg-olive hover:text-ink"
              >
                {tr("shop.viewAll")}
              </Link>
            </div>
          ) : (
            <div className="rd-shop-products grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3">
              {products.map((p, i) => (
                <SeventhCard key={p.slug} product={p} tr={tr} fmt={fmt} index={i} priority={i < 3} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
