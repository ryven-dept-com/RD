"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useAdmin } from "@/context/admin-context";
import { MediaField } from "@/components/admin/media-field";

export type AdminCategory = {
  id: number;
  name: string;
  slug: string;
  description: string;
  image: string;
  active: boolean;
  sortOrder: number;
  seoTitle: string;
  seoDescription: string;
  parentId: number | null;
  productCount: number;
  childCount: number;
};

type FormState = {
  id: number | null;
  name: string;
  slug: string;
  description: string;
  image: string;
  active: boolean;
  sortOrder: string;
  seoTitle: string;
  seoDescription: string;
  parentId: string;
};

const EMPTY_FORM: FormState = {
  id: null,
  name: "",
  slug: "",
  description: "",
  image: "",
  active: true,
  sortOrder: "0",
  seoTitle: "",
  seoDescription: "",
  parentId: "",
};

const field =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900";
const labelCls =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500";

function descendantsOf(id: number, all: AdminCategory[]): Set<number> {
  const out = new Set<number>();
  const queue = [id];
  while (queue.length) {
    const current = queue.pop()!;
    for (const c of all) {
      if (c.parentId === current && !out.has(c.id)) {
        out.add(c.id);
        queue.push(c.id);
      }
    }
  }
  return out;
}

export function CategoriesManager({
  categories,
}: {
  categories: AdminCategory[];
}) {
  const router = useRouter();
  const { adminFetch } = useAdmin();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("manual");

  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  // Safe-delete flow: when the server blocks deletion we surface the reason
  // and offer an explicit reassignment target.
  const [deleteBlock, setDeleteBlock] = useState<{
    category: AdminCategory;
    error: string;
  } | null>(null);
  const [reassignTo, setReassignTo] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const nameOf = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = categories.filter((c) => {
      const matchesQ =
        !q || c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q);
      const matchesS =
        !statusFilter ||
        (statusFilter === "active" ? c.active : !c.active);
      return matchesQ && matchesS;
    });
    switch (sortBy) {
      case "name":
        list = [...list].sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "products":
        list = [...list].sort((a, b) => b.productCount - a.productCount);
        break;
      case "status":
        list = [...list].sort(
          (a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name),
        );
        break;
      default:
        list = [...list].sort(
          (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
        );
    }
    return list;
  }, [categories, query, statusFilter, sortBy]);

  const flash = (kind: "ok" | "err", text: string) => {
    setNotice({ kind, text });
    setTimeout(() => setNotice(null), 4000);
  };

  const openCreate = () => {
    setFormError("");
    setForm({ ...EMPTY_FORM });
  };

  const openEdit = (c: AdminCategory) => {
    setFormError("");
    setForm({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      image: c.image,
      active: c.active,
      sortOrder: String(c.sortOrder),
      seoTitle: c.seoTitle,
      seoDescription: c.seoDescription,
      parentId: c.parentId == null ? "" : String(c.parentId),
    });
  };

  const closeForm = () => setForm(null);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const saveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (!form.name.trim()) {
      setFormError("Name is required.");
      return;
    }
    setSaving(true);
    setFormError("");
    const payload = {
      name: form.name,
      slug: form.slug,
      description: form.description,
      image: form.image,
      active: form.active,
      sortOrder: Number(form.sortOrder) || 0,
      seoTitle: form.seoTitle,
      seoDescription: form.seoDescription,
      parentId: form.parentId ? Number(form.parentId) : null,
    };
    const res = await adminFetch(
      form.id ? `/api/admin/categories/${form.id}` : "/api/admin/categories",
      {
        method: form.id ? "PUT" : "POST",
        body: JSON.stringify(payload),
      },
    );
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok && data.ok) {
      flash("ok", form.id ? "Category updated." : "Category created.");
      closeForm();
      router.refresh();
    } else {
      setFormError(data.error ?? "Failed to save category.");
    }
  };

  const toggleActive = async (c: AdminCategory) => {
    setBusyId(c.id);
    const res = await adminFetch(`/api/admin/categories/${c.id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: c.name,
        slug: c.slug,
        description: c.description,
        image: c.image,
        active: !c.active,
        sortOrder: c.sortOrder,
        seoTitle: c.seoTitle,
        seoDescription: c.seoDescription,
        parentId: c.parentId,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (res.ok && data.ok) {
      flash("ok", `"${c.name}" ${!c.active ? "enabled" : "disabled"}.`);
      router.refresh();
    } else {
      flash("err", data.error ?? "Failed to update category.");
    }
  };

  const requestDelete = async (c: AdminCategory) => {
    if (!confirm(`Delete category "${c.name}"?`)) return;
    setBusyId(c.id);
    const res = await adminFetch(`/api/admin/categories/${c.id}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (res.ok && data.ok) {
      flash("ok", `Category "${c.name}" deleted.`);
      router.refresh();
    } else if (res.status === 409) {
      // Server-side protection kicked in — offer explicit reassignment.
      setReassignTo("");
      setDeleteBlock({ category: c, error: data.error ?? "Category is in use." });
    } else {
      flash("err", data.error ?? "Failed to delete category.");
    }
  };

  const confirmReassignDelete = async () => {
    if (!deleteBlock) return;
    if (!reassignTo) return;
    setBusyId(deleteBlock.category.id);
    const res = await adminFetch(
      `/api/admin/categories/${deleteBlock.category.id}?reassignTo=${reassignTo}`,
      { method: "DELETE" },
    );
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (res.ok && data.ok) {
      flash(
        "ok",
        `Category "${deleteBlock.category.name}" deleted; items moved to "${data.reassignedTo}".`,
      );
      setDeleteBlock(null);
      router.refresh();
    } else {
      flash("err", data.error ?? "Reassignment failed.");
      setDeleteBlock(null);
    }
  };

  // Parent options exclude the edited category and its descendants
  // (the server re-validates cycles regardless).
  const editingId = form?.id ?? null;
  const parentOptions = useMemo(() => {
    if (editingId == null) return categories;
    const blocked = descendantsOf(editingId, categories);
    return categories.filter((c) => c.id !== editingId && !blocked.has(c.id));
  }, [categories, editingId]);

  return (
    <div className="space-y-4">
      {/* toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search categories…"
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none sm:max-w-xs"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Disabled</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
        >
          <option value="manual">Sort: manual order</option>
          <option value="name">Sort: name</option>
          <option value="products">Sort: most products</option>
          <option value="status">Sort: active first</option>
        </select>
        <span className="text-sm text-slate-400 sm:ml-auto">
          {filtered.length} of {categories.length}
        </span>
        <button
          onClick={openCreate}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          + Add category
        </button>
      </div>

      {notice && (
        <div
          className={`rounded-lg px-4 py-2.5 text-sm font-medium ${
            notice.kind === "ok"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700"
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Parent</th>
              <th className="px-4 py-3 font-medium">Products</th>
              <th className="px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  No categories match.
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                        {c.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.image} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{c.name}</p>
                        <p className="text-xs text-slate-400">/{c.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.parentId != null ? nameOf.get(c.parentId) ?? "—" : "—"}
                    {c.childCount > 0 && (
                      <span className="ml-1.5 text-xs text-slate-400">
                        · {c.childCount} sub
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">
                    {c.productCount}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">
                    {c.sortOrder}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        c.active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {c.active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(c)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleActive(c)}
                        disabled={busyId === c.id}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {busyId === c.id ? "…" : c.active ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() => requestDelete(c)}
                        disabled={busyId === c.id}
                        className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* create / edit modal */}
      {form && (
        <div className="fixed inset-0 z-[80]">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={closeForm} />
          <div className="absolute inset-x-0 top-0 mx-auto max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-b-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                {form.id ? "Edit category" : "New category"}
              </h2>
              <button
                onClick={closeForm}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <form onSubmit={saveForm} className="space-y-6">
              {/* basic */}
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>Name *</label>
                    <input
                      value={form.name}
                      onChange={(e) => setField("name", e.target.value)}
                      className={field}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Slug</label>
                    <input
                      value={form.slug}
                      onChange={(e) => setField("slug", e.target.value)}
                      placeholder="auto-generated if empty"
                      className={field}
                    />
                    <p className="mt-1 text-[11px] text-slate-400">
                      Lowercase letters, numbers and dashes only.
                    </p>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setField("description", e.target.value)}
                    rows={3}
                    className={field}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className={labelCls}>Parent category</label>
                    <select
                      value={form.parentId}
                      onChange={(e) => setField("parentId", e.target.value)}
                      className={field}
                    >
                      <option value="">None (top level)</option>
                      {parentOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Sort order</label>
                    <input
                      value={form.sortOrder}
                      onChange={(e) => setField("sortOrder", e.target.value)}
                      inputMode="numeric"
                      className={field}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Status</label>
                    <select
                      value={form.active ? "active" : "inactive"}
                      onChange={(e) => setField("active", e.target.value === "active")}
                      className={field}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Disabled</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* media */}
              <MediaField
                label="Category image"
                value={form.image}
                onChange={(url) => setField("image", url)}
                kind="image"
                hint="Shown on category listings. Pick from the media library or upload."
              />

              {/* SEO */}
              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  SEO
                </h3>
                <div>
                  <label className={labelCls}>SEO title</label>
                  <input
                    value={form.seoTitle}
                    onChange={(e) => setField("seoTitle", e.target.value)}
                    placeholder="defaults to the category name"
                    className={field}
                  />
                </div>
                <div>
                  <label className={labelCls}>SEO description</label>
                  <textarea
                    value={form.seoDescription}
                    onChange={(e) => setField("seoDescription", e.target.value)}
                    rows={2}
                    placeholder="defaults to the category description"
                    className={field}
                  />
                </div>
              </div>

              {formError && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                  {formError}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {saving ? "Saving…" : form.id ? "Save changes" : "Create category"}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* safe-delete reassignment modal */}
      {deleteBlock && (
        <div className="fixed inset-0 z-[80]">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setDeleteBlock(null)}
          />
          <div className="absolute inset-x-0 top-24 mx-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">
              Cannot delete &quot;{deleteBlock.category.name}&quot;
            </h2>
            <p className="mt-2 text-sm text-slate-600">{deleteBlock.error}</p>
            <p className="mt-3 text-sm text-slate-600">
              Choose a category to receive its products; subcategories move up
              one level. Nothing is deleted silently.
            </p>
            <select
              value={reassignTo}
              onChange={(e) => setReassignTo(e.target.value)}
              className={`${field} mt-3`}
            >
              <option value="">Select target category…</option>
              {categories
                .filter((c) => c.id !== deleteBlock.category.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            <div className="mt-4 flex gap-2">
              <button
                onClick={confirmReassignDelete}
                disabled={!reassignTo || busyId === deleteBlock.category.id}
                className="flex-1 rounded-lg bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
              >
                {busyId === deleteBlock.category.id
                  ? "Deleting…"
                  : "Reassign & delete"}
              </button>
              <button
                onClick={() => setDeleteBlock(null)}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
