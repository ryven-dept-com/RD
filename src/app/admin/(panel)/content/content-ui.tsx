"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useAdmin } from "@/context/admin-context";

// ----------------------------- form primitives -----------------------------

export const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900";

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={inputCls}
    />
  );
}

export function TextArea({
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className={inputCls}
    />
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-slate-300"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-900">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs text-slate-400">
            {description}
          </span>
        )}
      </span>
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-slate-900" : "bg-slate-200"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

export function ReorderButtons({
  index,
  total,
  onMove,
}: {
  index: number;
  total: number;
  onMove: (from: number, to: number) => void;
}) {
  const btn =
    "flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-30";
  return (
    <div className="flex gap-1.5">
      <button
        type="button"
        className={btn}
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
        aria-label="Move up"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19V5m0 0l-6 6m6-6l6 6" />
        </svg>
      </button>
      <button
        type="button"
        className={btn}
        disabled={index >= total - 1}
        onClick={() => onMove(index, index + 1)}
        aria-label="Move down"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14m0 0l-6-6m6 6l6-6" />
        </svg>
      </button>
    </div>
  );
}

export function SectionCard({
  title,
  subtitle,
  children,
  actions,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div className="min-w-0">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
        </div>
        {actions}
      </div>
      <div className="space-y-4 p-5">{children}</div>
    </div>
  );
}

// --------------------------- save-state plumbing ---------------------------

export type Notify = (message: string, ok?: boolean) => void;

/**
 * Per-section draft state with dirty tracking, save/discard and status
 * messages. `baseline` is refreshed after every successful save, so the
 * dirty flag stays accurate without remounting.
 */
export function useSectionState<T>(
  initial: T,
  group: string,
  notify: Notify,
  onDirtyChange: (dirty: boolean) => void,
) {
  const { adminFetch } = useAdmin();
  const [draft, setDraft] = useState<T>(initial);
  const [baseline, setBaseline] = useState<T>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const dirtyRef = useRef(dirty);

  useEffect(() => {
    dirtyRef.current = dirty;
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  // Warn about leaving the page with unsaved changes.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const save = useCallback(
    async (payload: unknown = draft) => {
      setSaving(true);
      setError("");
      try {
        const res = await adminFetch(`/api/admin/cms/${group}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? "Failed to save changes");
        }
        setBaseline(payload as T);
        setDraft(payload as T);
        notify("Saved — the storefront is updated.", true);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to save changes";
        setError(message);
        notify(message, false);
      } finally {
        setSaving(false);
      }
    },
    [adminFetch, draft, group, notify],
  );

  const discard = useCallback(() => {
    setDraft(baseline);
    setError("");
  }, [baseline]);

  return { draft, setDraft, dirty, saving, error, save, discard };
}

/** Sticky action bar shown while a section has unsaved changes. */
export function SaveBar({
  dirty,
  saving,
  onSave,
  onDiscard,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  if (!dirty) return null;
  return (
    <div className="sticky bottom-0 z-30 -mx-4 mt-6 flex items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:rounded-2xl lg:border lg:px-5 lg:shadow-lg">
      <p className="hidden text-sm text-slate-500 sm:block">
        You have unsaved changes
      </p>
      <div className="flex flex-1 justify-end gap-2 sm:flex-none">
        <button
          type="button"
          onClick={onDiscard}
          disabled={saving}
          className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          Discard
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

// ------------------------- scheduling helpers ------------------------------

/** ISO string (or null) → value usable by <input type="datetime-local">. */
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** datetime-local value → ISO string (or null). */
export function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function ScheduleFields({
  startsAt,
  endsAt,
  onStartsChange,
  onEndsChange,
}: {
  startsAt: string;
  endsAt: string;
  onStartsChange: (v: string) => void;
  onEndsChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Starts at" hint="Leave empty to start immediately">
        <input
          type="datetime-local"
          value={startsAt}
          onChange={(e) => onStartsChange(e.target.value)}
          className={inputCls}
        />
      </Field>
      <Field label="Ends at" hint="Leave empty to run indefinitely">
        <input
          type="datetime-local"
          value={endsAt}
          onChange={(e) => onEndsChange(e.target.value)}
          className={inputCls}
        />
      </Field>
    </div>
  );
}
