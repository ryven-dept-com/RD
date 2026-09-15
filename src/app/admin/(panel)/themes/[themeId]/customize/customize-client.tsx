"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAdmin } from "@/context/admin-context";
import {
  COLOR_FIELDS,
  customizationToCssVars,
  FONT_CATALOG,
  FONT_FIELDS,
  hexToTriplet,
  isEmptyCustomization,
  type ColorField,
  type ColorOverrides,
  type FontCategory,
  type FontField,
  type FontOverrides,
  type ThemeCustomization,
} from "@/themes/customize";
import type { ThemeId } from "@/themes/types";

/* ------------------------------------------------------------------ */
/* field metadata                                                      */
/* ------------------------------------------------------------------ */

const FONT_FIELD_META: Record<FontField, { label: string; hint: string; categories: FontCategory[] }> = {
  display: { label: "Heading / display font", hint: "Hero titles and section headings", categories: ["latin-display"] },
  body: { label: "Body font", hint: "Paragraphs and general interface text", categories: ["latin-body"] },
  nav: { label: "Navigation font", hint: "Header and mobile menu links", categories: ["latin-body", "latin-display"] },
  button: { label: "Button font", hint: "Add-to-cart and primary commerce buttons", categories: ["latin-body", "latin-display"] },
  productTitle: { label: "Product title font", hint: "Product card names", categories: ["latin-display", "latin-body"] },
  price: { label: "Price font", hint: "Prices on cards", categories: ["latin-body", "latin-display"] },
  arabicDisplay: { label: "Arabic display font", hint: "Arabic headings (RTL only)", categories: ["arabic-display"] },
  arabicBody: { label: "Arabic body font", hint: "Arabic text (RTL only)", categories: ["arabic-body", "arabic-display"] },
};

const COLOR_FIELD_META: Record<ColorField, { label: string; group: string }> = {
  bg: { label: "Background", group: "Canvas" },
  surface: { label: "Surface", group: "Canvas" },
  text: { label: "Primary text", group: "Text" },
  textMuted: { label: "Secondary text", group: "Text" },
  accent: { label: "Accent", group: "Brand" },
  buttonBg: { label: "Button background", group: "Buttons" },
  buttonText: { label: "Button text", group: "Buttons" },
  border: { label: "Borders", group: "Structure" },
  cardBg: { label: "Product card background", group: "Structure" },
  headerBg: { label: "Header background", group: "Chrome" },
  footerBg: { label: "Footer background", group: "Chrome" },
  tickerBg: { label: "Announcement background", group: "Chrome" },
  tickerText: { label: "Announcement text", group: "Chrome" },
  heroOverlay: { label: "Hero overlay", group: "Chrome" },
};

/* ------------------------------------------------------------------ */

