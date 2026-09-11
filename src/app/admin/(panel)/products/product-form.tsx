"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "@/context/admin-context";

export type ProductFormData = {
  id?: number;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  price: string; // DZD-cents input as decimal string
  compareAtPrice: string;
  category: string;
  collection: string;
  stock: string;
  images: string; // newline separated
  sizes: string; // comma separated
  colors: string; // comma separated
  details: string; // newline separated
  featured: boolean;
  isNew: boolean;
  bestSeller: boolean;
  onSale: boolean;
  soldOut: boolean;
  active: boolean;
};

export const EMPTY_PRODUCT: ProductFormData = {
  name: "",
  slug: "",
  tagline: "",
  description: "",
  price: "",
  compareAtPrice: "",
  category: "",
  collection: "",
  stock: "50",
  images: "",
  sizes: "",
  colors: "",
  details: "",
  featured: false,
  isNew: false,
  bestSeller: false,
  onSale: false,
  soldOut: false,
  active: true,
};

export function ProductForm({
  initial,
  categories,
  mode,
}: {
  initial: ProductFormData;
  categories: string[];
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const { adminFetch } = useAdmin();
  const [form, setForm] = useState<ProductFormData>(initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof ProductFormData>(
    key: K,
    value: ProductFormData[K],
  ) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !form.category.trim() || !form.price) {
      setError("Name, category and price are required.");
      return;
    }
    setSaving(true);
    const url =
      mode === "create"
        ? "/api/admin/products"
        : `/api/admin/products/${form.id}`;
    const method = mode === "create" ? "POST" : "PUT";

    const res = await adminFetch(url, {
      method,
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok && data.ok) {
      router.push("/admin/products");
      router.refresh();
    } else {
      setError(data.error ?? "Failed to save product.");
    }
  };

  const field =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900";
  const labelCls =
    "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500";

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Basic info</h2>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Name *</label>
              <input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className={field}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Slug (URL)</label>
                <input
                  value={form.slug}
                  onChange={(e) => set("slug", e.target.value)}
                  placeholder="auto-generated if empty"
                  className={field}
                />
              </div>
              <div>
                <label className={labelCls}>Collection</label>
                <input
                  value={form.collection}
                  onChange={(e) => set("collection", e.target.value)}
                  className={field}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Tagline</label>
              <input
                value={form.tagline}
                onChange={(e) => set("tagline", e.target.value)}
                className={field}
              />
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={4}
                className={field}
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-1 font-semibold text-slate-900">Media</h2>
          <p className="mb-4 text-xs text-slate-400">
            One image URL per line. Multiple images supported.
          </p>
          <textarea
            value={form.images}
            onChange={(e) => set("images", e.target.value)}
            rows={4}
            placeholder="https://…/image-1.jpg&#10;https://…/image-2.jpg"
            className={field}
          />
          {form.images.trim() && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {form.images
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean)
                .slice(0, 6)
                .map((src, i) => (
                  <div
                    key={i}
                    className="h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Variants & details</h2>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Sizes (comma separated)</label>
                <input
                  value={form.sizes}
                  onChange={(e) => set("sizes", e.target.value)}
                  placeholder="S, M, L, XL"
                  className={field}
                />
              </div>
              <div>
                <label className={labelCls}>Colors (comma separated)</label>
                <input
                  value={form.colors}
                  onChange={(e) => set("colors", e.target.value)}
                  placeholder="Onyx, Bone"
                  className={field}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Details (one per line)</label>
              <textarea
                value={form.details}
                onChange={(e) => set("details", e.target.value)}
                rows={3}
                className={field}
              />
            </div>
          </div>
        </div>
      </div>

      {/* side column */}
      <div className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Pricing & stock</h2>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Price (دج) *</label>
              <input
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                inputMode="decimal"
                className={field}
                required
              />
            </div>
            <div>
              <label className={labelCls}>Old price (دج)</label>
              <input
                value={form.compareAtPrice}
                onChange={(e) => set("compareAtPrice", e.target.value)}
                inputMode="decimal"
                className={field}
              />
            </div>
            <div>
              <label className={labelCls}>Stock</label>
              <input
                value={form.stock}
                onChange={(e) => set("stock", e.target.value)}
                inputMode="numeric"
                className={field}
              />
            </div>
            <div>
              <label className={labelCls}>Category *</label>
              <input
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                list="admin-categories"
                className={field}
                required
              />
              <datalist id="admin-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Flags</h2>
          <div className="space-y-3">
            {(
              [
                ["isNew", "Mark as New"],
                ["onSale", "Mark as Sale"],
                ["featured", "Mark as Featured"],
                ["bestSeller", "Mark as Best Seller"],
                ["soldOut", "Mark as Sold Out"],
                ["active", "Active (visible in store)"],
              ] as [keyof ProductFormData, string][]
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex cursor-pointer items-center justify-between text-sm text-slate-700"
              >
                {label}
                <input
                  type="checkbox"
                  checked={Boolean(form[key])}
                  onChange={(e) => set(key, e.target.checked as never)}
                  className="h-4 w-4 rounded border-slate-300 accent-slate-900"
                />
              </label>
            ))}
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : mode === "create" ? "Create product" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/products")}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
