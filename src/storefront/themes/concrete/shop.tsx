import Link from "next/link";
import {
  DesktopFilters,
  MobileFilters,
  SearchBar,
  SortSelect,
} from "@/app/(store)/shop/shop-controls";
import type { ShopProps } from "@/storefront/types";
import { ConcreteCard } from "./card";

/**
 * RAW CONCRETE shop — industrial catalogue: header plate with the unit
 * count stamped on it, a bordered filter column and a tight grid of framed
 * product units.
 */
export function ConcreteShop({ data, tr, fmt }: ShopProps) {
  const { products, options, heading, categoryDescription } = data;

  return (
    <div className="rd-needs-offset bg-bone pt-16">
      {/* header plate */}
      <div className="border-b-2 border-ink bg-brand-50">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4 px-4 py-10 sm:px-6 lg:px-8">
          <div>
            <nav className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.25em] text-black/40">
              <Link href="/" className="hover:text-ink">{tr("shop.home")}</Link>
              <span className="text-amber">▪</span>
              <span className="text-ink">{heading}</span>
            </nav>
            <h1 className="font-display text-5xl uppercase tracking-tight sm:text-6xl">{heading}</h1>
            {categoryDescription && (
              <p className="mt-2 max-w-2xl border-s-2 border-amber ps-3 text-sm leading-relaxed text-black/60">
                {categoryDescription}
              </p>
            )}
          </div>
          {/* unit count plate */}
          <div className="border-2 border-ink px-4 py-2 text-center" aria-hidden="true">
            <p className="font-display text-3xl leading-none">{String(products.length).padStart(2, "0")}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.25em] text-black/50">
              {String(products.length).padStart(3, "0")}
            </p>
          </div>
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
            <div className="flex flex-col items-center justify-center gap-4 border-2 border-dashed border-ink py-24 text-center">
              <p className="font-display text-3xl uppercase tracking-wide">{tr("shop.nothingHere")}</p>
              <p className="max-w-sm text-sm text-black/50">{tr("shop.noResults")}</p>
              <Link
                href="/shop"
                className="rd-cta border-2 border-ink bg-ink px-6 py-3 text-xs font-bold uppercase tracking-widest text-bone transition-colors hover:bg-transparent hover:text-ink"
              >
                {tr("shop.viewAll")}
              </Link>
            </div>
          ) : (
            <div className="rd-shop-products grid grid-cols-2 gap-3 md:grid-cols-3">
              {products.map((p, i) => (
                <ConcreteCard key={p.slug} product={p} tr={tr} fmt={fmt} index={i} priority={i < 3} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
