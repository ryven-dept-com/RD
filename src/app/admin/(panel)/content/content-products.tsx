"use client";

import { useMemo, useState } from "react";
import type { ProductListItem } from "@/lib/cms";
import {
  Notify,
  ReorderButtons,
  SaveBar,
  SectionCard,
  useSectionState,
} from "./content-ui";

export type ProductOption = { id: number; name: string; image: string };

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function ProductListEditor({
  title,
  subtitle,
  group,
  initial,
  products,
  notify,
  onDirtyChange,
}: {
  title: string;
  subtitle: string;
  group: "featured" | "newArrivals";
  initial: ProductListItem[];
  products: ProductOption[];
  notify: Notify;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { draft, setDraft, dirty, saving, error, save, discard } =
    useSectionState<{ items: ProductListItem[] }>(
      { items: initial.map((i) => ({ productId: i.productId })) },
      group,
      notify,
      onDirtyChange,
    );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");

  const byId = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  const available = useMemo(() => {
    const selected = new Set(draft.items.map((i) => i.productId));
    const q = query.trim().toLowerCase();
    return products.filter(
      (p) => !selected.has(p.id) && (!q || p.name.toLowerCase().includes(q)),
    );
  }, [products, draft.items, query]);

  return (
    <SectionCard title={title} subtitle={subtitle}>
      {draft.items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
          No products selected — the storefront currently falls back to the
          automatic list. Add products below to curate it manually.
        </p>
      ) : (
        <ul className="space-y-2">
          {draft.items.map((item, i) => {
            const p = byId.get(item.productId);
            return (
              <li
                key={`${item.productId}-${i}`}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5"
              >
                <span className="w-5 shrink-0 text-center text-sm font-semibold text-slate-400">
                  {i + 1}
                </span>
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                  {p?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
                  {p?.name ?? `Product #${item.productId} (missing)`}
                </p>
                <ReorderButtons
                  index={i}
                  total={draft.items.length}
                  onMove={(from, to) =>
                    setDraft((d) => ({ items: move(d.items, from, to) }))
                  }
                />
                <button
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({
                      items: d.items.filter((_, idx) => idx !== i),
                    }))
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 text-rose-600 transition-colors hover:bg-rose-50"
                  aria-label="Remove product"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="w-full rounded-xl border-2 border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50"
      >
        + Add products from catalogue
      </button>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      <SaveBar dirty={dirty} saving={saving} onSave={() => void save()} onDiscard={discard} />

      {/* product picker modal */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <div
            className="absolute inset-0 bg-slate-900/60"
            onClick={() => setPickerOpen(false)}
            aria-hidden
          />
          <div className="relative flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-h-[80dvh] sm:max-w-lg sm:rounded-2xl">
            <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Add products</h3>
                <button
                  onClick={() => setPickerOpen(false)}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                  aria-label="Close product picker"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products…"
                className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
              />
            </div>
            <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
              {available.length === 0 ? (
                <li className="px-5 py-10 text-center text-sm text-slate-400">
                  No matching products.
                </li>
              ) : (
                available.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((d) => ({
                          items: [...d.items, { productId: p.id }],
                        }))
                      }
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50 sm:px-5"
                    >
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                        {p.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.image}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                        {p.name}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">
                        + Add
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
