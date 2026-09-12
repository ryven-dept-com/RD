"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/context/admin-context";
import { MediaField } from "@/components/admin/media-field";

// ---------------------------------------------------------------------------
// Admin → Settings (Phase 3). Every value is persisted to the `settings`
// table through PUT /api/admin/settings (patch semantics + server-side
// validation). After saving, the form re-syncs from the authoritative map
// returned by the server, so the UI always reflects the database.
// ---------------------------------------------------------------------------

type SettingsState = Record<string, string>;

type AnnouncementState = { enabled: boolean; text: string; link: string };

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900";
const labelCls =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500";
const cardCls = "space-y-4 rounded-2xl border border-slate-200 bg-white p-6";

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cardCls}>
      <div>
        <h2 className="font-semibold text-slate-900">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3 text-left transition-colors hover:bg-slate-50"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs text-slate-400">{description}</span>
        )}
      </span>
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-slate-900" : "bg-slate-300"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </span>
    </button>
  );
}

export function SettingsForm({
  initial,
  announcement,
  capiTokenConfigured,
}: {
  initial: SettingsState;
  announcement: AnnouncementState;
  capiTokenConfigured: boolean;
}) {
  const { adminFetch } = useAdmin();

  // ---- main settings form -------------------------------------------------
  const [form, setForm] = useState<SettingsState>(initial);
  const [baseline, setBaseline] = useState<SettingsState>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const dirty = useMemo(() => {
    return Object.keys(form).some((k) => form[k] !== baseline[k]);
  }, [form, baseline]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(t);
  }, [saved]);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  const setBool = (key: string) => (value: boolean) =>
    setForm((f) => ({ ...f, [key]: value ? "true" : "false" }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      // Secret fields are sent only when the admin actually typed a new
      // value — a blank field means "keep the stored token".
      const payload: SettingsState = { ...form };
      if (!payload.metaCapiAccessToken) {
        delete payload.metaCapiAccessToken;
      }
      const res = await adminFetch("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        // Re-sync from the authoritative stored values returned by the API.
        if (data.settings && typeof data.settings === "object") {
          const next: SettingsState = { ...form };
          for (const key of Object.keys(next)) {
            const stored = data.settings[key];
            if (typeof stored === "string") next[key] = stored;
          }
          setForm(next);
          setBaseline({ ...next });
        } else {
          setBaseline({ ...form });
        }
        setSaved(true);
      } else {
        const errors = Array.isArray(data?.errors) ? data.errors.join(" · ") : "";
        setError(errors || data?.error || "Failed to save settings.");
      }
    } catch {
      setError("Could not reach the server. Your changes were not saved.");
    } finally {
      setSaving(false);
    }
  };

  // ---- announcement (Content → Announcement is the single source) ---------
  const [ann, setAnn] = useState<AnnouncementState>(announcement);
  const [annBaseline, setAnnBaseline] = useState<AnnouncementState>(announcement);
  const [annSaving, setAnnSaving] = useState(false);
  const [annSaved, setAnnSaved] = useState(false);
  const [annError, setAnnError] = useState("");
  const annDirty =
    ann.enabled !== annBaseline.enabled ||
    ann.text !== annBaseline.text ||
    ann.link !== annBaseline.link;

  useEffect(() => {
    if (!annSaved) return;
    const t = setTimeout(() => setAnnSaved(false), 2500);
    return () => clearTimeout(t);
  }, [annSaved]);

  const saveAnnouncement = async () => {
    if (annSaving) return;
    setAnnSaving(true);
    setAnnSaved(false);
    setAnnError("");
    try {
      const res = await adminFetch("/api/admin/cms/announcement", {
        method: "PUT",
        body: JSON.stringify({ enabled: ann.enabled, text: ann.text, link: ann.link }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setAnnBaseline({ ...ann });
        setAnnSaved(true);
      } else {
        setAnnError(data?.error || "Failed to save the announcement.");
      }
    } catch {
      setAnnError("Could not reach the server. The announcement was not saved.");
    } finally {
      setAnnSaving(false);
    }
  };

  // ---- password change ------------------------------------------------------
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwDone, setPwDone] = useState(false);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwBusy) return;
    setPwError("");
    if (pw.next.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    if (!/[a-zA-Z]/.test(pw.next) || !/\d/.test(pw.next)) {
      setPwError("New password must contain letters and numbers.");
      return;
    }
    if (pw.next !== pw.confirm) {
      setPwError("Password confirmation does not match.");
      return;
    }
    setPwBusy(true);
    try {
      const res = await adminFetch("/api/admin/password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: pw.current,
          newPassword: pw.next,
          confirmPassword: pw.confirm,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setPwDone(true);
        // All sessions (including this one) were invalidated server-side.
        setTimeout(() => {
          window.location.href = "/admin/login";
        }, 1200);
      } else {
        setPwError(data?.error || "Failed to change the password.");
      }
    } catch {
      setPwError("Could not reach the server. The password was not changed.");
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6 pb-8">
      <form onSubmit={save} className="space-y-6">
      {/* ------------------------------ Store ------------------------------ */}
      <Card title="Store" hint="Basic store identity and contact details.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="storeName">
              Store name
            </label>
            <input
              id="storeName"
              value={form.storeName}
              onChange={set("storeName")}
              placeholder="RUVEN DEPT"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="currency">
              Currency symbol
            </label>
            <input
              id="currency"
              value={form.currency}
              onChange={set("currency")}
              placeholder="دج"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="contactEmail">
              Contact email
            </label>
            <input
              id="contactEmail"
              type="email"
              value={form.contactEmail}
              onChange={set("contactEmail")}
              placeholder="hello@ruvendept.dz"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="contactPhone">
              Contact phone
            </label>
            <input
              id="contactPhone"
              value={form.contactPhone}
              onChange={set("contactPhone")}
              placeholder="+213 …"
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="address">
              Address
            </label>
            <input
              id="address"
              value={form.address}
              onChange={set("address")}
              placeholder="Algiers, Algeria"
              className={inputCls}
            />
          </div>
        </div>
        <p className="text-xs text-slate-400">
          Contact details appear in the footer when “Show contact information”
          is enabled under Content → Footer.
        </p>
      </Card>

      {/* ----------------------------- Checkout ---------------------------- */}
      <Card
        title="Checkout"
        hint="These rules are enforced by the live checkout and order API."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle
            label="Enable checkout"
            description="When off, the checkout page and order API are disabled"
            checked={form.checkoutEnabled !== "false"}
            onChange={setBool("checkoutEnabled")}
          />
          <Toggle
            label="Cash on Delivery"
            description="Offer COD as the payment method at checkout"
            checked={form.codEnabled !== "false"}
            onChange={setBool("codEnabled")}
          />
          <Toggle
            label="Require customer phone"
            description="Customers must enter a phone number"
            checked={form.requirePhone === "true"}
            onChange={setBool("requirePhone")}
          />
          <Toggle
            label="Require customer address"
            description="Full shipping address is mandatory"
            checked={form.requireAddress !== "false"}
            onChange={setBool("requireAddress")}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="freeShippingThreshold">
              Free shipping threshold
            </label>
            <input
              id="freeShippingThreshold"
              inputMode="numeric"
              value={form.freeShippingThreshold}
              onChange={set("freeShippingThreshold")}
              placeholder="15000"
              className={inputCls}
            />
            <p className="mt-1 text-xs text-slate-400">
              Orders at or above this amount ship free.
            </p>
          </div>
          <div>
            <label className={labelCls} htmlFor="minOrderAmount">
              Minimum order amount
            </label>
            <input
              id="minOrderAmount"
              inputMode="numeric"
              value={form.minOrderAmount}
              onChange={set("minOrderAmount")}
              placeholder="0"
              className={inputCls}
            />
            <p className="mt-1 text-xs text-slate-400">
              0 disables the minimum.
            </p>
          </div>
        </div>
      </Card>

      {/* --------------------------- Announcement --------------------------- */}
      <Card
        title="Announcement"
        hint="The storefront announcement bar. This is the same setting as Content → Announcement — there is only one source of truth."
      >
        <Toggle
          label="Show announcement bar"
          checked={ann.enabled}
          onChange={(v) => setAnn((a) => ({ ...a, enabled: v }))}
        />
        <div>
          <label className={labelCls} htmlFor="annText">
            Announcement text
          </label>
          <input
            id="annText"
            value={ann.text}
            onChange={(e) => setAnn((a) => ({ ...a, text: e.target.value }))}
            placeholder="Free shipping on orders over …"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="annLink">
            Link (optional)
          </label>
          <input
            id="annLink"
            value={ann.link}
            onChange={(e) => setAnn((a) => ({ ...a, link: e.target.value }))}
            placeholder="/shop"
            className={inputCls}
          />
        </div>
        {annError && <p className="text-sm text-rose-600">{annError}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={saveAnnouncement}
            disabled={annSaving || !annDirty}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {annSaving ? "Saving…" : "Save announcement"}
          </button>
          {annSaved && (
            <span className="text-sm font-medium text-emerald-600">Saved ✓</span>
          )}
          {annDirty && !annSaved && (
            <span className="text-xs font-medium text-amber-600">
              Unsaved changes
            </span>
          )}
        </div>
      </Card>

      {/* ----------------------------- Branding ----------------------------- */}
      <Card
        title="Branding"
        hint="Upload or choose images from the media library — no need to paste URLs."
      >
        <div className="grid gap-5 sm:grid-cols-3">
          <MediaField
            label="Logo"
            value={form.logoUrl}
            onChange={(v) => setForm((f) => ({ ...f, logoUrl: v }))}
            hint="Shown in the storefront header"
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
      </Card>

      {/* ------------------------------ Social ------------------------------ */}
      <Card
        title="Social"
        hint="Shown in the storefront footer when no custom social links are configured under Content → Footer."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls} htmlFor="instagramUrl">
              Instagram
            </label>
            <input
              id="instagramUrl"
              value={form.instagramUrl}
              onChange={set("instagramUrl")}
              placeholder="https://instagram.com/…"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="tiktokUrl">
              TikTok
            </label>
            <input
              id="tiktokUrl"
              value={form.tiktokUrl}
              onChange={set("tiktokUrl")}
              placeholder="https://tiktok.com/@…"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="facebookUrl">
              Facebook
            </label>
            <input
              id="facebookUrl"
              value={form.facebookUrl}
              onChange={set("facebookUrl")}
              placeholder="https://facebook.com/…"
              className={inputCls}
            />
          </div>
        </div>
      </Card>

      {/* -------------------------------- SEO -------------------------------- */}
      <Card
        title="SEO"
        hint="Controls how the store appears in search engines and shared links."
      >
        <div className="space-y-4">
          <div>
            <label className={labelCls} htmlFor="seoTitle">
              Site title
            </label>
            <input
              id="seoTitle"
              value={form.seoTitle}
              onChange={set("seoTitle")}
              placeholder="Ruven Dept. — Heavyweight Streetwear Essentials"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="seoDescription">
              Meta description
            </label>
            <input
              id="seoDescription"
              value={form.seoDescription}
              onChange={set("seoDescription")}
              placeholder="Heavyweight essentials and utility outerwear…"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="seoKeywords">
              SEO keywords
            </label>
            <input
              id="seoKeywords"
              value={form.seoKeywords}
              onChange={set("seoKeywords")}
              placeholder="streetwear, hoodies, heavyweight tees"
              className={inputCls}
            />
            <p className="mt-1 text-xs text-slate-400">
              Comma-separated. Leave empty to use the built-in defaults.
            </p>
          </div>
          <div>
            <label className={labelCls} htmlFor="canonicalUrl">
              Canonical URL
            </label>
            <input
              id="canonicalUrl"
              value={form.canonicalUrl}
              onChange={set("canonicalUrl")}
              placeholder="https://…"
              className={inputCls}
            />
          </div>
          <Toggle
            label="Allow search engine indexing"
            description="Turn off to ask search engines not to index the store"
            checked={form.robotsIndex !== "false"}
            onChange={setBool("robotsIndex")}
          />
        </div>
      </Card>

      {/* ----------------------------- Marketing ---------------------------- */}
      <Card
        title="Marketing — Meta Pixel"
        hint="Only the Pixel ID is used in the browser. Access tokens and secrets are never stored here."
      >
        <Toggle
          label="Enable Meta Pixel"
          checked={form.metaPixelEnabled === "true"}
          onChange={setBool("metaPixelEnabled")}
        />
        <div>
          <label className={labelCls} htmlFor="metaPixelId">
            Meta Pixel ID
          </label>
          <input
            id="metaPixelId"
            inputMode="numeric"
            value={form.metaPixelId}
            onChange={set("metaPixelId")}
            placeholder="123456789012345"
            className={inputCls}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle
            label="PageView event"
            checked={form.pixelEventPageView !== "false"}
            onChange={setBool("pixelEventPageView")}
          />
          <Toggle
            label="ViewContent event"
            checked={form.pixelEventViewContent !== "false"}
            onChange={setBool("pixelEventViewContent")}
          />
          <Toggle
            label="AddToCart event"
            checked={form.pixelEventAddToCart !== "false"}
            onChange={setBool("pixelEventAddToCart")}
          />
          <Toggle
            label="InitiateCheckout event"
            checked={form.pixelEventInitiateCheckout !== "false"}
            onChange={setBool("pixelEventInitiateCheckout")}
          />
          <Toggle
            label="Purchase event"
            checked={form.pixelEventPurchase !== "false"}
            onChange={setBool("pixelEventPurchase")}
          />
        </div>

        <div className="border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-slate-800">
            Conversions API (server-side events)
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Sends a server-side Purchase event that shares its event ID with
            the browser Pixel, so Meta deduplicates them. The access token is
            stored on the server only and never sent to the browser.
          </p>
          <div className="mt-3 space-y-3">
            <Toggle
              label="Enable Conversions API"
              checked={form.metaCapiEnabled === "true"}
              onChange={setBool("metaCapiEnabled")}
            />
            <div>
              <label className={labelCls} htmlFor="metaCapiAccessToken">
                Access token
              </label>
              <input
                id="metaCapiAccessToken"
                type="password"
                autoComplete="off"
                value={form.metaCapiAccessToken}
                onChange={set("metaCapiAccessToken")}
                placeholder={
                  capiTokenConfigured
                    ? "Token stored securely — enter a new value to replace it"
                    : "System user access token (EAAB…)"
                }
                className={inputCls}
              />
              <p className="mt-1 text-xs text-slate-400">
                {capiTokenConfigured
                  ? "A token is currently configured. Leave the field empty to keep it."
                  : "Use a Meta system user token with ads_management access. It is never shown again after saving."}
              </p>
            </div>
            <div>
              <label className={labelCls} htmlFor="metaCapiTestEventCode">
                Test event code (optional)
              </label>
              <input
                id="metaCapiTestEventCode"
                value={form.metaCapiTestEventCode}
                onChange={set("metaCapiTestEventCode")}
                placeholder="TEST12345"
                className={inputCls}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-slate-800">
            Product catalog feed
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Live CSV feed of the real store catalogue for Meta Commerce
            Manager (id, title, description, availability, condition, price,
            link, image_link, variants). Add this URL as a scheduled feed:
          </p>
          <p className="mt-2 break-all rounded-lg bg-slate-100 px-3 py-2 font-mono text-xs text-slate-700">
            /api/catalog
          </p>
        </div>
      </Card>

      {/* --------------------------- Save bar (main) ------------------------- */}
      <div className="sticky bottom-0 z-10 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
          {saved && (
            <span className="text-sm font-medium text-emerald-600">
              Settings saved ✓
            </span>
          )}
          {error && <span className="text-sm text-rose-600">{error}</span>}
          {!saved && !error && dirty && (
            <span className="text-xs font-medium text-amber-600">
              Unsaved changes
            </span>
          )}
          {!dirty && !saved && !error && (
            <span className="text-xs text-slate-400">All changes saved</span>
          )}
        </div>
      </div>
      </form>

      {/* ------------------------ Account & security ------------------------- */}
      <Card
        title="Account & security"
        hint="Changing the password signs out every active admin session."
      >
        {pwDone ? (
          <p className="text-sm font-medium text-emerald-600">
            Password changed. Redirecting to login…
          </p>
        ) : (
          <form onSubmit={changePassword} className="max-w-md space-y-4">
            <div>
              <label className={labelCls} htmlFor="pwCurrent">
                Current password
              </label>
              <input
                id="pwCurrent"
                type="password"
                autoComplete="current-password"
                value={pw.current}
                onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="pwNext">
                New password
              </label>
              <input
                id="pwNext"
                type="password"
                autoComplete="new-password"
                value={pw.next}
                onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
                className={inputCls}
              />
              <p className="mt-1 text-xs text-slate-400">
                At least 8 characters with letters and numbers.
              </p>
            </div>
            <div>
              <label className={labelCls} htmlFor="pwConfirm">
                Confirm new password
              </label>
              <input
                id="pwConfirm"
                type="password"
                autoComplete="new-password"
                value={pw.confirm}
                onChange={(e) =>
                  setPw((p) => ({ ...p, confirm: e.target.value }))
                }
                className={inputCls}
              />
            </div>
            {pwError && <p className="text-sm text-rose-600">{pwError}</p>}
            <button
              type="submit"
              disabled={pwBusy || !pw.current || !pw.next || !pw.confirm}
              className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {pwBusy ? "Changing…" : "Change password"}
            </button>
          </form>
        )}
      </Card>
    </div>
  );
}
