"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useAdmin } from "@/context/admin-context";
import { MediaPicker } from "@/components/admin/media-picker";

export type VariantRow = {
  size: string;
  color: string;
  sku: string;
  stock: string;
  active: boolean;
};

export type ProductFormData = {
  id?: number;
  name: string;
  slug: string;
  sku: string;
  tagline: string;
  description: string;
  price: string; // DZD-cents input as decimal string
  compareAtPrice: string;
  category: string;
  collection: string;
  stock: string; // initial total stock (split across generated variants)
  status: "draft" | "active" | "archived";
  sortOrder: string;
  images: string[]; // ordered; first is the primary image
  sizes: string; // comma separated (feeds variant generation)
  colors: string; // comma separated (feeds variant generation)
  details: string; // newline separated
  featured: boolean;
  isNew: boolean;
  bestSeller: boolean;
  onSale: boolean;
  variants: VariantRow[];
};

export const EMPTY_PRODUCT: ProductFormData = {
  name: "",
  slug: "",
  sku: "",
  tagline: "",
  description: "",
  price: "",
  compareAtPrice: "",
  category: "",
  collection: "",
  stock: "50",
  status: "active",
  sortOrder: "0",
  images: [],
  sizes: "",
  colors: "",
  details: "",
  featured: false,
  isNew: false,
  bestSeller: false,
  onSale: false,
  variants: [],
};

function variantKey(v: VariantRow): string {
  return `${v.size.trim().toLowerCase()}\u0000${v.color.trim().toLowerCase()}`;
}

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

  const setVariant = (index: number, patch: Partial<VariantRow>) =>
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v, i) => (i === index ? { ...v, ...patch } : v)),
    }));

  // Flag duplicate size × color combinations so admins can fix them before
  // the server rejects the save.
  const duplicateKeys = new Set<string>();
  const seenKeys = new Set<string>();
  for (const v of form.variants) {
    const key = variantKey(v);
    if (seenKeys.has(key)) duplicateKeys.add(key);
    seenKeys.add(key);
  }

  const generateMatrix = () => {
    const sizes = form.sizes
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const colors = form.colors
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    if (!sizes.length || !colors.length) {
      setError("Add sizes and colors first, then generate the variant matrix.");
      return;
    }
    setError("");
    const rows: VariantRow[] = [];
    for (const s of sizes) {
      for (const c of colors) {
        if (form.variants.some((v) => v.size === s && v.color === c)) continue;
        rows.push({ size: s, color: c, sku: "", stock: "0", active: true });
      }
    }
    if (!rows.length) {
      setError("All size × color combinations already exist as variants.");
      return;
    }
    setForm((f) => ({ ...f, variants: [...f.variants, ...rows] }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !form.category.trim() || !form.price) {
      setError("Name, category and price are required.");
      return;
    }
    if (duplicateKeys.size) {
      setError("Duplicate variants: the same size/color combination appears more than once.");
      return;
    }
    setSaving(true);
    const url =
      mode === "create"
        ? "/api/admin/products"
        : `/api/admin/products/${form.id}`;
    const method = mode === "create" ? "POST" : "PUT";

    const payload = {
      ...form,
      active: form.status === "active",
      sortOrder: Number(form.sortOrder) || 0,
      images: form.images.join("\n"),
      variants: form.variants.map((v) => ({
        size: v.size,
        color: v.color,
        sku: v.sku,
        stock: Number(v.stock) || 0,
        active: v.active,
      })),
    };

    const res = await adminFetch(url, {
      method,
      body: JSON.stringify(payload),
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

  const totalStock = form.variants.reduce(
    (sum, v) => sum + (Number(v.stock) || 0),
    0,
  );

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
                <label className={labelCls}>SKU</label>
                <input
                  value={form.sku}
                  onChange={(e) => set("sku", e.target.value)}
                  placeholder="e.g. RVN-HD-001"
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

        <ImageListEditor
          images={form.images}
          onChange={(images) => set("images", images)}
        />

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-900">Variants</h2>
            <span className="text-xs text-slate-400">
              {form.variants.length} variants · {totalStock} in stock
            </span>
          </div>
          <p className="mb-4 text-xs text-slate-400">
            Each size × color combination gets its own SKU and stock. Duplicate
            combinations are rejected.
          </p>

          {form.variants.length > 0 && (
            <div className="mb-4 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2 font-medium">Size</th>
                    <th className="px-3 py-2 font-medium">Color</th>
                    <th className="px-3 py-2 font-medium">SKU</th>
                    <th className="px-3 py-2 font-medium">Stock</th>
                    <th className="px-3 py-2 font-medium">Active</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {form.variants.map((v, i) => {
                    const isDup = duplicateKeys.has(variantKey(v));
                    return (
                      <tr key={i} className="border-b border-slate-50 last:border-0">
                        <td className="px-3 py-2">
                          <input
                            value={v.size}
                            onChange={(e) => setVariant(i, { size: e.target.value })}
                            className={`w-20 rounded border px-2 py-1.5 text-sm focus:outline-none ${
                              isDup ? "border-rose-300 bg-rose-50" : "border-slate-200"
                            }`}
                            placeholder="M"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={v.color}
                            onChange={(e) => setVariant(i, { color: e.target.value })}
                            className={`w-28 rounded border px-2 py-1.5 text-sm focus:outline-none ${
                              isDup ? "border-rose-300 bg-rose-50" : "border-slate-200"
                            }`}
                            placeholder="Onyx"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={v.sku}
                            onChange={(e) => setVariant(i, { sku: e.target.value })}
                            className="w-36 rounded border border-slate-200 px-2 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
                            placeholder="auto"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={v.stock}
                            onChange={(e) => setVariant(i, { stock: e.target.value })}
                            inputMode="numeric"
                            className="w-20 rounded border border-slate-200 px-2 py-1.5 text-sm tabular-nums focus:border-slate-900 focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={v.active}
                            onChange={(e) => setVariant(i, { active: e.target.checked })}
                            className="h-4 w-4 rounded border-slate-300 accent-slate-900"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                variants: f.variants.filter((_, j) => j !== i),
                              }))
                            }
                            className="rounded border border-rose-200 px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  variants: [
                    ...f.variants,
                    { size: "", color: "", sku: "", stock: "0", active: true },
                  ],
                }))
              }
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              + Add variant
            </button>
            <button
              type="button"
              onClick={generateMatrix}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              title="Create missing variants from the Sizes × Colors fields below"
            >
              Generate from sizes × colors
            </button>
          </div>

          {duplicateKeys.size > 0 && (
            <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              Duplicate size/color combination — please remove or change the
              highlighted variants before saving.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Options & details</h2>
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
              <label className={labelCls}>
                {form.variants.length
                  ? "Total stock (from variants)"
                  : "Stock"}
              </label>
              {form.variants.length ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm tabular-nums text-slate-600">
                  {totalStock} — sum of variant stock
                </p>
              ) : (
                <>
                  <input
                    value={form.stock}
                    onChange={(e) => set("stock", e.target.value)}
                    inputMode="numeric"
                    className={field}
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Split evenly across generated variants.
                  </p>
                </>
              )}
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
          <h2 className="mb-4 font-semibold text-slate-900">Status & ordering</h2>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Status</label>
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value as ProductFormData["status"])}
                className={field}
              >
                <option value="active">Active — visible in store</option>
                <option value="draft">Draft — hidden from store</option>
                <option value="archived">Archived — hidden, kept for records</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Sort position</label>
              <input
                value={form.sortOrder}
                onChange={(e) => set("sortOrder", e.target.value)}
                inputMode="numeric"
                className={field}
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Lower numbers appear first in the catalogue.
              </p>
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

