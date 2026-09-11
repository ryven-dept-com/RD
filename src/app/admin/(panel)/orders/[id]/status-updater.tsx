"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ORDER_STATUSES } from "@/db/schema";
import { useAdmin } from "@/context/admin-context";
import { STATUS_STYLES } from "@/lib/admin-format";

export function OrderStatusUpdater({
  orderId,
  current,
}: {
  orderId: number;
  current: string;
}) {
  const router = useRouter();
  const { adminFetch } = useAdmin();
  const [status, setStatus] = useState(current);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const save = async (next: string) => {
    setStatus(next);
    setSaving(true);
    setError("");
    setSaved(false);
    const res = await adminFetch(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: next }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 1500);
    } else {
      setError("Failed to update status.");
      setStatus(current);
    }
  };

  return (
    <div className="space-y-3">
      <span
        className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${
          STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600"
        }`}
      >
        {status}
      </span>

      <div className="grid grid-cols-1 gap-2">
        {ORDER_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => save(s)}
            disabled={saving || s === status}
            className={`rounded-lg border px-3 py-2 text-right text-sm transition-colors disabled:cursor-not-allowed ${
              s === status
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
            dir="rtl"
          >
            {s}
          </button>
        ))}
      </div>

      {saving && <p className="text-xs text-slate-400">Saving…</p>}
      {saved && <p className="text-xs text-emerald-600">Status updated ✓</p>}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
