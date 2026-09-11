"use client";

import { useRef, useState } from "react";
import { MediaPicker } from "./media-picker";
import { useAdmin } from "@/context/admin-context";

type Kind = "image" | "video" | "audio";

const ACCEPT: Record<Kind | "any", string> = {
  image: "image/*",
  video: "video/mp4,video/webm",
  audio: "audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/mp4",
  any: "image/*,video/mp4,video/webm,audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/mp4",
};

/** Guess the media kind of an existing URL for preview purposes. */
function guessKind(url: string): Kind {
  const u = url.split("?")[0].toLowerCase();
  if (/\.(mp4|webm)$/.test(u)) return "video";
  if (/\.(mp3|wav|ogg|m4a|aac)$/.test(u)) return "audio";
  return "image";
}

export function MediaField({
  label,
  value,
  onChange,
  kind = "image",
  hint,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  /** Which media types this field accepts. */
  kind?: Kind | "any";
  hint?: string;
}) {
  const { adminFetch } = useAdmin();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await adminFetch("/api/admin/media", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Upload failed");
      onChange(String(data.media.url));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const previewKind = value ? guessKind(value) : null;

  return (
    <div className="min-w-0">
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>

      {/* preview */}
      <div className="mb-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        {value ? (
          previewKind === "video" ? (
            <video src={value} controls className="max-h-48 w-full bg-black object-contain" />
          ) : previewKind === "audio" ? (
            <div className="p-3">
              <audio src={value} controls className="w-full" />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt={`${label} preview`}
              className="max-h-48 w-full object-cover"
            />
          )
        ) : (
          <div className="flex h-24 items-center justify-center text-xs text-slate-400">
            No {kind === "any" ? "media" : kind} selected
          </div>
        )}
      </div>

      {/* actions */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-700"
        >
          Choose from library
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Upload new"}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50"
          >
            Clear
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT[kind]}
        className="hidden"
        onChange={(e) => void upload(e.target.files)}
      />

      {value && (
        <p className="mt-1.5 truncate text-[11px] text-slate-400" title={value}>
          {value}
        </p>
      )}
      {hint && !error && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(url) => {
          onChange(url);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}