export function CustomizeClient({
  theme,
  isActive,
  initialCustomization,
  previewToken,
}: {
  theme: { id: ThemeId; name: string; tagline: string; description: string };
  isActive: boolean;
  initialCustomization: ThemeCustomization;
  previewToken: string;
}) {
  const { adminFetch } = useAdmin();
  const [fonts, setFonts] = useState<FontOverrides>(initialCustomization.fonts);
  const [colors, setColors] = useState<ColorOverrides>(initialCustomization.colors);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [previewReady, setPreviewReady] = useState(false);

  const draft: ThemeCustomization = useMemo(() => ({ fonts, colors }), [fonts, colors]);
  const dirty = useMemo(
    () =>
      JSON.stringify(draft) !==
      JSON.stringify({ fonts: initialCustomization.fonts, colors: initialCustomization.colors }),
    [draft, initialCustomization],
  );
  const hasOverrides = !isEmptyCustomization(draft);

  const previewSrc = `/api/theme/preview?rd_theme=${encodeURIComponent(theme.id)}&token=${encodeURIComponent(previewToken)}&next=${encodeURIComponent("/")}`;

  /** Push the current draft to the preview iframe as scoped CSS variables. */
  const sendLiveOverrides = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const vars: Record<string, string> = {};
    for (const [k, v] of Object.entries(customizationToCssVars(draft))) {
      vars[k] = v;
    }
    // hero overlay is stored as hex in the form; the token is an rgb triplet
    const overlay = colors.heroOverlay;
    if (overlay) {
      const triplet = hexToTriplet(overlay);
      if (triplet) vars["--rd-hero-overlay"] = triplet;
    }
    win.postMessage({ type: "rd-theme-live-overrides", vars }, window.location.origin);
  }, [draft, colors.heroOverlay]);

  useEffect(() => {
    if (!previewReady) return;
    const t = setTimeout(sendLiveOverrides, 60);
    return () => clearTimeout(t);
  }, [draft, previewReady, sendLiveOverrides]);

  const reloadPreview = () => {
    setPreviewReady(false);
    const iframe = iframeRef.current;
    if (iframe) iframe.src = previewSrc;
  };

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await adminFetch("/api/admin/themes/customizations", {
        method: "PUT",
        body: JSON.stringify({ themeId: theme.id, customization: draft }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Could not save");
      setMessage({ kind: "ok", text: "Customization saved. It applies to this storefront only." });
      reloadPreview();
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Could not save" });
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!window.confirm(`Reset ${theme.name} to its original design? Saved typography and color overrides will be removed.`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await adminFetch("/api/admin/themes/customizations", {
        method: "DELETE",
        body: JSON.stringify({ themeId: theme.id }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Could not reset");
      setFonts({});
      setColors({});
      setMessage({ kind: "ok", text: `${theme.name} restored to its original design.` });
      reloadPreview();
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Could not reset" });
    } finally {
      setBusy(false);
    }
  };

  const fontOptions = (categories: FontCategory[]) =>
    FONT_CATALOG.filter((f) => f.categories.some((c) => categories.includes(c)));

  return (
    <div className="mx-auto max-w-7xl">
      {/* header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <a href="/admin/themes" className="text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600">
            ← Themes
          </a>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Customize {theme.name}</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Typography and colors for this storefront only. Other storefronts keep their own
            settings; products, orders and delivery are never affected.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isActive && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
              ● Active
            </span>
          )}
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
            {hasOverrides ? "Customized" : "Default design"}
          </span>
        </div>
      </div>

      {message && (
        <div
          role="status"
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
            message.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        {/* ------------------------- form column ------------------------- */}
        <div className="space-y-6">
          {/* THEME identity */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Theme</h2>
            <p className="mt-2 text-lg font-bold">{theme.name}</p>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{theme.tagline}</p>
            <p className="mt-2 text-sm text-slate-600">{theme.description}</p>
          </section>

          {/* TYPOGRAPHY */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Typography</h2>
              {Object.keys(fonts).length > 0 && (
                <button onClick={() => setFonts({})} className="text-xs font-semibold text-slate-400 hover:text-slate-600">
                  Clear fonts
                </button>
              )}
            </div>
            <div className="mt-4 space-y-4">
              {FONT_FIELDS.map((field) => {
                const meta = FONT_FIELD_META[field];
                return (
                  <label key={field} className="block">
                    <span className="text-sm font-semibold text-slate-700">{meta.label}</span>
                    <span className="block text-xs text-slate-400">{meta.hint}</span>
                    <select
                      value={fonts[field] ?? ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        setFonts((f) => {
                          const next = { ...f };
                          if (value) next[field] = value;
                          else delete next[field];
                          return next;
                        });
                      }}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    >
                      <option value="">Theme default</option>
                      {fontOptions(meta.categories).map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
          </section>

          {/* COLORS */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Colors</h2>
              {Object.keys(colors).length > 0 && (
                <button onClick={() => setColors({})} className="text-xs font-semibold text-slate-400 hover:text-slate-600">
                  Clear colors
                </button>
              )}
            </div>
            <div className="mt-4 space-y-5">
              {["Canvas", "Text", "Brand", "Buttons", "Structure", "Chrome"].map((group) => (
                <div key={group}>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{group}</p>
                  <div className="space-y-2.5">
                    {COLOR_FIELDS.filter((f) => COLOR_FIELD_META[f].group === group).map((field) => {
                      const meta = COLOR_FIELD_META[field];
                      const value = colors[field] ?? "";
                      const pickerValue = value && value.startsWith("#") && (value.length === 7 || value.length === 4)
                        ? (value.length === 4 ? `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}` : value)
                        : "#888888";
                      return (
                        <div key={field} className="flex items-center gap-3">
                          <input
                            type="color"
                            value={pickerValue}
                            onChange={(e) => {
                              const hex = e.target.value;
                              setColors((c) => ({ ...c, [field]: hex }));
                            }}
                            aria-label={`${meta.label} color picker`}
                            className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-slate-300 bg-white p-0.5"
                          />
                          <input
                            type="text"
                            value={value}
                            placeholder="default"
                            spellCheck={false}
                            onChange={(e) => {
                              const raw = e.target.value.trim();
                              setColors((c) => {
                                const next = { ...c };
                                if (!raw) delete next[field];
                                else next[field] = raw;
                                return next;
                              });
                            }}
                            className="w-28 rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono text-xs focus:border-slate-500 focus:outline-none"
                            aria-label={`${meta.label} value`}
                          />
                          <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{meta.label}</span>
                          {value && (
                            <button
                              onClick={() =>
                                setColors((c) => {
                                  const next = { ...c };
                                  delete next[field];
                                  return next;
                                })
                              }
                              className="text-xs font-semibold text-slate-300 hover:text-red-500"
                              aria-label={`Remove ${meta.label} override`}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* RESET */}
          <section className="rounded-2xl border border-red-200 bg-red-50/50 p-5">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-red-400">Reset</h2>
            <p className="mt-2 text-sm text-slate-600">
              Restore this storefront&apos;s original typography and colors. The theme itself is
              never deleted; business data is never touched.
            </p>
            <button
              onClick={reset}
              disabled={busy || !hasOverrides}
              className="mt-3 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40"
            >
              Reset this theme to defaults
            </button>
          </section>
        </div>

        {/* ------------------------ preview column ------------------------ */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Live preview — {theme.name}
              </p>
              <p className="text-[11px] text-slate-400">read-only · nothing is published until you save</p>
            </div>
            <iframe
              ref={iframeRef}
              src={previewSrc}
              onLoad={() => setPreviewReady(true)}
              title={`${theme.name} preview`}
              className="h-[70vh] w-full bg-slate-100 lg:h-[calc(100vh-14rem)]"
            />
          </div>

          {/* action bar */}
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <a
              href="/admin/themes"
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              Cancel
            </a>
            <button
              onClick={() => {
                setFonts(initialCustomization.fonts);
                setColors(initialCustomization.colors);
              }}
              disabled={!dirty || busy}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
            >
              Discard changes
            </button>
            <button
              onClick={save}
              disabled={busy || !dirty}
              className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-40"
            >
              {busy ? "Saving…" : "Save customization"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
