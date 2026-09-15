import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { memoizePerRequest } from "@/lib/cache";
import { defaultBuilderDoc } from "./defaults";
import { sanitizeDoc } from "./validate";
import type { BuilderDoc, BuilderStore } from "./types";

/**
 * Builder persistence — one JSON document in the `settings` key/value table
 * (key `storefrontBuilder`), read through the same per-request memoization
 * as the rest of the store settings: switching/publishing adds ZERO extra
 * queries to public page loads.
 *
 * Versioning model:
 *   draft     — what the editor is working on
 *   published — what customers see (only set by an explicit publish)
 *   history   — last 25 labelled snapshots for rollback
 *
 * Every write re-sanitizes the whole document, so a half-written or hostile
 * config can never be stored; if parsing fails the previous store is kept.
 */

export const BUILDER_SETTING_KEY = "storefrontBuilder";
const MAX_HISTORY = 25;

function emptyStore(): BuilderStore {
  return {
    version: 1,
    updatedAt: new Date(0).toISOString(),
    draft: defaultBuilderDoc(),
    published: null,
    history: [],
  };
}

function parseStore(raw: string | undefined): BuilderStore {
  if (!raw || !raw.trim()) return emptyStore();
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return emptyStore();
    const base = emptyStore();
    return {
      version: typeof parsed.version === "number" && parsed.version >= 1 ? Math.min(parsed.version, 1_000_000) : 1,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : base.updatedAt,
      draft: sanitizeDoc(parsed.draft ?? parsed.published ?? base.draft),
      published: parsed.published ? sanitizeDoc(parsed.published) : null,
      history: Array.isArray(parsed.history)
        ? parsed.history
            .filter((h): h is Record<string, unknown> => Boolean(h) && typeof h === "object")
            .slice(0, MAX_HISTORY)
            .map((h) => ({
              at: typeof h.at === "string" ? h.at : new Date().toISOString(),
              label: typeof h.label === "string" ? h.label.slice(0, 120) : "Snapshot",
              doc: sanitizeDoc(h.doc),
            }))
        : [],
    };
  } catch {
    // corrupt JSON → pristine store; never break the storefront
    return emptyStore();
  }
}

async function loadStore(): Promise<BuilderStore> {
  try {
    const row = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, BUILDER_SETTING_KEY))
      .limit(1);
    return parseStore(row[0]?.value);
  } catch {
    return emptyStore();
  }
}

/** Per-request memoized read — public pages call this for free. */
export const getBuilderStore = memoizePerRequest(loadStore);

async function writeStore(store: BuilderStore): Promise<void> {
  const value = JSON.stringify(store);
  await db
    .insert(settings)
    .values({ key: BUILDER_SETTING_KEY, value })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value },
    });
}

function pushHistory(store: BuilderStore, label: string, doc: BuilderDoc): BuilderStore {
  return {
    ...store,
    history: [
      { at: new Date().toISOString(), label, doc },
      ...store.history,
    ].slice(0, MAX_HISTORY),
  };
}

/** Save the editor draft (validated). Returns the new store. */
export async function saveBuilderDraft(doc: unknown, label = "Save draft"): Promise<BuilderStore> {
  const current = await loadStore();
  const clean = sanitizeDoc(doc);
  const next: BuilderStore = {
    ...pushHistory(current, label, current.draft),
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
    draft: clean,
  };
  await writeStore(next);
  return next;
}

/**
 * Publish — transactional by construction: the draft is fully sanitized and
 * written together with the history entry in ONE row write; on any failure
 * the previous published configuration remains untouched.
 */
export async function publishBuilder(label = "Publish"): Promise<BuilderStore> {
  const current = await loadStore();
  const clean = sanitizeDoc(current.draft);
  const next: BuilderStore = {
    ...pushHistory(current, label, current.published ?? current.draft),
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
    draft: clean,
    published: clean,
  };
  await writeStore(next);
  return next;
}

/** Roll back the published version to a history snapshot. */
export async function rollbackBuilder(index: number): Promise<BuilderStore> {
  const current = await loadStore();
  const snap = current.history[index];
  if (!snap) throw new Error("Unknown history entry");
  const doc = sanitizeDoc(snap.doc);
  const next: BuilderStore = {
    ...pushHistory(current, `Rollback → ${snap.label}`, current.published ?? current.draft),
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
    draft: doc,
    published: doc,
  };
  await writeStore(next);
  return next;
}

/** Discard the draft (back to the published version or defaults). */
export async function resetBuilderDraft(): Promise<BuilderStore> {
  const current = await loadStore();
  const next: BuilderStore = {
    ...current,
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
    draft: current.published ? sanitizeDoc(current.published) : defaultBuilderDoc(),
  };
  await writeStore(next);
  return next;
}
