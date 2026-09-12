"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";
import { CloseIcon } from "@/components/icons";

const SORTS = [
  { value: "featured", label: "Featured" },
  { value: "new", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "rating", label: "Top Rated" },
];

const QUICK = [
  { value: "new", label: "New Arrivals" },
  { value: "best", label: "Best Sellers" },
  { value: "sale", label: "On Sale" },
];

/** Max-price steps (in cents) for the price filter. */
const PRICE_STEPS = [
  { value: 5000, label: "Under $50" },
  { value: 10000, label: "Under $100" },
  { value: 15000, label: "Under $150" },
  { value: 25000, label: "Under $250" },
];

export type ShopFilterOptions = {
  sizes: string[];
  colors: string[];
  /** Active category names from the database (Phase 6). */
  categories: string[];
  /** Distinct collections of active products (Phase 6). */
  collections: string[];
};

export function SortSelect({ resultCount }: { resultCount: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("sort") ?? "featured";

  const onChange = (value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value === "featured") next.delete("sort");
    else next.set("sort", value);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-black/50 sm:inline">
        {resultCount} {resultCount === 1 ? "item" : "items"}
      </span>
      <label className="flex items-center gap-2 text-sm">
        <span className="text-black/50">Sort</span>
        <select
          value={current}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-full border border-black/15 bg-transparent py-2 pl-3 pr-8 text-sm font-medium focus:border-ink focus:outline-none"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

/** Free-text search box (URL-driven, works on every viewport). */
export function SearchBar({ className = "" }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams(params.toString());
    const q = value.trim();
    if (q) next.set("q", q);
    else next.delete("q");
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <form onSubmit={submit} role="search" className={`w-full ${className}`}>
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search products…"
        aria-label="Search products"
        className="w-full rounded-full border border-black/15 bg-transparent px-4 py-2 text-sm placeholder:text-black/35 focus:border-ink focus:outline-none"
      />
    </form>
  );
}

function FilterBody({
  options,
  onNavigate,
}: {
  options: ShopFilterOptions;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const category = params.get("category") ?? "";
  const collection = params.get("collection") ?? "";
  const filter = params.get("filter") ?? "";
  const size = params.get("size") ?? "";
  const color = params.get("color") ?? "";
  const inStock = params.get("inStock") === "1";
  const maxPrice = Number(params.get("maxPrice") ?? "") || 0;

  const update = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (!value || next.get(key) === value) next.delete(key);
      else next.set(key, value);
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
      onNavigate?.();
    },
    [params, pathname, router, onNavigate],
  );

  const hasFilters = category || collection || filter || size || color || inStock || maxPrice;

  const clearAll = () => {
    // Preserve the search query when clearing facet filters.
    const next = new URLSearchParams();
    const q = params.get("q");
    if (q) next.set("q", q);
    router.push(
      next.size ? `${pathname}?${next.toString()}` : pathname,
      { scroll: false },
    );
    onNavigate?.();
  };

  const rowClass = (active: boolean) =>
    `flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
      active ? "bg-ink text-bone" : "hover:bg-black/5"
    }`;

  const chipClass = (active: boolean, disabled = false) =>
    `rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
      active
        ? "border-ink bg-ink text-bone"
        : disabled
          ? "cursor-not-allowed border-black/10 text-black/25"
          : "border-black/15 hover:border-ink"
    }`;

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">
            Category
          </h3>
          {hasFilters && (
            <button
              onClick={clearAll}
              className="text-xs font-medium text-black/40 underline-offset-2 hover:text-ink hover:underline"
            >
              Clear all
            </button>
          )}
        </div>
        <div className="mt-3 space-y-1">
          <button
            onClick={() => update("category", "")}
            className={rowClass(!category)}
          >
            All Products
          </button>
          {options.categories.map((c) => (
            <button
              key={c}
              onClick={() => update("category", c)}
              className={rowClass(category === c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {options.collections.length > 0 && (
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">
          Collection
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {options.collections.map((c) => (
            <button
              key={c}
              onClick={() => update("collection", c)}
              className={chipClass(collection === c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      )}

      {/* Phase 5: size */}
      {options.sizes.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">
            Size
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {options.sizes.map((s) => (
              <button
                key={s}
                onClick={() => update("size", s)}
                className={chipClass(size === s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Phase 5: color */}
      {options.colors.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">
            Color
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {options.colors.map((c) => (
              <button
                key={c}
                onClick={() => update("color", c)}
                className={chipClass(color === c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Phase 5: availability */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">
          Availability
        </h3>
        <div className="mt-3 space-y-1">
          <button onClick={() => update("inStock", "")} className={rowClass(!inStock)}>
            All items
          </button>
          <button onClick={() => update("inStock", "1")} className={rowClass(inStock)}>
            In stock only
          </button>
        </div>
      </div>

      {/* Phase 5: price */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">
          Price
        </h3>
        <div className="mt-3 space-y-1">
          <button onClick={() => update("maxPrice", "")} className={rowClass(!maxPrice)}>
            Any price
          </button>
          {PRICE_STEPS.map((p) => (
            <button
              key={p.value}
              onClick={() => update("maxPrice", String(p.value))}
              className={rowClass(maxPrice === p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">
          Highlights
        </h3>
        <div className="mt-3 space-y-1">
          {QUICK.map((q) => (
            <button
              key={q.value}
              onClick={() => update("filter", q.value)}
              className={rowClass(filter === q.value)}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DesktopFilters({ options }: { options: ShopFilterOptions }) {
  return (
    <aside className="hidden w-56 shrink-0 lg:block">
      <div className="sticky top-24">
        <FilterBody options={options} />
      </div>
    </aside>
  );
}

export function MobileFilters({ options }: { options: ShopFilterOptions }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-full border border-black/15 px-4 py-2 text-sm font-medium lg:hidden"
      >
        Filters
      </button>
      {open && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85%] animate-fade-in overflow-y-auto bg-bone p-5">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-display text-lg uppercase tracking-wide">
                Filters
              </h2>
              <button onClick={() => setOpen(false)} aria-label="Close filters">
                <CloseIcon className="h-6 w-6" />
              </button>
            </div>
            <FilterBody options={options} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