/**
 * Ordered image list with media-library integration: upload, pick from the
 * library, reorder, set the primary (first) image and remove. Removing an
 * image here only detaches it from the product — library files are never
 * deleted.
 */
function ImageListEditor({
  images,
  onChange,
}: {
  images: string[];
  onChange: (images: string[]) => void;
}) {
  const { adminFetch } = useAdmin();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const add = (url: string) => {
    const clean = url.trim();
    if (!clean || images.includes(clean)) return;
    if (images.length >= 12) {
      setError("Maximum 12 images per product.");
      return;
    }
    setError("");
    onChange([...images, clean]);
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = [...images];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const upload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await adminFetch("/api/admin/media", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Upload failed");
      add(String(data.media.url));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-1 font-semibold text-slate-900">Images</h2>
      <p className="mb-4 text-xs text-slate-400">
        The first image is the primary one shown on product cards. Drag-free
        ordering: use the arrows.
      </p>

      {images.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {images.map((src, i) => (
            <div
              key={`${src}-${i}`}
              className="group relative overflow-hidden rounded-lg border border-slate-200"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="aspect-[3/4] w-full object-cover" />
              {i === 0 && (
                <span className="absolute left-1.5 top-1.5 rounded bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                  Primary
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-white/90 px-1.5 py-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label="Move earlier"
                  className="rounded px-1 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                >
                  ←
                </button>
                {i !== 0 && (
                  <button
                    type="button"
                    onClick={() => onChange([src, ...images.filter((_, j) => j !== i)])}
                    className="text-[10px] font-medium text-slate-500 hover:text-slate-900"
                  >
                    Make primary
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === images.length - 1}
                  aria-label="Move later"
                  className="rounded px-1 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                >
                  →
                </button>
                <button
                  type="button"
                  onClick={() => onChange(images.filter((_, j) => j !== i))}
                  aria-label="Remove image"
                  className="rounded px-1 text-xs font-bold text-rose-600 hover:bg-rose-50"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-700"
        >
          Choose from library
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Upload new"}
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void upload(e.target.files)}
      />

      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(url) => {
          add(url);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}
