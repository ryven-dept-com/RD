"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAdmin } from "@/context/admin-context";

export type MediaItem = {
  id: number;
  originalName: string;
  mimeType: string;
  kind: "image" | "video" | "audio";
  size: number;
  url: string;
  createdAt: string;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The media library itself (upload bar + grid + safe delete). Used both
 * inside the picker modal and as the standalone "Media" tab in Content.
 */
export function MediaLibraryPanel({
  onSelect,
  emptyHint,
}: {
  /** Called with the media URL when a file is chosen. */
  onSelect?: (url: string) => void;
  emptyHint?: string;
}) {
  const { adminFetch } = useAdmin();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  /** Bumping the tick re-runs the fetch effect (after uploads/deletes). */
  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await adminFetch("/api/admin/media");
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !data.ok) throw new Error(data.error ?? "Load failed");
        setItems(data.media as MediaItem[]);
        setError("");
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load media",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adminFetch, reloadTick]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        const res = await adminFetch("/api/admin/media", {
          method: "POST",
          body: form,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? `Failed to upload ${file.name}`);
        }
      }
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = async (item: MediaItem) => {
    if (!confirm(`Delete "${item.originalName}"? This cannot be undone.`)) {
      return;
    }
    setDeletingId(item.id);
    setError("");
    try {
      const res = await adminFetch(`/api/admin/media/${item.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Delete failed");
      setItems((prev) => prev.filter((m) => m.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      {/* upload bar */}
      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/*,video/mp4,video/webm,audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/mp4"
        className="hidden"
        onChange={(e) => void upload(e.target.files)}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-3.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16" />
        </svg>
        {uploading ? "Uploading…" : "Upload from device (phone or computer)"}
      </button>
      <p className="mt-1.5 text-center text-[11px] text-slate-400">
        JPG, PNG, WebP, GIF, AVIF, SVG, MP4, WebM, MP3, WAV, OGG · max 8 MB per
        file · stored persistently in the store database
      </p>

      {error && (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      {/* grid */}
      <div className="mt-4">
        {loading ? (
          <p className="py-10 text-center text-sm text-slate-400">
            Loading media…
          </p>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">
            {emptyHint ?? "No media yet — upload your first file above."}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {items.map((m) => (
              <li key={m.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onSelect?.(m.url)}
                  disabled={!onSelect}
                  className="block w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-left transition-colors enabled:hover:border-slate-900"
                  title={onSelect ? `Use ${m.originalName}` : m.originalName}
                >
                  <div className="aspect-square w-full overflow-hidden">
                    {m.kind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.url}
                        alt={m.originalName}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : m.kind === "video" ? (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-900 text-slate-300">
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="5" width="14" height="14" rx="2" />
                          <path d="M16 10l6-3v10l-6-3" />
                        </svg>
                        <span className="text-[10px] font-semibold uppercase tracking-wide">
                          Video
                        </span>
                      </div>
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-400">
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 18V6l10-2v12" />
                          <circle cx="6" cy="18" r="3" />
                          <circle cx="16" cy="16" r="3" />
                        </svg>
                        <span className="text-[10px] font-semibold uppercase tracking-wide">
                          Audio
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="px-2 py-1.5">
                    <p className="truncate text-[11px] font-medium text-slate-700">
                      {m.originalName}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {formatSize(m.size)}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => void remove(m)}
                  disabled={deletingId === m.id}
                  className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/70 text-white backdrop-blur transition-colors hover:bg-rose-600 disabled:opacity-50"
                  aria-label={`Delete ${m.originalName}`}
                >
                  {deletingId === m.id ? (
                    <span className="text-[10px]">…</span>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M4 7h16M9 7V5h6v2m-8 0l1 13h8l1-13" />
                    </svg>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Modal wrapper around the library panel (select mode). */
export function MediaPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-slate-900/60"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-h-[85dvh] sm:max-w-3xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5">
          <div>
            <h2 className="font-semibold text-slate-900">Media library</h2>
            <p className="text-xs text-slate-400">
              Tap a file to use it, or upload something new
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close media library"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <MediaLibraryPanel onSelect={onSelect} />
        </div>
      </div>
    </div>
  );
}
