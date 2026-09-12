"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/context/admin-context";
import { formatWholeDZD } from "@/lib/admin-format";

type Zone = {
  id: number;
  code: number;
  wilaya: string;
  slug: string;
  city: string;
  price: number;
  estimatedTime: string;
  homeEnabled: boolean;
  homePrice: number;
  homeEstimatedTime: string;
  pickupEnabled: boolean;
  pickupPrice: number;
  pickupEstimatedTime: string;
  notes: string;
  sortOrder: number;
  enabled: boolean;
};

type ZoneDraft = {
  code: string;
  wilaya: string;
  city: string;
  enabled: boolean;
  sortOrder: string;
  homeEnabled: boolean;
  homePrice: string;
  homeEstimatedTime: string;
  pickupEnabled: boolean;
  pickupPrice: string;
  pickupEstimatedTime: string;
  notes: string;
};

const SORTS = [
  { value: "code", label: "Wilaya code" },
  { value: "wilaya", label: "Name (A→Z)" },
  { value: "price-asc", label: "Home price: low → high" },
  { value: "price-desc", label: "Home price: high → low" },
];

function toDraft(z: Zone): ZoneDraft {
  return {
    code: String(z.code),
    wilaya: z.wilaya,
    city: z.city,
    enabled: z.enabled,
    sortOrder: String(z.sortOrder),
    homeEnabled: z.homeEnabled,
    homePrice: String(z.homePrice),
    homeEstimatedTime: z.homeEstimatedTime,
    pickupEnabled: z.pickupEnabled,
    pickupPrice: String(z.pickupPrice),
    pickupEstimatedTime: z.pickupEstimatedTime,
    notes: z.notes,
  };
}

const EMPTY_DRAFT: ZoneDraft = {
  code: "",
  wilaya: "",
  city: "",
  enabled: true,
  sortOrder: "",
  homeEnabled: true,
  homePrice: "",
  homeEstimatedTime: "",
  pickupEnabled: false,
  pickupPrice: "",
  pickupEstimatedTime: "",
  notes: "",
};

