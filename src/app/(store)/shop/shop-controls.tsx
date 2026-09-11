"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { CATEGORIES, COLLECTIONS } from "@/lib/seed-data";
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

function FilterBody({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const category = params.get("category") ?? "";
  const collection = params.get("collection") ?? "";
  const filter = params.get("filter") ?? "";

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

  const hasFilters = category || collection || filter;

  const clearAll = () => {
    router.push(pathname, { scroll: false });
    onNavigate?.();
  };

  const rowClass = (active: boolean) =>
    `flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
      active ? "bg-ink text-bone" : "hover:bg-black/5"
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
          {CATEGORIES.map((c) => (
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

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">
          Collection
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {COLLECTIONS.map((c) => (
            <button
              key={c}
              onClick={() => update("collection", c)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                collection === c
                  ? "border-ink bg-ink text-bone"
                  : "border-black/15 hover:border-ink"
              }`}
            >
              {c}
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

export function DesktopFilters() {
  return (
    <aside className="hidden w-56 shrink-0 lg:block">
      <div className="sticky top-24">
        <FilterBody />
      </div>
    </aside>
  );
}

export function MobileFilters() {
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
            <FilterBody onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
