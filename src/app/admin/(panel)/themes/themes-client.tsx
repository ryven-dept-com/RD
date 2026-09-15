"use client";

import { useState } from "react";
import { useAdmin } from "@/context/admin-context";
import type { ThemeId } from "@/themes/types";

type Swatch = { bg: string; surface: string; fg: string; accent: string };
type ThemeCard = {
  id: ThemeId;
  name: string;
  tagline: string;
  description: string;
  tags: string[];
  swatch: Swatch;
};

/** Mini-storefront typography hints per theme (preview cards only). */
const PREVIEW_STYLE: Record<
  ThemeId,
  { font: string; transform: "uppercase" | "none"; tracking: string; sample: string }
> = {
  noir: { font: "var(--font-anton)", transform: "uppercase", tracking: "0.02em", sample: "NOIR" },
  concrete: { font: "var(--font-space-grotesk)", transform: "uppercase", tracking: "-0.01em", sample: "RAW 01" },
  district: { font: "var(--font-anton)", transform: "uppercase", tracking: "0.02em", sample: "DISTRICT" },
  nightshift: { font: "var(--font-space-grotesk)", transform: "uppercase", tracking: "0.06em", sample: "NIGHT" },
  archive: { font: "var(--font-fraunces)", transform: "none", tracking: "-0.01em", sample: "Archive" },
  signature: { font: "var(--font-fraunces)", transform: "none", tracking: "0.12em", sample: "Signature" },
  seventh: { font: "var(--font-archivo-black)", transform: "uppercase", tracking: "0", sample: "BLOCK 7" },
  atelier: { font: "var(--font-syne)", transform: "uppercase", tracking: "-0.01em", sample: "Atelier" },
};

