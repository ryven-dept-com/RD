"use client";

import { useCallback, useRef, useState } from "react";
import { useAdmin } from "@/context/admin-context";
import type {
  BuilderDoc,
  BuilderStore,
  Section,
  SectionType,
  LayoutProps,
  TypeProps,
  ColorProps,
  MobileProps,
} from "@/lib/builder/types";
import {
  SECTION_LIBRARY,
  LIBRARY_BY_TYPE,
  defaultBuilderDoc,
  defaultSection,
} from "@/lib/builder/defaults";
import { sanitizeDoc } from "@/lib/builder/validate";

/**
 * Admin → Storefront Builder. The only editor UI in the project — nothing
 * of it ships to customers (admin-route bundle only). All data flows
 * through CSRF-checked /api/admin/builder routes; the preview iframe is the
 * real storefront rendered from an in-memory draft via a short-lived token.
 * Business data (prices/stock/orders/checkout/delivery) is never editable.
 */

type Tab = "home" | "header" | "footer" | "shop" | "pdp" | "cart";
type Device = "desktop" | "tablet" | "mobile";
const DEVICE_WIDTH = { desktop: "100%", tablet: "768px", mobile: "390px" } as const;
const TAB_LABELS: Record<Tab, string> = {
  home: "Home", header: "Header & Nav", footer: "Footer", shop: "Shop", pdp: "Product page", cart: "Cart",
};

type MediaItem = { id: string; originalName: string; url: string };
type PropVal = string | number | boolean;

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
function propsOf(sec: Section): Record<string, PropVal> {
  return sec.props as unknown as Record<string, PropVal>;
}

/* ---------------------------------------------------------------- inputs */

function Num({ label, value, onChange, min, max }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span className="text-slate-500">{label}</span>
      <input
        type="number" className="w-20 rounded border border-slate-300 px-1.5 py-1 text-right"
        value={value} min={min} max={max}
        onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || 0)))}
      />
    </label>
  );
}

