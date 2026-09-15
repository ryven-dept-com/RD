import Link from "next/link";
import {
  MobileFilters,
  SearchBar,
  SortSelect,
} from "@/app/(store)/shop/shop-controls";
import type { ShopProps } from "@/storefront/types";
import { SignatureCard } from "./card";

/**
 * SIGNATURE shop — the quiet room: centered heading, one hairline toolbar,
 * a two-column grid with generous air. No sidebar, no noise.
 */
export function SignatureShop({ data, tr, fmt }: ShopProps) {
  const { products, options, heading, categoryDescription } = data;

  return (
    <div className="rd-needs-offset bg-bone pt-16">
      {/* centered heading */}
      <div className="mx-auto max-w-3xl px-4 pb-14 pt-16 text-center sm:px-6">
        <nav className="mb-5 flex items-center justify-center gap-3 text-[11px] uppercase tracking-[0.35em] text-black/40">
          <Link href="/" className="hover:text-ink">{tr("shop.home")}</Link>
          <span aria-hidden>—</span>
          <span className="text-ink">{heading}</span>
        </nav>
        <h1 className="font-display text-5xl font-normal tracking-tight sm:text-6xl">{heading}</h1>
        <p className="mt-4 text-sm text-black/50">
          {tr("shop.subtitle", { count: products.length })}
        </p>
        {categoryDescription && (
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-black/55">{categoryDescription}</p>
        )}
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
        {/* hairline toolbar */}
        <div className="mb-14 flex flex-wrap items-center justify-between gap-4 border-y border-black/10 py-4">
          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:flex-1">
            <MobileFilters options={options} />
            <SearchBar className="max-w-md flex-1" />
          </div>
          <SortSelect resultCount={products.length} />
        </div>

        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-5 py-32 text-center">
            <p className="font-display text-3xl font-normal tracking-wide">{tr("shop.nothingHere")}</p>
            <p className="max-w-sm text-sm text-black/50">{tr("shop.noResults")}</p>
            <Link
              href="/shop"
              className="rd-cta rounded-full border border-black/25 px-8 py-3.5 text-xs font-semibold uppercase tracking-[0.25em] transition-colors hover:bg-black/5"
            >
              {tr("shop.viewAll")}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-6 gap-y-16 lg:grid-cols-3">
            {products.map((p, i) => (
              <SignatureCard key={p.slug} product={p} tr={tr} fmt={fmt} index={i} priority={i < 3} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