/** Pure-CSS mini storefront used as the large visual preview on each card. */
function ThemePreviewArt({ theme }: { theme: ThemeCard }) {
  const s = theme.swatch;
  const p = PREVIEW_STYLE[theme.id];
  return (
    <div
      aria-hidden
      className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-slate-200"
      style={{ backgroundColor: s.bg }}
    >
      {/* mini navbar */}
      <div
        className="flex items-center justify-between px-4 pt-3"
        style={{ color: s.fg }}
      >
        <span className="text-[9px] font-bold tracking-[0.25em]">RUVEN</span>
        <span className="flex gap-1.5 opacity-60">
          <span className="h-1 w-4 rounded-full" style={{ backgroundColor: s.fg }} />
          <span className="h-1 w-4 rounded-full" style={{ backgroundColor: s.fg }} />
          <span className="h-1 w-4 rounded-full" style={{ backgroundColor: s.fg }} />
        </span>
      </div>
      {/* mini hero */}
      <div className="px-4 pt-4">
        <div className="h-1 w-6 rounded-full" style={{ backgroundColor: s.accent }} />
        <p
          className="mt-2 leading-none"
          style={{
            color: s.fg,
            fontFamily: p.font,
            fontSize: "clamp(1.4rem, 2.6vw, 2rem)",
            textTransform: p.transform,
            letterSpacing: p.tracking,
          }}
        >
          {p.sample}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span
            className="rounded-full px-2.5 py-1 text-[8px] font-bold uppercase tracking-widest"
            style={{ backgroundColor: s.fg, color: s.bg }}
          >
            Shop
          </span>
          <span
            className="rounded-full border px-2.5 py-1 text-[8px] font-bold uppercase tracking-widest"
            style={{ borderColor: `${s.fg}55`, color: s.fg }}
          >
            Lookbook
          </span>
        </div>
      </div>
      {/* mini product cards */}
      <div className="mt-4 flex gap-2 px-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex-1">
            <div
              className="aspect-[3/4] rounded-md"
              style={{ backgroundColor: s.surface }}
            />
            <div
              className="mt-1.5 h-1 w-3/4 rounded-full opacity-70"
              style={{ backgroundColor: s.fg }}
            />
            <div
              className="mt-1 h-1 w-1/3 rounded-full opacity-40"
              style={{ backgroundColor: s.fg }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ThemesClient({
  initialActive,
  themes,
}: {
  initialActive: ThemeId;
  themes: ThemeCard[];
}) {
  const { adminFetch } = useAdmin();
  const [activeId, setActiveId] = useState<ThemeId>(initialActive);
  const [busy, setBusy] = useState<ThemeId | null>(null);
  const [confirming, setConfirming] = useState<ThemeCard | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const previewTheme = async (theme: ThemeCard) => {
    setBusy(theme.id);
    setMessage(null);
    try {
      const res = await adminFetch("/api/admin/themes/preview-token", {
        method: "POST",
        body: JSON.stringify({ themeId: theme.id }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Preview unavailable");
      }
      // Opens the storefront in the selected theme WITHOUT activating it.
      const url = `/api/theme/preview?rd_theme=${encodeURIComponent(theme.id)}&token=${encodeURIComponent(data.token)}&next=${encodeURIComponent("/")}`;
      window.open(url, "_blank", "noopener");
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "Could not start the preview.",
      });
    } finally {
      setBusy(null);
    }
  };

  const activateTheme = async (theme: ThemeCard) => {
    setConfirming(null);
    setBusy(theme.id);
    setMessage(null);
    try {
      const res = await adminFetch("/api/admin/themes/activate", {
        method: "POST",
        body: JSON.stringify({ themeId: theme.id }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Activation failed");
      }
      setActiveId(theme.id);
      setMessage({
        kind: "ok",
        text: `${theme.name} is now live on the storefront.`,
      });
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "Could not activate the theme.",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Themes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Storefront art directions. Preview renders privately for admins; Activate
            changes only presentation — products, orders and delivery pricing are never touched.
          </p>
        </div>
        <span className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
          Active: {themes.find((t) => t.id === activeId)?.name ?? activeId}
        </span>
      </div>

      {message && (
        <div
          role="status"
          className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
            message.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.text}{" "}
          {message.kind === "ok" && (
            <a href="/" target="_blank" rel="noopener noreferrer" className="font-semibold underline">
              View storefront
            </a>
          )}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {themes.map((theme) => {
          const isActive = theme.id === activeId;
          return (
            <article
              key={theme.id}
              className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md ${
                isActive ? "border-slate-900 ring-2 ring-slate-900/10" : "border-slate-200"
              }`}
            >
              <div className="p-4 pb-0">
                <ThemePreviewArt theme={theme} />
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold tracking-tight">{theme.name}</h2>
                  {isActive && (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                      ● Active
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {theme.tagline}
                </p>
                <p className="mt-2 line-clamp-2 text-sm text-slate-600">{theme.description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {theme.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button
                    onClick={() => previewTheme(theme)}
                    disabled={busy !== null}
                    className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                  >
                    {busy === theme.id ? "Working…" : "Preview"}
                  </button>
                  <a
                    href={`/admin/themes/${encodeURIComponent(theme.id)}/customize`}
                    className="rounded-lg border border-slate-300 px-3 py-2.5 text-center text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Customize
                  </a>
                  <button
                    onClick={() => !isActive && setConfirming(theme)}
                    disabled={isActive || busy !== null}
                    className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                      isActive
                        ? "cursor-default bg-emerald-600 text-white"
                        : "bg-slate-900 text-white hover:bg-slate-700"
                    }`}
                  >
                    {isActive ? "Active" : "Activate"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* confirmation dialog — activation always asks first */}
      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm theme activation"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold">Activate {confirming.name}?</h3>
            <p className="mt-2 text-sm text-slate-600">
              The storefront will immediately switch to{" "}
              <strong>{confirming.name}</strong> for every visitor. Only the
              presentation changes — products, prices, orders, delivery settings
              and tracking stay exactly as they are.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirming(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => activateTheme(confirming)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Activate theme
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
