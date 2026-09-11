"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/context/admin-context";
import { formatWholeDZD } from "@/lib/admin-format";

type Zone = {
  id: number;
  code: number;
  wilaya: string;
  price: number;
  estimatedTime: string;
  enabled: boolean;
};

export function DeliveryManager({ zones }: { zones: Zone[] }) {
  const router = useRouter();
  const { adminFetch } = useAdmin();
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<number, Zone>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return zones.filter(
      (z) =>
        !q ||
        z.wilaya.toLowerCase().includes(q) ||
        String(z.code).includes(q),
    );
  }, [zones, query]);

  const getDraft = (z: Zone): Zone => drafts[z.id] ?? z;

  const edit = (z: Zone, patch: Partial<Zone>) =>
    setDrafts((d) => ({ ...d, [z.id]: { ...getDraft(z), ...patch } }));

  const save = async (z: Zone) => {
    const draft = getDraft(z);
    setSavingId(z.id);
    setSavedId(null);
    const res = await adminFetch(`/api/admin/delivery/${z.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        price: draft.price,
        estimatedTime: draft.estimatedTime,
        enabled: draft.enabled,
      }),
    });
    setSavingId(null);
    if (res.ok) {
      setSavedId(z.id);
      router.refresh();
      setTimeout(() => setSavedId(null), 1500);
    } else {
      alert("Failed to save zone.");
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search wilaya…"
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none sm:max-w-xs"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Wilaya</th>
              <th className="px-4 py-3 font-medium">Price (دج)</th>
              <th className="px-4 py-3 font-medium">Est. time</th>
              <th className="px-4 py-3 font-medium">Enabled</th>
              <th className="px-4 py-3 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((z) => {
              const d = getDraft(z);
              const dirty =
                d.price !== z.price ||
                d.estimatedTime !== z.estimatedTime ||
                d.enabled !== z.enabled;
              return (
                <tr
                  key={z.id}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50"
                >
                  <td className="px-4 py-2 tabular-nums text-slate-400">
                    {z.code}
                  </td>
                  <td className="px-4 py-2 font-medium text-slate-800">
                    {z.wilaya}
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={d.price}
                      onChange={(e) =>
                        edit(z, { price: Number(e.target.value) || 0 })
                      }
                      inputMode="numeric"
                      className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm tabular-nums focus:border-slate-900 focus:outline-none"
                    />
                    <span className="ml-1 text-xs text-slate-400">
                      {formatWholeDZD(d.price)}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={d.estimatedTime}
                      onChange={(e) => edit(z, { estimatedTime: e.target.value })}
                      className="w-28 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={d.enabled}
                      onChange={(e) => edit(z, { enabled: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 accent-slate-900"
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => save(z)}
                      disabled={!dirty || savingId === z.id}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-40"
                    >
                      {savingId === z.id
                        ? "…"
                        : savedId === z.id
                          ? "Saved ✓"
                          : "Save"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