function Txt({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <label className="block text-xs">
      <span className="mb-0.5 block text-slate-500">{label}</span>
      <input className="w-full rounded border border-slate-300 px-2 py-1" value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Sel<T extends string>({ label, value, onChange, options }: {
  label: string; value: T; onChange: (v: T) => void; options: ReadonlyArray<{ value: T; label: string }>;
}) {
  return (
    <label className="block text-xs">
      <span className="mb-0.5 block text-slate-500">{label}</span>
      <select className="w-full rounded border border-slate-300 bg-white px-1.5 py-1" value={value}
        onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function Bool({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span className="text-slate-500">{label}</span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
    </label>
  );
}

function Range({ label, value, onChange, min, max }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number;
}) {
  return (
    <label className="block text-xs">
      <span className="mb-0.5 flex justify-between text-slate-500"><span>{label}</span><span>{value}</span></span>
      <input type="range" className="w-full" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const hex = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? value : "#000000";
  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="flex items-center gap-1">
        <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} className="h-6 w-8 cursor-pointer rounded border border-slate-300" />
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="empty = theme"
          className="w-24 rounded border border-slate-300 px-1.5 py-1 text-right font-mono text-[10px]" />
      </span>
    </label>
  );
}

/** Media-library picker — picks an EXISTING uploaded file by id; the
 *  renderer resolves it through the one media system (no duplicated files). */
function MediaField({ label, value, onChange, onOpenPicker }: {
  label: string; value: string; onChange: (v: string) => void; onOpenPicker: (sel: (id: string) => void) => void;
}) {
  return (
    <div className="text-xs">
      <span className="mb-0.5 block text-slate-500">{label}</span>
      <div className="flex gap-1">
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="media id (empty = clear)"
          className="w-full rounded border border-slate-300 px-2 py-1 font-mono text-[10px]" />
        <button type="button" onClick={() => onOpenPicker(onChange)}
          className="shrink-0 rounded border border-slate-300 px-2 py-1 font-semibold text-slate-600 hover:bg-slate-100">Browse</button>
      </div>
    </div>
  );
}

function Group({ title, children, defaultOpen }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="rounded-lg border border-slate-200 bg-white">
      <summary className="cursor-pointer select-none px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">{title}</summary>
      <div className="space-y-2 border-t border-slate-100 px-3 py-3">{children}</div>
    </details>
  );
}

/* -------------------------------------------------------------- editor */

export function BuilderClient({ initial }: { initial: BuilderStore | null }) {
  const { adminFetch } = useAdmin();
  const [store, setStore] = useState<BuilderStore | null>(initial);
  const [doc, setDoc] = useState<BuilderDoc>(() =>
    initial?.draft ? sanitizeDoc(clone(initial.draft)) : defaultBuilderDoc());
  const [tab, setTab] = useState<Tab>("home");
  const [selId, setSelId] = useState<string | null>(doc.home[0]?.id ?? null);
  const [device, setDevice] = useState<Device>("desktop");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [picker, setPicker] = useState<((id: string) => void) | null>(null);
  const undoStack = useRef<BuilderDoc[]>([]);
  const redoStack = useRef<BuilderDoc[]>([]);
  const dragFrom = useRef<number | null>(null);

  const say = (m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg(null), 5000);
  };

  const commit = useCallback((next: BuilderDoc) => {
    setDoc((cur) => {
      undoStack.current = [...undoStack.current.slice(-49), cur];
      return next;
    });
    redoStack.current = [];
  }, []);

  const mutate = useCallback((fn: (d: BuilderDoc) => void) => {
    const next = clone(doc);
    fn(next);
    commit(next);
  }, [doc, commit]);

  const undo = () => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current = [...redoStack.current, doc];
    setDoc(prev);
  };
  const redo = () => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current = [...undoStack.current, doc];
    setDoc(next);
  };

  const openPicker = (sel: (id: string) => void) => {
    setPicker(() => sel);
    if (!media.length) {
      adminFetch("/api/admin/media").then((r) => r.json()).then((j) => {
        if (j.ok) setMedia(j.media);
      }).catch(() => say("Could not load media library."));
    }
  };

  /* --------------------------------------------------------- server ops */

  const applyStore = (s: BuilderStore) => {
    setStore(s);
    setDoc(sanitizeDoc(s.draft));
    setPreviewUrl(null);
  };

  const save = async () => {
    setBusy(true);
    const r = await adminFetch("/api/admin/builder", { method: "PUT", body: JSON.stringify({ doc }) })
      .then((x) => x.json()).catch(() => null);
    setBusy(false);
    if (r?.ok) {
      applyStore(r.store);
      say("Draft saved (schema-validated). Publish when ready.");
    } else say(r?.error ?? "Save failed — previous configuration preserved.");
  };

  const publish = async () => {
    setBusy(true);
    const r = await adminFetch("/api/admin/builder/publish", { method: "POST", body: JSON.stringify({ action: "publish" }) })
      .then((x) => x.json()).catch(() => null);
    setBusy(false);
    if (r?.ok) {
      applyStore(r.store);
      say("Published — the live storefront now renders this configuration.");
    } else say(r?.error ?? "Publish failed — previous configuration preserved.");
  };

  const rollback = async (index: number) => {
    setBusy(true);
    const r = await adminFetch("/api/admin/builder/publish", { method: "POST", body: JSON.stringify({ action: "rollback", index }) })
      .then((x) => x.json()).catch(() => null);
    setBusy(false);
    if (r?.ok) {
      applyStore(r.store);
      say(`Restored snapshot “${store?.history[index]?.label ?? index}”.`);
    } else say(r?.error ?? "Rollback failed.");
  };

  const resetDraft = async () => {
    if (!window.confirm("Discard the current draft and restore the published configuration (or factory defaults)?")) return;
    setBusy(true);
    const r = await adminFetch("/api/admin/builder/publish", { method: "POST", body: JSON.stringify({ action: "reset" }) })
      .then((x) => x.json()).catch(() => null);
    setBusy(false);
    if (r?.ok) {
      applyStore(r.store);
      say("Draft reset.");
    }
  };

  const preview = async () => {
    setBusy(true);
    const r = await adminFetch("/api/admin/builder/preview", { method: "POST", body: JSON.stringify({ doc }) })
      .then((x) => x.json()).catch(() => null);
    setBusy(false);
    if (r?.ok) setPreviewUrl(`/api/builder/preview?rd_bd=${r.token}`);
    else say(r?.error ?? "Preview failed.");
  };

  /* ------------------------------------------------------- section ops */

  const selIndex = doc.home.findIndex((s) => s.id === selId);
  const sel = selIndex >= 0 ? doc.home[selIndex] : null;

  const addSection = (type: SectionType) => {
    const sec = defaultSection(type);
    mutate((d) => {
      const at = selIndex >= 0 ? selIndex + 1 : d.home.length;
      d.home.splice(at, 0, sec);
    });
    setSelId(sec.id);
  };

  const duplicate = (id: string) => {
    mutate((d) => {
      const i = d.home.findIndex((s) => s.id === id);
      if (i < 0) return;
      const copy = clone(d.home[i]);
      copy.id = `${copy.type}-${Math.random().toString(36).slice(2, 8)}`;
      d.home.splice(i + 1, 0, copy);
    });
  };

  const remove = (id: string) => {
    mutate((d) => { d.home = d.home.filter((s) => s.id !== id); });
    if (selId === id) setSelId(null);
  };

  const toggleEnabled = (id: string) => {
    mutate((d) => {
      const s = d.home.find((x) => x.id === id);
      if (s) s.enabled = !s.enabled;
    });
  };

  const move = (id: string, dir: -1 | 1) => {
    mutate((d) => {
      const i = d.home.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.home.length) return;
      const [s] = d.home.splice(i, 1);
      d.home.splice(j, 0, s);
    });
  };

  const dropOn = (toIndex: number) => {
    const from = dragFrom.current;
    dragFrom.current = null;
    if (from == null || from === toIndex) return;
    mutate((d) => {
      const [s] = d.home.splice(from, 1);
      d.home.splice(toIndex, 0, s);
    });
  };

  const resetSection = (id: string) => {
    mutate((d) => {
      const i = d.home.findIndex((x) => x.id === id);
      if (i < 0) return;
      const fresh = defaultSection(d.home[i].type);
      fresh.id = d.home[i].id;
      d.home[i] = fresh;
    });
  };

  const setSelField = <K extends keyof Section>(key: K, val: Section[K]) => {
    mutate((d) => {
      const s = d.home.find((x) => x.id === selId);
      if (s) (s as unknown as Record<string, unknown>)[key] = val;
    });
  };
  const setProp = (key: string, val: PropVal) => {
    mutate((d) => {
      const s = d.home.find((x) => x.id === selId);
      if (s) propsOf(s)[key] = val;
    });
  };

  const published = Boolean(store?.published);

  /* ------------------------------------------------------------ render */

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
        <h1 className="text-sm font-bold uppercase tracking-widest text-slate-700">Storefront Builder</h1>
        <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${published ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
          {published ? `Published v${store?.version}` : "Not published — theme home is live"}
        </span>
        <div className="ms-auto flex flex-wrap items-center gap-1.5">
          <button onClick={undo} className="rounded border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100" title="Undo">↶</button>
          <button onClick={redo} className="rounded border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100" title="Redo">↷</button>
          <button onClick={resetDraft} className="rounded border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">Reset draft</button>
          <button onClick={preview} disabled={busy} className="rounded border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50">Preview draft</button>
          <button onClick={save} disabled={busy} className="rounded bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700 disabled:opacity-50">Save draft</button>
          <button onClick={publish} disabled={busy} className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50">Publish</button>
        </div>
      </div>

      {/* tabs */}
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded px-3 py-1.5 text-xs font-semibold ${tab === t ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-100"}`}>
            {TAB_LABELS[t]}
          </button>
        ))}
        {msg && <span className="ms-auto self-center pe-2 text-xs font-semibold text-emerald-700">{msg}</span>}
      </div>

      {/* body */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[240px_minmax(0,1fr)_320px]">
        {/* LEFT — structure tree / history */}
        <div className="min-h-[300px] overflow-auto rounded-lg border border-slate-200 bg-white p-2">
          {tab === "home" ? (
            <>
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sections ({doc.home.length})</p>
                <select
                  className="max-w-[120px] rounded border border-slate-300 bg-white px-1 py-0.5 text-[10px] font-semibold text-slate-600"
                  value=""
                  onChange={(e) => { if (e.target.value) addSection(e.target.value as SectionType); }}
                  title="Add section"
                >
                  <option value="">+ Add section…</option>
                  {SECTION_LIBRARY.map((l) => (
                    <option key={l.type} value={l.type}>{l.label}</option>
                  ))}
                </select>
              </div>
              {doc.home.map((s, i) => {
                const lib = LIBRARY_BY_TYPE.get(s.type);
                return (
                  <div
                    key={s.id}
                    draggable
                    onDragStart={() => { dragFrom.current = i; }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => dropOn(i)}
                    onClick={() => setSelId(s.id)}
                    className={`mb-1 cursor-pointer rounded border px-2 py-1.5 text-xs ${
                      selId === s.id ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 hover:border-slate-400"
                    } ${!s.enabled ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-center gap-1">
                      <span className="cursor-grab text-slate-400" title="Drag to reorder">⠿</span>
                      <span className="flex-1 truncate font-semibold">{lib?.label ?? s.type}</span>
                      {!s.enabled && <span className="text-[9px] uppercase">hidden</span>}
                    </div>
                    <div className={`mt-1 flex items-center gap-1 text-[10px] ${selId === s.id ? "text-white/80" : "text-slate-400"}`}
                      onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => move(s.id, -1)} className="rounded border px-1 hover:bg-black/5" title="Move up">↑</button>
                      <button onClick={() => move(s.id, 1)} className="rounded border px-1 hover:bg-black/5" title="Move down">↓</button>
                      <button onClick={() => toggleEnabled(s.id)} className="rounded border px-1 hover:bg-black/5" title="Hide/show">{s.enabled ? "hide" : "show"}</button>
                      <button onClick={() => duplicate(s.id)} className="rounded border px-1 hover:bg-black/5" title="Duplicate">dup</button>
                      <button onClick={() => resetSection(s.id)} className="rounded border px-1 hover:bg-black/5" title="Reset section settings">reset</button>
                      <button onClick={() => remove(s.id)} className="rounded border border-red-200 px-1 text-red-500 hover:bg-red-50" title="Delete">✕</button>
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <p className="px-1 py-2 text-xs leading-relaxed text-slate-500">
              {TAB_LABELS[tab]} is configured in the inspector on the right. These controls adjust the
              chrome around the home sections — routes, checkout and business data are never touched.
            </p>
          )}

          {/* version history */}
          {store && store.history.length > 0 && (
            <div className="mt-3 border-t border-slate-200 pt-2">
              <p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">History (rollback)</p>
              {store.history.slice().reverse().slice(0, 10).map((h) => {
                const index = store.history.length - 1 - store.history.slice().reverse().indexOf(h);
                return (
                  <div key={`${h.at}-${index}`} className="mb-1 flex items-center gap-1 rounded border border-slate-200 px-1.5 py-1 text-[10px] text-slate-500">
                    <span className="flex-1 truncate font-semibold">{h.label}</span>
                    <span className="text-slate-300">{new Date(h.at).toLocaleString()}</span>
                    <button onClick={() => rollback(index)} className="rounded border border-slate-300 px-1.5 font-semibold hover:bg-slate-100">Restore</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* CENTER — live preview */}
        <div className="flex min-h-[400px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-1.5">
            {(["desktop", "tablet", "mobile"] as Device[]).map((d) => (
              <button key={d} onClick={() => setDevice(d)}
                className={`rounded px-2 py-1 text-[11px] font-semibold uppercase tracking-widest ${device === d ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-100"}`}>
                {d}
              </button>
            ))}
            <span className="ms-auto text-[10px] text-slate-400">
              {previewUrl ? "PREVIEW — admin-only, isolated session" : "“Preview draft” opens the real storefront with this config"}
            </span>
          </div>
          <div className="flex-1 overflow-auto p-3">
            {previewUrl ? (
              <iframe
                key={previewUrl}
                src={previewUrl}
                title="Storefront preview"
                className="mx-auto h-full rounded border border-slate-300 bg-white"
                style={{ width: DEVICE_WIDTH[device], maxWidth: "100%" }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-center text-xs text-slate-400">
                <div>
                  <p className="mb-2 text-3xl">◐</p>
                  <p>Customers never see drafts — previews run in an isolated admin session.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — inspector */}
        <div className="min-h-[300px] space-y-2 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
          {tab === "home" && sel && (
            <SectionInspector sec={sel} onOpenPicker={openPicker} onSel={setSelField} onProp={setProp} />
          )}
          {tab === "home" && !sel && (
            <p className="px-2 py-4 text-xs text-slate-400">Select a section on the left, or add one.</p>
          )}
          {tab === "header" && <HeaderInspector doc={doc} mutate={mutate} />}
          {tab === "footer" && <FooterInspector doc={doc} mutate={mutate} />}
          {tab === "shop" && <ShopInspector doc={doc} mutate={mutate} />}
          {tab === "pdp" && <PdpInspector doc={doc} mutate={mutate} />}
          {tab === "cart" && <CartInspector doc={doc} mutate={mutate} />}
        </div>
      </div>

      {/* media picker overlay */}
      {picker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPicker(null)}>
          <div className="max-h-[70vh] w-full max-w-2xl overflow-auto rounded-lg bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-600">Media library</h2>
              <button onClick={() => setPicker(null)} className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold">Close</button>
            </div>
            {media.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">No uploaded files — upload images in Admin → Content → Media first.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {media.map((m) => (
                  <button key={m.id}
                    onClick={() => { picker(m.id); setPicker(null); }}
                    className="overflow-hidden rounded border border-slate-200 hover:border-slate-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.url} alt={m.originalName} loading="lazy" className="aspect-square w-full object-cover" />
                    <span className="block truncate px-1 py-0.5 text-left text-[9px] text-slate-500">{m.originalName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------- section inspector */

const ALIGN_OPTS = [
  { value: "start", label: "start" }, { value: "center", label: "center" }, { value: "end", label: "end" },
] as const;

function SectionInspector({ sec, onOpenPicker, onSel, onProp }: {
  sec: Section;
  onOpenPicker: (sel: (id: string) => void) => void;
  onSel: <K extends keyof Section>(key: K, val: Section[K]) => void;
  onProp: (key: string, val: PropVal) => void;
}) {
  const lib = LIBRARY_BY_TYPE.get(sec.type);
  const pr = propsOf(sec);
  const setLayout = (patch: Partial<LayoutProps>) => onSel("layout", { ...sec.layout, ...patch });
  const setType = (patch: Partial<TypeProps>) => onSel("typography", { ...sec.typography, ...patch });
  const setColors = (patch: Partial<ColorProps>) => onSel("colors", { ...sec.colors, ...patch });
  const setMobile = (patch: Partial<MobileProps>) => onSel("mobile", { ...sec.mobile, ...patch });

  return (
    <>
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
        <p className="text-xs font-bold text-slate-700">{lib?.label ?? sec.type}</p>
        <p className="text-[10px] text-slate-400">{sec.type} · {sec.id.slice(0, 14)}</p>
        {sec.props.useCms && (
          <p className="mt-1 rounded bg-sky-50 px-2 py-1 text-[10px] text-sky-700">
            Content comes from Admin → Content (single CMS source). Leave fields empty to use it.
          </p>
        )}
      </div>

      {(lib?.fields.length ?? 0) > 0 && (
        <Group title="Content" defaultOpen>
          {lib!.fields.map((f) => {
            const v = pr[f.key];
            if (f.kind === "toggle") {
              return <Bool key={f.key} label={f.label} value={Boolean(v)} onChange={(x) => onProp(f.key, x)} />;
            }
            if (f.kind === "range") {
              return <Range key={f.key} label={f.label} value={Number(v) || 0} onChange={(x) => onProp(f.key, x)} min={f.min ?? 0} max={f.max ?? 100} />;
            }
            if (f.kind === "select") {
              const opts = (f.options ?? []).map((o) => ({ value: o.value, label: o.label }));
              return <Sel key={f.key} label={f.label} value={String(v ?? "")} onChange={(x) => onProp(f.key, x)} options={opts} />;
            }
            if (f.kind === "image") {
              return <MediaField key={f.key} label={f.label} value={String(v ?? "")} onChange={(x) => onProp(f.key, x)} onOpenPicker={onOpenPicker} />;
            }
            return <Txt key={f.key} label={f.label} value={String(v ?? "")} onChange={(x) => onProp(f.key, x)}
              placeholder={f.kind === "href" ? "/shop, /product/slug, https://…" : undefined} />;
          })}
        </Group>
      )}

      <Group title="Layout">
        <Sel label="Container width" value={sec.layout.container} onChange={(v) => setLayout({ container: v })}
          options={[{ value: "narrow", label: "narrow" }, { value: "default", label: "default" }, { value: "wide", label: "wide" }, { value: "full", label: "full bleed" }]} />
        <Sel label="Horizontal align" value={sec.layout.align} onChange={(v) => setLayout({ align: v })} options={ALIGN_OPTS} />
        <Sel label="Vertical align" value={sec.layout.valign} onChange={(v) => setLayout({ valign: v })} options={ALIGN_OPTS} />
        <Sel label="Padding (vertical)" value={sec.layout.padY} onChange={(v) => setLayout({ padY: v })}
          options={["none", "sm", "md", "lg", "xl"].map((v) => ({ value: v as LayoutProps["padY"], label: v }))} />
        <Sel label="Spacing between items" value={sec.layout.gap} onChange={(v) => setLayout({ gap: v })}
          options={[{ value: "sm", label: "compact" }, { value: "md", label: "normal" }, { value: "lg", label: "airy" }]} />
        <Sel label="Columns (desktop)" value={String(sec.layout.cols)} onChange={(v) => setLayout({ cols: Number(v) as LayoutProps["cols"] })}
          options={[{ value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4", label: "4" }]} />
        <Sel label="Columns (mobile)" value={String(sec.layout.colsMobile)} onChange={(v) => setLayout({ colsMobile: Number(v) as LayoutProps["colsMobile"] })}
          options={[{ value: "1", label: "1" }, { value: "2", label: "2" }]} />
      </Group>

      <Group title="Typography">
        <Sel label="Font family" value={sec.typography.font} onChange={(v) => setType({ font: v })}
          options={[{ value: "", label: "theme default" }, { value: "display", label: "display" }, { value: "body", label: "body" }]} />
        <Sel label="Text size" value={sec.typography.size} onChange={(v) => setType({ size: v })}
          options={["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl"].map((v) => ({ value: v as TypeProps["size"], label: v }))} />
        <Sel label="Weight" value={sec.typography.weight} onChange={(v) => setType({ weight: v })}
          options={["normal", "medium", "semibold", "bold"].map((v) => ({ value: v as TypeProps["weight"], label: v }))} />
        <Sel label="Transform" value={sec.typography.transform} onChange={(v) => setType({ transform: v })}
          options={[{ value: "none", label: "none" }, { value: "uppercase", label: "UPPERCASE" }, { value: "capitalize", label: "Capitalize" }]} />
        <Sel label="Letter spacing" value={sec.typography.tracking} onChange={(v) => setType({ tracking: v })}
          options={[{ value: "tight", label: "tight" }, { value: "normal", label: "normal" }, { value: "wide", label: "wide" }, { value: "widest", label: "widest" }]} />
        <Sel label="Line height" value={sec.typography.lineHeight} onChange={(v) => setType({ lineHeight: v })}
          options={[{ value: "tight", label: "tight" }, { value: "normal", label: "normal" }, { value: "relaxed", label: "relaxed" }]} />
        <Sel label="Align" value={sec.typography.align} onChange={(v) => setType({ align: v })} options={ALIGN_OPTS} />
        <Sel label="Heading width" value={sec.typography.headingWidth} onChange={(v) => setType({ headingWidth: v })}
          options={[{ value: "narrow", label: "narrow" }, { value: "default", label: "default" }, { value: "wide", label: "wide" }]} />
      </Group>

      <Group title="Colors">
        <ColorField label="Background" value={sec.colors.bg} onChange={(v) => setColors({ bg: v })} />
        <ColorField label="Text" value={sec.colors.text} onChange={(v) => setColors({ text: v })} />
        <ColorField label="Heading" value={sec.colors.heading} onChange={(v) => setColors({ heading: v })} />
        <ColorField label="Accent" value={sec.colors.accent} onChange={(v) => setColors({ accent: v })} />
        <ColorField label="Button background" value={sec.colors.buttonBg} onChange={(v) => setColors({ buttonBg: v })} />
        <ColorField label="Button text" value={sec.colors.buttonText} onChange={(v) => setColors({ buttonText: v })} />
        <ColorField label="Border" value={sec.colors.border} onChange={(v) => setColors({ border: v })} />
        <ColorField label="Overlay color" value={sec.colors.overlay} onChange={(v) => setColors({ overlay: v })} />
        <Range label="Overlay opacity (%)" value={sec.colors.overlayOpacity} onChange={(v) => setColors({ overlayOpacity: v })} min={0} max={80} />
        <p className="text-[10px] text-slate-400">Empty = falls back to theme customization, then theme default.</p>
      </Group>

      <Group title="Mobile">
        <Bool label="Hide on mobile" value={sec.mobile.hidden} onChange={(v) => setMobile({ hidden: v })} />
        <Num label="Mobile order (0 = config order)" value={sec.mobile.order} onChange={(v) => setMobile({ order: v })} min={0} max={99} />
        <MediaField label="Alternate mobile image" value={sec.mobile.image} onChange={(v) => setMobile({ image: v })} onOpenPicker={onOpenPicker} />
        <Sel label="Mobile min-height" value={sec.mobile.height} onChange={(v) => setMobile({ height: v })}
          options={[{ value: "", label: "auto" }, { value: "sm", label: "short" }, { value: "md", label: "medium" }, { value: "lg", label: "tall" }]} />
        <Sel label="Mobile columns" value={String(sec.mobile.cols)} onChange={(v) => setMobile({ cols: Number(v) as MobileProps["cols"] })}
          options={[{ value: "0", label: "inherit desktop" }, { value: "1", label: "1" }, { value: "2", label: "2" }]} />
        <Sel label="Mobile padding" value={sec.mobile.padY} onChange={(v) => setMobile({ padY: v })}
          options={[{ value: "", label: "same as desktop" }, ...["none", "sm", "md", "lg", "xl"].map((v) => ({ value: v as Exclude<MobileProps["padY"], "">, label: v }))]} />
        <Sel label="Mobile align" value={sec.mobile.align} onChange={(v) => setMobile({ align: v })}
          options={[{ value: "", label: "same as desktop" }, ...ALIGN_OPTS]} />
        <Sel label="Mobile text size" value={sec.mobile.size} onChange={(v) => setMobile({ size: v })}
          options={[{ value: "", label: "inherit" }, ...["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl"].map((v) => ({ value: v as Exclude<MobileProps["size"], "">, label: v }))]} />
      </Group>
    </>
  );
}

/* --------------------------------------------------- chrome inspectors */

function HeaderInspector({ doc, mutate }: { doc: BuilderDoc; mutate: (fn: (d: BuilderDoc) => void) => void }) {
  const h = doc.header;
  const set = (patch: Partial<typeof h>) => mutate((d) => { d.header = { ...d.header, ...patch }; });
  return (
    <>
      <Group title="Logo & brand" defaultOpen>
        <Sel label="Logo position" value={h.logoPosition} onChange={(v) => set({ logoPosition: v })}
          options={[{ value: "start", label: "left / start" }, { value: "center", label: "center" }]} />
        <Sel label="Logo size" value={h.logoSize} onChange={(v) => set({ logoSize: v })}
          options={[{ value: "sm", label: "small" }, { value: "md", label: "medium" }, { value: "lg", label: "large" }]} />
      </Group>
      <Group title="Navigation" defaultOpen>
        <Sel label="Nav position" value={h.navPosition} onChange={(v) => set({ navPosition: v })}
          options={[{ value: "start", label: "start" }, { value: "center", label: "center" }, { value: "end", label: "end" }]} />
        <Sel label="Menu order" value={h.navOrder.join(",")} onChange={(v) => set({ navOrder: v.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 6) })}
          options={[
            { value: "home,collections,shop", label: "Home → Collections → Shop" },
            { value: "collections,home,shop", label: "Collections → Home → Shop" },
            { value: "home,shop,collections", label: "Home → Shop → Collections" },
            { value: "shop,collections,home", label: "Shop → Collections → Home" },
          ]} />
        <p className="text-[10px] text-slate-400">Routing stays on /shop?category=… — reordering never breaks links.</p>
      </Group>
      <Group title="Bar" defaultOpen>
        <Sel label="Height" value={h.height} onChange={(v) => set({ height: v })}
          options={[{ value: "sm", label: "compact" }, { value: "md", label: "normal" }, { value: "lg", label: "tall" }]} />
        <Bool label="Sticky on scroll" value={h.sticky} onChange={(v) => set({ sticky: v })} />
        <Bool label="Transparent over hero (home)" value={h.transparentOverHero} onChange={(v) => set({ transparentOverHero: v })} />
        <Bool label="Show search" value={h.showSearch} onChange={(v) => set({ showSearch: v })} />
        <Bool label="Show cart" value={h.showCart} onChange={(v) => set({ showCart: v })} />
        <Bool label="Show language switcher" value={h.showLanguage} onChange={(v) => set({ showLanguage: v })} />
        <Bool label="Show announcement bar" value={h.showAnnouncement} onChange={(v) => set({ showAnnouncement: v })} />
      </Group>
    </>
  );
}

function FooterInspector({ doc, mutate }: { doc: BuilderDoc; mutate: (fn: (d: BuilderDoc) => void) => void }) {
  const f = doc.footer;
  const set = (patch: Partial<typeof f>) => mutate((d) => { d.footer = { ...d.footer, ...patch }; });
  return (
    <Group title="Footer" defaultOpen>
      <Bool label="Show newsletter block" value={f.showNewsletter} onChange={(v) => set({ showNewsletter: v })} />
      <Bool label="Show contact details" value={f.showContact} onChange={(v) => set({ showContact: v })} />
      <Bool label="Show social links" value={f.showSocial} onChange={(v) => set({ showSocial: v })} />
      <Txt label="Group order (comma-separated titles)" value={f.groupOrder.join(", ")} onChange={(v) => set({ groupOrder: v.split(",").map((x) => x.trim()).filter(Boolean) })} placeholder="Shop, Help" />
      <p className="text-[10px] text-slate-400">Footer copy itself is edited in Admin → Content → Footer (single source).</p>
    </Group>
  );
}

function ShopInspector({ doc, mutate }: { doc: BuilderDoc; mutate: (fn: (d: BuilderDoc) => void) => void }) {
  const s = doc.shop;
  const set = (patch: Partial<typeof s>) => mutate((d) => { d.shop = { ...d.shop, ...patch }; });
  return (
    <Group title="Shop / category listing" defaultOpen>
      <Sel label="Columns (desktop)" value={String(s.cols)} onChange={(v) => set({ cols: Number(v) as typeof s.cols })}
        options={[{ value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4", label: "4" }]} />
      <Sel label="Columns (mobile)" value={String(s.colsMobile)} onChange={(v) => set({ colsMobile: Number(v) as typeof s.colsMobile })}
        options={[{ value: "1", label: "1" }, { value: "2", label: "2" }]} />
      <Sel label="Grid gap" value={s.gap} onChange={(v) => set({ gap: v })}
        options={[{ value: "sm", label: "compact" }, { value: "md", label: "normal" }, { value: "lg", label: "airy" }]} />
      <Bool label="Show search bar" value={s.showSearch} onChange={(v) => set({ showSearch: v })} />
      <Bool label="Show sort" value={s.showSort} onChange={(v) => set({ showSort: v })} />
      <Bool label="Show filters" value={s.showFilters} onChange={(v) => set({ showFilters: v })} />
    </Group>
  );
}

function PdpInspector({ doc, mutate }: { doc: BuilderDoc; mutate: (fn: (d: BuilderDoc) => void) => void }) {
  const s = doc.pdp;
  const set = (patch: Partial<typeof s>) => mutate((d) => { d.pdp = { ...d.pdp, ...patch }; });
  return (
    <Group title="Product page" defaultOpen>
      <Bool label="Sticky gallery (desktop)" value={s.stickyGallery} onChange={(v) => set({ stickyGallery: v })} />
      <Sel label="Related products columns" value={String(s.relatedCols)} onChange={(v) => set({ relatedCols: Number(v) as typeof s.relatedCols })}
        options={[{ value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4", label: "4" }]} />
      <p className="text-[10px] text-slate-400">Prices, variants, stock and purchase flow are business data — the builder never touches them.</p>
    </Group>
  );
}

function CartInspector({ doc, mutate }: { doc: BuilderDoc; mutate: (fn: (d: BuilderDoc) => void) => void }) {
  const c = doc.cart;
  const set = (patch: Partial<typeof c>) => mutate((d) => { d.cart = { ...d.cart, ...patch }; });
  return (
    <Group title="Cart" defaultOpen>
      <Bool label="Show free-shipping note" value={c.showFreeShipNote} onChange={(v) => set({ showFreeShipNote: v })} />
      <p className="text-[10px] text-slate-400">Checkout steps and delivery rules are business logic and are locked.</p>
    </Group>
  );
}