export function DeliveryManager({ zones }: { zones: Zone[] }) {
  const router = useRouter();
  const { adminFetch } = useAdmin();
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [sort, setSort] = useState("code");
  const [editing, setEditing] = useState<Zone | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<ZoneDraft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const flash = (kind: "ok" | "err", text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 4000);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = zones.filter(
      (z) =>
        !q ||
        z.wilaya.toLowerCase().includes(q) ||
        z.city.toLowerCase().includes(q) ||
        String(z.code).includes(q),
    );
    if (activeFilter === "active") list = list.filter((z) => z.enabled);
    if (activeFilter === "inactive") list = list.filter((z) => !z.enabled);
    list = [...list];
    switch (sort) {
      case "wilaya":
        list.sort((a, b) => a.wilaya.localeCompare(b.wilaya));
        break;
      case "price-asc":
        list.sort((a, b) => a.homePrice - b.homePrice || a.code - b.code);
        break;
      case "price-desc":
        list.sort((a, b) => b.homePrice - a.homePrice || a.code - b.code);
        break;
      default:
        list.sort((a, b) => a.sortOrder - b.sortOrder || a.code - b.code);
    }
    return list;
  }, [zones, query, activeFilter, sort]);

  const openCreate = () => {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setCreating(true);
  };

  const openEdit = (z: Zone) => {
    setCreating(false);
    setEditing(z);
    setDraft(toDraft(z));
  };

  const closeForm = () => {
    setEditing(null);
    setCreating(false);
  };

  const save = async () => {
    setBusy(true);
    const payload = {
      ...(creating ? { code: Number(draft.code) } : {}),
      wilaya: draft.wilaya,
      city: draft.city,
      enabled: draft.enabled,
      sortOrder: Number(draft.sortOrder) || 0,
      homeEnabled: draft.homeEnabled,
      homePrice: Number(draft.homePrice) || 0,
      homeEstimatedTime: draft.homeEstimatedTime,
      pickupEnabled: draft.pickupEnabled,
      pickupPrice: Number(draft.pickupPrice) || 0,
      pickupEstimatedTime: draft.pickupEstimatedTime,
      notes: draft.notes,
    };
    const url = creating
      ? "/api/admin/delivery"
      : `/api/admin/delivery/${editing!.id}`;
    const res = await adminFetch(url, {
      method: creating ? "POST" : "PATCH",
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok && data.ok) {
      flash("ok", creating ? "Zone created." : "Zone saved.");
      closeForm();
      router.refresh();
    } else {
      flash("err", data.error ?? "Failed to save zone.");
    }
  };

  const toggleEnabled = async (z: Zone) => {
    const res = await adminFetch(`/api/admin/delivery/${z.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        wilaya: z.wilaya,
        enabled: !z.enabled,
        homeEnabled: z.homeEnabled,
        homePrice: z.homePrice,
        pickupEnabled: z.pickupEnabled,
        pickupPrice: z.pickupPrice,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      flash("ok", z.enabled ? "Zone disabled." : "Zone enabled.");
      router.refresh();
    } else {
      flash("err", data.error ?? "Failed to update zone.");
    }
  };

  const remove = async (z: Zone) => {
    if (
      !confirm(
        `Delete zone "${z.wilaya}"?\n\nOnly disabled zones can be deleted. Existing orders keep their shipping snapshot.`,
      )
    )
      return;
    const res = await adminFetch(`/api/admin/delivery/${z.id}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      flash("ok", "Zone deleted.");
      router.refresh();
    } else {
      flash("err", data.error ?? "Failed to delete zone.");
    }
  };

  const field =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none";
  const label =
    "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500";

  return (
    <div className="space-y-6">
      {/* shipping methods overview */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Home Delivery</h2>
          <p className="mt-1 text-sm text-slate-500">
            Delivered to the customer&apos;s address. Priced per zone; offered
            only where a zone has it enabled.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Pickup / Office</h2>
          <p className="mt-1 text-sm text-slate-500">
            Collected from a courier office or pickup point. Priced per zone;
            offered only where a zone has it enabled.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white">
        {/* toolbar */}
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search wilaya, city or code…"
            aria-label="Search delivery zones"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none sm:max-w-xs"
          />
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            aria-label="Filter zones by status"
            className={field + " sm:max-w-40"}
          >
            <option value="all">All zones</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort zones"
            className={field + " sm:max-w-52"}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            onClick={openCreate}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 lg:ml-auto"
          >
            Create zone
          </button>
        </div>

        {/* table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Wilaya</th>
                <th className="px-4 py-3 font-medium">Home delivery</th>
                <th className="px-4 py-3 font-medium">Pickup / office</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <p className="font-medium text-slate-500">No zones found</p>
                    <p className="mt-1 text-sm text-slate-400">
                      Adjust the search or filters, or create a zone.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((z) => (
                  <tr
                    key={z.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 tabular-nums text-slate-400">
                      {z.code}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{z.wilaya}</p>
                      {z.city && (
                        <p className="text-xs text-slate-400">{z.city}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {z.homeEnabled ? (
                        <p className="tabular-nums text-slate-800">
                          {formatWholeDZD(z.homePrice)}
                          {z.homeEstimatedTime && (
                            <span className="ml-2 text-xs text-slate-400">
                              {z.homeEstimatedTime}
                            </span>
                          )}
                        </p>
                      ) : (
                        <span className="text-xs text-slate-400">Disabled</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {z.pickupEnabled ? (
                        <p className="tabular-nums text-slate-800">
                          {formatWholeDZD(z.pickupPrice)}
                          {z.pickupEstimatedTime && (
                            <span className="ml-2 text-xs text-slate-400">
                              {z.pickupEstimatedTime}
                            </span>
                          )}
                        </p>
                      ) : (
                        <span className="text-xs text-slate-400">Disabled</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleEnabled(z)}
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          z.enabled
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                        title="Toggle zone availability"
                      >
                        {z.enabled ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(z)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => remove(z)}
                          className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
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

        <div className="border-t border-slate-200 px-4 py-3 text-sm text-slate-400">
          {filtered.length} of {zones.length} zones
        </div>
      </div>

      {/* create / edit form */}
      {(creating || editing) && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">
              {creating ? "Create delivery zone" : `Edit zone — ${editing?.wilaya}`}
            </h2>

            <div className="mt-5 space-y-6">
              {/* BASIC */}
              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Basic
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={label} htmlFor="zone-wilaya">
                      Wilaya / zone name
                    </label>
                    <input
                      id="zone-wilaya"
                      value={draft.wilaya}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, wilaya: e.target.value }))
                      }
                      className={field}
                      placeholder="16 - الجزائر"
                    />
                  </div>
                  <div>
                    <label className={label} htmlFor="zone-code">
                      Wilaya code (1–58)
                    </label>
                    <input
                      id="zone-code"
                      value={draft.code}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, code: e.target.value }))
                      }
                      disabled={!creating}
                      inputMode="numeric"
                      className={field + " disabled:bg-slate-50 disabled:text-slate-400"}
                    />
                  </div>
                  <div>
                    <label className={label} htmlFor="zone-city">
                      City / commune (optional)
                    </label>
                    <input
                      id="zone-city"
                      value={draft.city}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, city: e.target.value }))
                      }
                      className={field}
                      placeholder="Covers the whole wilaya when empty"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={label} htmlFor="zone-sort">
                        Sort order
                      </label>
                      <input
                        id="zone-sort"
                        value={draft.sortOrder}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, sortOrder: e.target.value }))
                        }
                        inputMode="numeric"
                        className={field}
                      />
                    </div>
                    <div>
                      <label className={label} htmlFor="zone-enabled">
                        Status
                      </label>
                      <select
                        id="zone-enabled"
                        value={draft.enabled ? "1" : "0"}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, enabled: e.target.value === "1" }))
                        }
                        className={field}
                      >
                        <option value="1">Active</option>
                        <option value="0">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>
              </section>

              {/* HOME DELIVERY */}
              <section className="rounded-xl border border-slate-200 p-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.homeEnabled}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, homeEnabled: e.target.checked }))
                    }
                    className="h-4 w-4 accent-slate-900"
                  />
                  <span className="text-sm font-semibold text-slate-900">
                    Home delivery
                  </span>
                </label>
                {draft.homeEnabled && (
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={label} htmlFor="zone-home-price">
                        Price (دج)
                      </label>
                      <input
                        id="zone-home-price"
                        value={draft.homePrice}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, homePrice: e.target.value }))
                        }
                        inputMode="numeric"
                        className={field}
                      />
                    </div>
                    <div>
                      <label className={label} htmlFor="zone-home-time">
                        Estimated delivery time
                      </label>
                      <input
                        id="zone-home-time"
                        value={draft.homeEstimatedTime}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            homeEstimatedTime: e.target.value,
                          }))
                        }
                        className={field}
                        placeholder="2-4 أيام"
                      />
                    </div>
                  </div>
                )}
              </section>

              {/* PICKUP / OFFICE */}
              <section className="rounded-xl border border-slate-200 p-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.pickupEnabled}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, pickupEnabled: e.target.checked }))
                    }
                    className="h-4 w-4 accent-slate-900"
                  />
                  <span className="text-sm font-semibold text-slate-900">
                    Pickup / office delivery
                  </span>
                </label>
                {draft.pickupEnabled && (
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={label} htmlFor="zone-pickup-price">
                        Price (دج)
                      </label>
                      <input
                        id="zone-pickup-price"
                        value={draft.pickupPrice}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, pickupPrice: e.target.value }))
                        }
                        inputMode="numeric"
                        className={field}
                      />
                    </div>
                    <div>
                      <label className={label} htmlFor="zone-pickup-time">
                        Estimated delivery time
                      </label>
                      <input
                        id="zone-pickup-time"
                        value={draft.pickupEstimatedTime}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            pickupEstimatedTime: e.target.value,
                          }))
                        }
                        className={field}
                        placeholder="1-3 أيام"
                      />
                    </div>
                  </div>
                )}
              </section>

              {/* OPTIONAL */}
              <section>
                <label className={label} htmlFor="zone-notes">
                  Internal notes (optional)
                </label>
                <textarea
                  id="zone-notes"
                  value={draft.notes}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, notes: e.target.value }))
                  }
                  rows={2}
                  className={field}
                  placeholder="Visible to admins only…"
                />
              </section>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={closeForm}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={busy || !draft.wilaya.trim()}
                className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {busy ? "Saving…" : creating ? "Create zone" : "Save zone"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg ${
            toast.kind === "ok"
              ? "bg-emerald-600 text-white"
              : "bg-rose-600 text-white"
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
