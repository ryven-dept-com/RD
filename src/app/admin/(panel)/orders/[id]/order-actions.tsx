"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/db/schema";
import { useAdmin } from "@/context/admin-context";
import {
  DELIVERY_STATUS_LABELS,
  DELIVERY_STATUS_STYLES,
  formatDateTime,
  PAYMENT_STATUS_STYLES,
  STATUS_STYLES,
} from "@/lib/admin-format";

type NoteRow = {
  id: number;
  author: string;
  body: string;
  createdAt: string;
};

type EventRow = {
  id: number;
  kind: string;
  fromValue: string;
  toValue: string;
  actor: string;
  note: string;
  createdAt: string;
};

export function OrderActions({
  orderId,
  status,
  paymentStatus,
  stockRestored,
  validNext,
  deliveryStatus,
  validDeliveryNext,
  notes,
  events,
}: {
  orderId: number;
  status: string;
  paymentStatus: string;
  stockRestored: boolean;
  validNext: string[];
  deliveryStatus: string;
  validDeliveryNext: string[];
  notes: NoteRow[];
  events: EventRow[];
}) {
  const router = useRouter();
  const { adminFetch } = useAdmin();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );
  const [override, setOverride] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const flash = (kind: "ok" | "err", text: string) => {
    setMessage({ kind, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const patch = async (
    payload: Record<string, unknown>,
    successText: string,
  ) => {
    setBusy(true);
    setMessage(null);
    const res = await adminFetch(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok && data.ok) {
      flash("ok", successText);
      router.refresh();
    } else {
      flash("err", data.error ?? "Update failed.");
    }
  };

  const move = (next: string) => {
    const destructive = next === "ملغى" || next === "مرجع";
    if (destructive) {
      const restoreInfo =
        !stockRestored && (next === "ملغى" || next === "مرجع")
          ? "\n\nStock reserved by this order will be restored."
          : "";
      if (!confirm(`Move this order to "${next}"?${restoreInfo}`)) return;
    }
    void patch({ status: next }, `Status updated to "${next}".`);
  };

  const moveDelivery = (next: string) => {
    if (next === "returned") {
      if (!confirm("Mark this parcel as returned?")) return;
    }
    void patch(
      { deliveryStatus: next },
      `Delivery status updated to "${DELIVERY_STATUS_LABELS[next] ?? next}".`,
    );
  };

  const applyOverride = () => {
    if (!override || override === status) return;
    if (
      !confirm(
        `Override the lifecycle and force status "${override}"? This bypasses transition rules.`,
      )
    )
      return;
    void patch(
      { status: override, force: true },
      `Status forced to "${override}".`,
    );
    setOverride("");
  };

  const setPayment = (next: string) => {
    if (next === "refunded" && paymentStatus !== "refunded") {
      if (!confirm("Mark this order's payment as refunded?")) return;
    }
    void patch({ paymentStatus: next }, "Payment status updated.");
  };

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteBody.trim()) return;
    setAddingNote(true);
    const res = await adminFetch(`/api/admin/orders/${orderId}/notes`, {
      method: "POST",
      body: JSON.stringify({ body: noteBody }),
    });
    const data = await res.json().catch(() => ({}));
    setAddingNote(false);
    if (res.ok && data.ok) {
      setNoteBody("");
      flash("ok", "Note added.");
      router.refresh();
    } else {
      flash("err", data.error ?? "Failed to add note.");
    }
  };

  const labelCls =
    "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500";
  const field =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900";

  return (
    <div className="space-y-6">
      {/* status actions */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Order status</h2>
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600"
            }`}
          >
            {status}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {validNext.map((s) => (
            <button
              key={s}
              onClick={() => move(s)}
              disabled={busy}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                s === "ملغى" || s === "مرجع"
                  ? "border-rose-200 text-rose-700 hover:bg-rose-50"
                  : "border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {s === "ملغى"
                ? "Cancel order"
                : s === "مرجع"
                  ? "Refund order"
                  : `Mark as ${s}`}
            </button>
          ))}
          {validNext.length === 0 && (
            <p className="text-sm text-slate-400">
              This order is in a terminal state — no further transitions.
            </p>
          )}
        </div>

        {/* explicit override mechanism */}
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-medium text-slate-400 hover:text-slate-600">
            Force status (override lifecycle rules)
          </summary>
          <div className="mt-2 flex gap-2">
            <select
              value={override}
              onChange={(e) => setOverride(e.target.value)}
              className={field}
              aria-label="Override status"
            >
              <option value="">Choose status…</option>
              {ORDER_STATUSES.filter((s) => s !== status).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              onClick={applyOverride}
              disabled={busy || !override}
              className="shrink-0 rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-40"
            >
              Force
            </button>
          </div>
        </details>

        {stockRestored && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
            Reserved stock has been restored for this order.
          </p>
        )}
      </div>

      {/* payment status */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Payment</h2>
          <span
            className={`rounded px-2 py-1 text-xs font-semibold capitalize ${
              PAYMENT_STATUS_STYLES[paymentStatus] ?? "bg-slate-100 text-slate-600"
            }`}
          >
            {paymentStatus.replace("_", " ")}
          </span>
        </div>
        <p className="mb-3 text-xs text-slate-400">
          Payment method: cash on delivery. Payment state is tracked separately
          from fulfillment.
        </p>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_STATUSES.map((p) => (
            <button
              key={p}
              onClick={() => setPayment(p)}
              disabled={busy || p === paymentStatus}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors disabled:cursor-not-allowed ${
                p === paymentStatus
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              }`}
            >
              {p.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* delivery status (Phase 8) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Delivery</h2>
          <span
            className={`rounded px-2 py-1 text-xs font-semibold ${
              DELIVERY_STATUS_STYLES[deliveryStatus] ?? "bg-slate-100 text-slate-600"
            }`}
          >
            {DELIVERY_STATUS_LABELS[deliveryStatus] ?? deliveryStatus}
          </span>
        </div>
        <p className="mb-3 text-xs text-slate-400">
          Physical parcel lifecycle — independent of the order and payment
          status.
        </p>
        <div className="grid grid-cols-1 gap-2">
          {validDeliveryNext.map((s) => (
            <button
              key={s}
              onClick={() => moveDelivery(s)}
              disabled={busy}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                s === "returned"
                  ? "border-rose-200 text-rose-700 hover:bg-rose-50"
                  : "border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              Mark as {DELIVERY_STATUS_LABELS[s] ?? s}
            </button>
          ))}
          {validDeliveryNext.length === 0 && (
            <p className="text-sm text-slate-400">
              Terminal delivery state — no further transitions.
            </p>
          )}
        </div>
      </div>

      {/* internal notes */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 font-semibold text-slate-900">Internal notes</h2>
        <form onSubmit={addNote} className="space-y-2">
          <textarea
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            rows={2}
            placeholder="Visible to admins only…"
            className={field}
            aria-label="New note"
          />
          <button
            type="submit"
            disabled={addingNote || !noteBody.trim()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {addingNote ? "Adding…" : "Add note"}
          </button>
        </form>
        {notes.length > 0 && (
          <ul className="mt-4 space-y-3">
            {notes.map((n) => (
              <li key={n.id} className="rounded-lg bg-slate-50 p-3">
                <p className="text-sm text-slate-800">{n.body}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {n.author} · {formatDateTime(new Date(n.createdAt))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* audit trail */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 font-semibold text-slate-900">History</h2>
        {events.length === 0 ? (
          <p className="text-sm text-slate-400">No changes recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {events.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center gap-2 border-b border-slate-50 pb-2 text-xs last:border-0"
              >
                <span
                  className={`rounded px-1.5 py-0.5 font-semibold uppercase ${
                    e.kind === "status"
                      ? "bg-blue-50 text-blue-700"
                      : e.kind === "payment"
                        ? "bg-emerald-50 text-emerald-700"
                        : e.kind === "stock"
                          ? "bg-amber-50 text-amber-700"
                          : e.kind === "delivery"
                            ? "bg-purple-50 text-purple-700"
                            : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {e.kind}
                </span>
                <span className="text-slate-600">
                  {e.fromValue && e.toValue
                    ? `${e.fromValue} → ${e.toValue}`
                    : e.toValue || e.fromValue}
                </span>
                {e.note && <span className="text-slate-400">“{e.note}”</span>}
                <span className="ml-auto text-slate-400">
                  {e.actor || "system"} · {formatDateTime(new Date(e.createdAt))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {message && (
        <div
          className={`rounded-lg px-4 py-2.5 text-sm font-medium ${
            message.kind === "ok"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700"
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
