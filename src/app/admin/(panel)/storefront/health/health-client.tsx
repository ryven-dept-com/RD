"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAdmin } from "@/context/admin-context";
import type { Issue } from "@/lib/builder/validate";
import type { HealthReport } from "@/lib/builder/health";

/**
 * Storefront Health dashboard — overall + per-category scores, the full
 * issue list (page → section → property) with deep links into the builder,
 * per-issue safe auto-fix, and the REPAIR STOREFRONT action (applies every
 * deterministic safe fix and reports each modification). Auto-fixes only
 * ever rewrite builder configuration — never business data.
 */

const SEV_STYLE = {
  error: "bg-red-100 text-red-700 border-red-200",
  warning: "bg-amber-100 text-amber-700 border-amber-200",
} as const;

export function HealthClient() {
  const { adminFetch } = useAdmin();
  const [report, setReport] = useState<HealthReport | null>(null);
  const [hasPublished, setHasPublished] = useState(false);
  const [busy, setBusy] = useState(false);
  const [repairReport, setRepairReport] = useState<string[] | null>(null);

  const scan = useCallback(async () => {
    const r = await adminFetch("/api/admin/builder/health").then((x) => x.json()).catch(() => null);
    if (r?.ok) {
      setReport(r.report);
      setHasPublished(Boolean(r.hasPublished));
    }
  }, [adminFetch]);

  useEffect(() => {
    // Initial diagnostics — setState happens only in the async continuation.
    void (async () => {
      const r = await adminFetch("/api/admin/builder/health").then((x) => x.json()).catch(() => null);
      if (r?.ok) {
        setReport(r.report);
        setHasPublished(Boolean(r.hasPublished));
      }
    })();
  }, [adminFetch]);

  const fixOne = async (issue: Issue) => {
    setBusy(true);
    const r = await adminFetch("/api/admin/builder/health", {
      method: "POST",
      body: JSON.stringify({ fix: [issue.id] }),
    }).then((x) => x.json()).catch(() => null);
    setBusy(false);
    if (r?.ok) {
      setRepairReport(r.report);
      setReport(r.remaining);
    }
  };

  const repairAll = async () => {
    setBusy(true);
    setRepairReport(null);
    const r = await adminFetch("/api/admin/builder/health", {
      method: "POST",
      body: JSON.stringify({}),
    }).then((x) => x.json()).catch(() => null);
    setBusy(false);
    if (r?.ok) {
      setRepairReport(r.report);
      setReport(r.remaining);
    }
  };

  const errors = report?.issues.filter((i) => i.severity === "error").length ?? 0;
  const warnings = report?.issues.filter((i) => i.severity === "warning").length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
        <h1 className="text-sm font-bold uppercase tracking-widest text-slate-700">Storefront Health</h1>
        {!hasPublished && <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">Builder not published — theme home is live</span>}
        <div className="ms-auto flex items-center gap-2">
          <button onClick={scan} disabled={busy} className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50">Run diagnostics</button>
          <button onClick={repairAll} disabled={busy} className="rounded bg-red-600 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white hover:bg-red-500 disabled:opacity-50">
            Repair storefront
          </button>
        </div>
      </div>

      {repairReport && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
          <p className="mb-1 font-bold uppercase tracking-widest">Repair report — {repairReport.length} modification(s)</p>
          {repairReport.length === 0 ? <p>No safe fixes were necessary.</p> : (
            <ul className="list-disc ps-4">{repairReport.map((r, i) => <li key={i}>{r}</li>)}</ul>
          )}
        </div>
      )}

      {report && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-9">
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <p className="text-2xl font-black tabular-nums" style={{ color: report.score >= 90 ? "#059669" : report.score >= 70 ? "#d97706" : "#dc2626" }}>{report.score}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Overall</p>
            </div>
            {Object.entries(report.categories).map(([name, c]) => (
              <div key={name} className="rounded-lg border border-slate-200 bg-white p-3 text-center">
                <p className="text-xl font-black tabular-nums" style={{ color: c.score >= 90 ? "#059669" : c.score >= 70 ? "#d97706" : "#dc2626" }}>{c.score}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{name}</p>
                <p className="text-[10px] text-slate-400">{c.issues} issue(s)</p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-600">
            Found: <span className="text-red-600">{errors} error(s)</span> · <span className="text-amber-600">{warnings} warning(s)</span> · {report.issues.length} total
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {report.issues.length === 0 && (
              <p className="px-4 py-6 text-center text-sm font-semibold text-emerald-700">PASS — no configuration problems detected.</p>
            )}
            {report.issues.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5 text-xs">
                <span className={`rounded border px-1.5 py-0.5 font-bold uppercase ${SEV_STYLE[i.severity]}`}>{i.severity}</span>
                <span className="font-mono text-[10px] text-slate-400">{i.page}{i.sectionId ? ` / ${i.sectionId.slice(0, 10)}` : ""} / {i.property}</span>
                <span className="flex-1 font-medium text-slate-700">{i.message}</span>
                <span className="text-slate-400">{i.suggested}</span>
                {i.fix && (
                  <button onClick={() => fixOne(i)} disabled={busy} className="rounded bg-slate-800 px-2 py-1 font-semibold text-white hover:bg-slate-700 disabled:opacity-50">Auto fix</button>
                )}
                {i.sectionId && (
                  <Link href={`/admin/builder?section=${i.sectionId}`} className="rounded border border-slate-300 px-2 py-1 font-semibold text-slate-600 hover:bg-slate-100">Open in builder</Link>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
