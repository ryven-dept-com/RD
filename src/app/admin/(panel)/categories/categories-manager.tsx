"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "@/context/admin-context";

type Cat = { id: number; name: string; slug: string; active: boolean };

export function CategoriesManager({ categories }: { categories: Cat[] }) {
  const router = useRouter();
  const { adminFetch } = useAdmin();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    const res = await adminFetch("/api/admin/categories", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok && data.ok) {
      setName("");
      router.refresh();
    } else {
      setError(data.error ?? "Failed to add category.");
    }
  };

  const remove = async (id: number, cname: string) => {
    if (!confirm(`Delete category "${cname}"?`)) return;
    const res = await adminFetch(`/api/admin/categories/${id}`, {
      method: "DELETE",
    });
    if (res.ok) router.refresh();
    else alert("Failed to delete category.");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <form
        onSubmit={add}
        className="rounded-2xl border border-slate-200 bg-white p-5"
      >
        <h2 className="mb-4 font-semibold text-slate-900">Add category</h2>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
          placeholder="e.g. Accessories"
        />
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-4 w-full rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add category"}
        </button>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white lg:col-span-2">
        <h2 className="border-b border-slate-200 px-5 py-4 font-semibold text-slate-900">
          All categories ({categories.length})
        </h2>
        {categories.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">
            No categories yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {categories.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between px-5 py-3"
              >
                <div>
                  <p className="font-medium text-slate-900">{c.name}</p>
                  <p className="text-xs text-slate-400">{c.slug}</p>
                </div>
                <button
                  onClick={() => remove(c.id, c.name)}
                  className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
