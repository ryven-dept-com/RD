import "server-only";
import { verifyRequest } from "@/lib/admin-auth";
import { getAllSlugs, getShopFilterOptions, getStorefrontCategories } from "@/lib/queries";
import { applySafeFixes, scanBuilder, scoreReport } from "@/lib/builder/health";
import { getBuilderStore, saveBuilderDraft } from "@/lib/builder/storage";

export const dynamic = "force-dynamic";

async function buildCtx() {
  const [cats, all, opts] = await Promise.all([
    getStorefrontCategories().catch(() => []),
    getAllSlugs().catch(() => []),
    getShopFilterOptions().catch(() => ({ sizes: [], colors: [], collections: [] })),
  ]);
  return {
    categories: cats.map((c) => c.name),
    collections: opts.collections,
    slugs: all,
  };
}

/**
 * Storefront Health / QA + REPAIR.
 *
 *   GET  → full diagnostic report (scores + issues with page/section/property)
 *   POST → { fix?: string[] } — apply deterministic SAFE auto-fixes to the
 *          draft (or every safe fix when body.fix is omitted) and return a
 *          modification report. NEVER touches business data.
 */
export async function GET(request: Request) {
  const admin = await verifyRequest(request);
  if (!admin) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const store = await getBuilderStore();
  const ctx = await buildCtx();
  const issues = scanBuilder(store.draft, ctx);
  return Response.json({ ok: true, report: scoreReport(issues), hasPublished: Boolean(store.published) });
}

export async function POST(request: Request) {
  const admin = await verifyRequest(request);
  if (!admin) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  let body: { fix?: string[] };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }
  const store = await getBuilderStore();
  const ctx = await buildCtx();
  let issues = scanBuilder(store.draft, ctx);
  if (Array.isArray(body.fix) && body.fix.length) {
    issues = issues.filter((i) => body.fix!.includes(i.id));
  }
  const safe = issues.filter((i) => Boolean(i.fix));
  const { doc, report } = applySafeFixes(store.draft, safe);
  if (report.length > 0) {
    await saveBuilderDraft(doc, `Repair: ${report.length} safe fix(es)`);
  }
  const remaining = scanBuilder(doc, ctx);
  return Response.json({
    ok: true,
    report,
    applied: report.length,
    remaining: scoreReport(remaining),
  });
}
