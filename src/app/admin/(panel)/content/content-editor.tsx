"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MediaLibraryPanel } from "@/components/admin/media-picker";
import type { CmsData } from "@/lib/cms";
import { ProductListEditor, type ProductOption } from "./content-products";
import {
  AnnouncementEditor,
  BannersEditor,
  BrandStoryEditor,
  CollectionsEditor,
  FooterEditor,
  HeroEditor,
  NewsletterEditor,
} from "./content-sections";

const TABS = [
  { id: "hero", label: "Hero" },
  { id: "collections", label: "Collections" },
  { id: "featured", label: "Featured" },
  { id: "newArrivals", label: "New Arrivals" },
  { id: "brandStory", label: "Brand Story" },
  { id: "banners", label: "Banners" },
  { id: "announcement", label: "Announcement" },
  { id: "newsletter", label: "Newsletter" },
  { id: "footer", label: "Footer" },
  { id: "media", label: "Media" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ContentEditor({
  cms,
  products,
}: {
  cms: CmsData;
  products: ProductOption[];
}) {
  const [tab, setTab] = useState<TabId>("hero");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const dirtyMap = useRef<Partial<Record<TabId, boolean>>>({});
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // Stable per-tab dirty handlers (created once; they write to the ref only
  // when invoked, never during render).
  const dirtyHandlers = useMemo(() => {
    const map = {} as Record<TabId, (d: boolean) => void>;
    for (const t of TABS) {
      map[t.id] = (dirty: boolean) => {
        dirtyMap.current[t.id] = dirty;
      };
    }
    return map;
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const switchTab = (next: TabId) => {
    if (next === tab) return;
    if (dirtyMap.current[tab]) {
      const ok = confirm(
        "You have unsaved changes in this section. Discard them?",
      );
      if (!ok) return;
      dirtyMap.current[tab] = false;
    }
    setTab(next);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Content</h1>
        <p className="mt-1 text-sm text-slate-500">
          Edit the storefront homepage, footer and promotions — changes go
          live after saving
        </p>
      </div>

      {/* tab navigation (horizontal scroll on mobile) */}
      <nav
        className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto border-b border-slate-200 px-4 sm:mx-0 sm:flex-wrap sm:px-0"
        aria-label="Content sections"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
            className={`relative shrink-0 whitespace-nowrap px-3.5 py-2.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? "text-slate-900"
                : "text-slate-500 hover:text-slate-800"
            }`}
            aria-current={tab === t.id ? "page" : undefined}
          >
            {t.label}
            {tab === t.id && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-slate-900" />
            )}
          </button>
        ))}
      </nav>

      {/* active section */}
      {tab === "hero" && (
        <HeroEditor
          initial={cms.hero}
          notify={notify}
          onDirtyChange={dirtyHandlers.hero}
        />
      )}
      {tab === "collections" && (
        <CollectionsEditor
          initial={cms.collections}
          notify={notify}
          onDirtyChange={dirtyHandlers.collections}
        />
      )}
      {tab === "featured" && (
        <ProductListEditor
          title="Featured pieces"
          subtitle="Curated products shown in the “Featured pieces” section, in this exact order"
          group="featured"
          initial={cms.featured}
          products={products}
          notify={notify}
          onDirtyChange={dirtyHandlers.featured}
        />
      )}
      {tab === "newArrivals" && (
        <ProductListEditor
          title="New arrivals"
          subtitle="Curated products shown in the “New arrivals” section, in this exact order"
          group="newArrivals"
          initial={cms.newArrivals}
          products={products}
          notify={notify}
          onDirtyChange={dirtyHandlers.newArrivals}
        />
      )}
      {tab === "brandStory" && (
        <BrandStoryEditor
          initial={cms.brandStory}
          notify={notify}
          onDirtyChange={dirtyHandlers.brandStory}
        />
      )}
      {tab === "banners" && (
        <BannersEditor
          initial={cms.banners}
          notify={notify}
          onDirtyChange={dirtyHandlers.banners}
        />
      )}
      {tab === "announcement" && (
        <AnnouncementEditor
          initial={cms.announcement}
          notify={notify}
          onDirtyChange={dirtyHandlers.announcement}
        />
      )}
      {tab === "newsletter" && (
        <NewsletterEditor
          initial={cms.newsletter}
          notify={notify}
          onDirtyChange={dirtyHandlers.newsletter}
        />
      )}
      {tab === "footer" && (
        <FooterEditor
          initial={cms.footer}
          notify={notify}
          onDirtyChange={dirtyHandlers.footer}
        />
      )}
      {tab === "media" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Media library</h2>
          <p className="mb-4 mt-0.5 text-xs text-slate-400">
            Files uploaded here can be picked from any image, video or audio
            field. Deleting is blocked while a file is still used by store
            content.
          </p>
          <MediaLibraryPanel
            onSelect={(url) => {
              void navigator.clipboard?.writeText(url).catch(() => undefined);
              notify("Media URL copied to clipboard.", true);
            }}
          />
        </div>
      )}

      {/* toast */}
      {toast && (
        <div
          role="status"
          className={`fixed inset-x-4 bottom-4 z-[60] mx-auto max-w-md rounded-xl px-4 py-3 text-center text-sm font-medium text-white shadow-lg ${
            toast.ok ? "bg-emerald-600" : "bg-rose-600"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
