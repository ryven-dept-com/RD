"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "@/context/admin-context";
import { MediaField } from "@/components/admin/media-field";

type Settings = {
  storeName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  freeShippingThreshold: string;
  currency: string;
  seoTitle: string;
  seoDescription: string;
  logoUrl: string;
  faviconUrl: string;
  ogImageUrl: string;
};

export function SettingsForm({ initial }: { initial: Settings }) {
  const router = useRouter();
  const { adminFetch } = useAdmin();
  const [form, setForm] = useState<Settings>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const set =
    (key: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");
    const res = await adminFetch("/api/admin/settings", {
      method: "PUT",
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 1800);
    } else {
      setError("Failed to save settings.");
    }
  };

  const field =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900";
  const labelCls =
    "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500";

  const fields: [keyof Settings, string, string][] = [
    ["storeName", "Store name", "RUVEN DEPT"],
    ["contactEmail", "Contact email", "hello@ruven.dz"],
    ["contactPhone", "Contact phone", "+213 …"],
    ["address", "Address", "Algiers, Algeria"],
    ["freeShippingThreshold", "Free shipping threshold (دج)", "15000"],
    ["currency", "Currency symbol", "دج"],
  ];

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-6">
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-900">Store</h2>
        <p className="-mt-2 text-xs text-slate-400">
          Contact details can be shown in the footer via Content → Footer →
          “Show contact information”. The storefront announcement is managed
          under Content → Announcement.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map(([key, label, placeholder]) => (
            <div key={key}>
              <label className={labelCls}>{label}</label>
              <input
                value={form[key]}
                onChange={set(key)}
                placeholder={placeholder}
                className={field}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-900">SEO & branding</h2>
        <p className="-mt-2 text-xs text-slate-400">
          Controls the browser tab title, search description, favicon, logo and
          social sharing image. Leave a field empty to keep the built-in
          default.
        </p>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Site title (SEO)</label>
            <input
              value={form.seoTitle}
              onChange={set("seoTitle")}
              placeholder="Ruven Dept. — Heavyweight Streetwear Essentials"
              className={field}
            />
          </div>
          <div>
            <label className={labelCls}>Meta description (SEO)</label>
            <input
              value={form.seoDescription}
              onChange={set("seoDescription")}
              placeholder="Heavyweight essentials and utility outerwear…"
              className={field}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <MediaField
              label="Logo"
              value={form.logoUrl}
              onChange={(v) => setForm((f) => ({ ...f, logoUrl: v }))}
            />
            <MediaField
              label="Favicon"
              value={form.faviconUrl}
              onChange={(v) => setForm((f) => ({ ...f, faviconUrl: v }))}
              hint="Shown in browser tabs"
            />
            <MediaField
              label="Social sharing image"
              value={form.ogImageUrl}
              onChange={(v) => setForm((f) => ({ ...f, ogImageUrl: v }))}
              hint="Used when the site is shared"
            />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        {saved && (
          <span className="text-sm font-medium text-emerald-600">Saved ✓</span>
        )}
      </div>
    </form>
  );
}
