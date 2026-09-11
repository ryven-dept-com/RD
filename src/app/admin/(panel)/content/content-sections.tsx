"use client";

import { MediaField } from "@/components/admin/media-field";
import type {
  AnnouncementContent,
  BrandStoryContent,
  CollectionItem,
  FooterContent,
  HeroContent,
  NewsletterContent,
  PromoBanner,
} from "@/lib/cms";
import {
  Field,
  Notify,
  ReorderButtons,
  SaveBar,
  ScheduleFields,
  SectionCard,
  TextArea,
  TextInput,
  Toggle,
  inputCls,
  isoToLocalInput,
  localInputToIso,
  useSectionState,
} from "./content-ui";

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// --------------------------------- HERO ------------------------------------

export function HeroEditor({
  initial,
  notify,
  onDirtyChange,
}: {
  initial: HeroContent;
  notify: Notify;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { draft, setDraft, dirty, saving, error, save, discard } =
    useSectionState(initial, "hero", notify, onDirtyChange);
  const set = <K extends keyof HeroContent>(key: K, value: HeroContent[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <div className="space-y-6">
      <SectionCard
        title="Hero section"
        subtitle="The full-screen banner at the top of the homepage"
      >
        <Toggle
          checked={draft.enabled}
          onChange={(v) => set("enabled", v)}
          label="Show hero section"
          description="When off, the homepage starts with the next section"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Eyebrow / small label">
            <TextInput
              value={draft.eyebrow}
              onChange={(v) => set("eyebrow", v)}
              placeholder="Fall / Winter — Vol. 01"
            />
          </Field>
          <div className="hidden sm:block" />
        </div>
        <Field label="Title" hint="Use a line break to split lines like the original layout">
          <TextArea
            value={draft.title}
            onChange={(v) => set("title", v)}
            rows={2}
          />
        </Field>
        <Field label="Subtitle / description">
          <TextArea
            value={draft.subtitle}
            onChange={(v) => set("subtitle", v)}
            rows={3}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Primary button text">
            <TextInput
              value={draft.primaryText}
              onChange={(v) => set("primaryText", v)}
              placeholder="Shop the drop"
            />
          </Field>
          <Field label="Primary button link">
            <TextInput
              value={draft.primaryLink}
              onChange={(v) => set("primaryLink", v)}
              placeholder="/shop"
            />
          </Field>
          <Field label="Secondary button text" hint="Leave empty to hide the second button">
            <TextInput
              value={draft.secondaryText}
              onChange={(v) => set("secondaryText", v)}
            />
          </Field>
          <Field label="Secondary button link">
            <TextInput
              value={draft.secondaryLink}
              onChange={(v) => set("secondaryLink", v)}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="Hero media"
        subtitle="Background image, optional mobile image, video and audio"
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <MediaField
            label="Background image (desktop)"
            value={draft.backgroundImage}
            onChange={(v) => set("backgroundImage", v)}
          />
          <MediaField
            label="Mobile background image"
            value={draft.backgroundImageMobile}
            onChange={(v) => set("backgroundImageMobile", v)}
            hint="Optional — used on small screens; falls back to the desktop image"
          />
          <MediaField
            label="Background video"
            value={draft.video}
            onChange={(v) => set("video", v)}
            kind="video"
            hint="Optional — plays muted on a loop instead of the image"
          />
          <MediaField
            label="Background audio"
            value={draft.audio}
            onChange={(v) => set("audio", v)}
            kind="audio"
            hint="Optional — browsers may block playback until a visitor interacts"
          />
        </div>
      </SectionCard>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      <SaveBar dirty={dirty} saving={saving} onSave={() => void save()} onDiscard={discard} />
    </div>
  );
}

// ------------------------------ COLLECTIONS --------------------------------

const EMPTY_COLLECTION: CollectionItem = {
  enabled: true,
  title: "",
  tag: "",
  description: "",
  image: "",
  link: "/shop",
};

export function CollectionsEditor({
  initial,
  notify,
  onDirtyChange,
}: {
  initial: CollectionItem[];
  notify: Notify;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { draft, setDraft, dirty, saving, error, save, discard } =
    useSectionState<{ items: CollectionItem[] }>(
      { items: initial.map(({ id: _id, ...rest }) => rest) },
      "collections",
      notify,
      onDirtyChange,
    );
  const items = draft.items;

  const patch = (i: number, p: Partial<CollectionItem>) =>
    setDraft((d) => ({
      items: d.items.map((it, idx) => (idx === i ? { ...it, ...p } : it)),
    }));

  return (
    <div className="space-y-6">
      <SectionCard
        title="Collections grid"
        subtitle="Shown under “Shop by collection”. The first enabled card gets the large tile. Saving here replaces the built-in sample collections."
      >
        {items.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
            No collections — add your first one below.
          </p>
        )}

        {items.map((c, i) => (
          <div
            key={i}
            className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-700">
                Collection {i + 1}
                {i === 0 && (
                  <span className="ml-2 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    Large tile
                  </span>
                )}
              </p>
              <div className="flex items-center gap-2">
                <ReorderButtons
                  index={i}
                  total={items.length}
                  onMove={(from, to) =>
                    setDraft((d) => ({ items: move(d.items, from, to) }))
                  }
                />
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete collection "${c.title || i + 1}"?`)) {
                      setDraft((d) => ({
                        items: d.items.filter((_, idx) => idx !== i),
                      }));
                    }
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 text-rose-600 transition-colors hover:bg-rose-50"
                  aria-label="Delete collection"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 7h16M9 7V5h6v2m-8 0l1 13h8l1-13" />
                  </svg>
                </button>
              </div>
            </div>

            <Toggle
              checked={c.enabled}
              onChange={(v) => patch(i, { enabled: v })}
              label="Enabled"
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title">
                <TextInput
                  value={c.title}
                  onChange={(v) => patch(i, { title: v })}
                  placeholder="Vault 01"
                />
              </Field>
              <Field label="Tag (small label above title)">
                <TextInput
                  value={c.tag}
                  onChange={(v) => patch(i, { tag: v })}
                  placeholder="Core Blacks"
                />
              </Field>
            </div>
            <Field label="Description">
              <TextInput
                value={c.description}
                onChange={(v) => patch(i, { description: v })}
                placeholder="Heavyweight everyday armor."
              />
            </Field>
            <Field label="Link">
              <TextInput
                value={c.link}
                onChange={(v) => patch(i, { link: v })}
                placeholder="/shop?collection=…"
              />
            </Field>
            <MediaField
              label="Image"
              value={c.image}
              onChange={(v) => patch(i, { image: v })}
            />
          </div>
        ))}

        <button
          type="button"
          onClick={() =>
            setDraft((d) => ({ items: [...d.items, { ...EMPTY_COLLECTION }] }))
          }
          className="w-full rounded-xl border-2 border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50"
        >
          + Add collection
        </button>
      </SectionCard>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      <SaveBar dirty={dirty} saving={saving} onSave={() => void save()} onDiscard={discard} />
    </div>
  );
}

// ------------------------------ BRAND STORY --------------------------------

export function BrandStoryEditor({
  initial,
  notify,
  onDirtyChange,
}: {
  initial: BrandStoryContent;
  notify: Notify;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { draft, setDraft, dirty, saving, error, save, discard } =
    useSectionState(initial, "brandStory", notify, onDirtyChange);
  const set = <K extends keyof BrandStoryContent>(
    key: K,
    value: BrandStoryContent[K],
  ) => setDraft((d) => ({ ...d, [key]: value }));

  return (
    <div className="space-y-6">
      <SectionCard
        title="Brand story"
        subtitle="The dark “The Ruven Ethos” section with image and call to action"
      >
        <Toggle
          checked={draft.enabled}
          onChange={(v) => set("enabled", v)}
          label="Show brand story section"
        />
        <Field label="Title" hint="Use a line break to split lines">
          <TextArea value={draft.title} onChange={(v) => set("title", v)} rows={2} />
        </Field>
        <Field label="Description">
          <TextArea
            value={draft.description}
            onChange={(v) => set("description", v)}
            rows={5}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="CTA text">
            <TextInput
              value={draft.ctaText}
              onChange={(v) => set("ctaText", v)}
              placeholder="Explore the range"
            />
          </Field>
          <Field label="CTA link">
            <TextInput
              value={draft.ctaLink}
              onChange={(v) => set("ctaLink", v)}
              placeholder="/shop"
            />
          </Field>
        </div>
        <MediaField
          label="Image"
          value={draft.image}
          onChange={(v) => set("image", v)}
        />
      </SectionCard>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      <SaveBar dirty={dirty} saving={saving} onSave={() => void save()} onDiscard={discard} />
    </div>
  );
}

// -------------------------------- BANNERS ----------------------------------

const EMPTY_BANNER = {
  enabled: true,
  title: "",
  text: "",
  image: "",
  ctaText: "",
  ctaLink: "",
  startsAt: "",
  endsAt: "",
};

type BannerDraft = typeof EMPTY_BANNER;

export function BannersEditor({
  initial,
  notify,
  onDirtyChange,
}: {
  initial: PromoBanner[];
  notify: Notify;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { draft, setDraft, dirty, saving, error, save, discard } =
    useSectionState<{ items: BannerDraft[] }>(
      {
        items: initial.map((b) => ({
          enabled: b.enabled,
          title: b.title,
          text: b.text,
          image: b.image,
          ctaText: b.ctaText,
          ctaLink: b.ctaLink,
          startsAt: isoToLocalInput(b.startsAt),
          endsAt: isoToLocalInput(b.endsAt),
        })),
      },
      "banners",
      notify,
      onDirtyChange,
    );
  const items = draft.items;

  const patch = (i: number, p: Partial<BannerDraft>) =>
    setDraft((d) => ({
      items: d.items.map((it, idx) => (idx === i ? { ...it, ...p } : it)),
    }));

  return (
    <div className="space-y-6">
      <SectionCard
        title="Promotional banners"
        subtitle="Highlighted strips shown between the marquee and the collections grid. Only enabled banners inside their schedule are visible."
      >
        {items.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
            No banners yet — create a promotion below.
          </p>
        )}

        {items.map((b, i) => (
          <div
            key={i}
            className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-700">
                Banner {i + 1}
              </p>
              <div className="flex items-center gap-2">
                <ReorderButtons
                  index={i}
                  total={items.length}
                  onMove={(from, to) =>
                    setDraft((d) => ({ items: move(d.items, from, to) }))
                  }
                />
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete banner "${b.title || i + 1}"?`)) {
                      setDraft((d) => ({
                        items: d.items.filter((_, idx) => idx !== i),
                      }));
                    }
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 text-rose-600 transition-colors hover:bg-rose-50"
                  aria-label="Delete banner"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 7h16M9 7V5h6v2m-8 0l1 13h8l1-13" />
                  </svg>
                </button>
              </div>
            </div>

            <Toggle
              checked={b.enabled}
              onChange={(v) => patch(i, { enabled: v })}
              label="Enabled"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title">
                <TextInput
                  value={b.title}
                  onChange={(v) => patch(i, { title: v })}
                  placeholder="Mid-season sale"
                />
              </Field>
              <Field label="CTA text" hint="Leave empty to hide the button">
                <TextInput
                  value={b.ctaText}
                  onChange={(v) => patch(i, { ctaText: v })}
                  placeholder="Shop now"
                />
              </Field>
            </div>
            <Field label="Text">
              <TextArea
                value={b.text}
                onChange={(v) => patch(i, { text: v })}
                rows={2}
              />
            </Field>
            <Field label="CTA link">
              <TextInput
                value={b.ctaLink}
                onChange={(v) => patch(i, { ctaLink: v })}
                placeholder="/shop?filter=sale"
              />
            </Field>
            <MediaField
              label="Image (optional)"
              value={b.image}
              onChange={(v) => patch(i, { image: v })}
            />
            <ScheduleFields
              startsAt={b.startsAt}
              endsAt={b.endsAt}
              onStartsChange={(v) => patch(i, { startsAt: v })}
              onEndsChange={(v) => patch(i, { endsAt: v })}
            />
          </div>
        ))}

        <button
          type="button"
          onClick={() =>
            setDraft((d) => ({ items: [...d.items, { ...EMPTY_BANNER }] }))
          }
          className="w-full rounded-xl border-2 border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50"
        >
          + Add banner
        </button>
      </SectionCard>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      <SaveBar
        dirty={dirty}
        saving={saving}
        onSave={() =>
          void save({
            items: items.map((b) => ({
              ...b,
              startsAt: localInputToIso(b.startsAt),
              endsAt: localInputToIso(b.endsAt),
            })),
          })
        }
        onDiscard={discard}
      />
    </div>
  );
}

// ------------------------------ ANNOUNCEMENT -------------------------------

export function AnnouncementEditor({
  initial,
  notify,
  onDirtyChange,
}: {
  initial: AnnouncementContent;
  notify: Notify;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { draft, setDraft, dirty, saving, error, save, discard } =
    useSectionState(
      {
        ...initial,
        startsAt: isoToLocalInput(initial.startsAt),
        endsAt: isoToLocalInput(initial.endsAt),
      },
      "announcement",
      notify,
      onDirtyChange,
    );
  const set = (key: "enabled" | "text" | "link" | "startsAt" | "endsAt", value: string | boolean) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <div className="space-y-6">
      <SectionCard
        title="Announcement bar"
        subtitle="When enabled, your announcement replaces the default scrolling marquee messages under the hero."
      >
        <Toggle
          checked={draft.enabled}
          onChange={(v) => set("enabled", v)}
          label="Announcement active"
          description="While active, only this message scrolls in the marquee strip"
        />
        <Field label="Text">
          <TextInput
            value={draft.text}
            onChange={(v) => set("text", v)}
            placeholder="FREE SHIPPING OVER 15000 DZD"
          />
        </Field>
        <Field label="Link (optional)" hint="Makes the message clickable">
          <TextInput
            value={draft.link}
            onChange={(v) => set("link", v)}
            placeholder="/shop?filter=sale"
          />
        </Field>
        <ScheduleFields
          startsAt={draft.startsAt}
          endsAt={draft.endsAt}
          onStartsChange={(v) => set("startsAt", v)}
          onEndsChange={(v) => set("endsAt", v)}
        />
      </SectionCard>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      <SaveBar
        dirty={dirty}
        saving={saving}
        onSave={() =>
          void save({
            enabled: draft.enabled,
            text: draft.text,
            link: draft.link,
            startsAt: localInputToIso(draft.startsAt),
            endsAt: localInputToIso(draft.endsAt),
          })
        }
        onDiscard={discard}
      />
    </div>
  );
}

// ------------------------------ NEWSLETTER ---------------------------------

export function NewsletterEditor({
  initial,
  notify,
  onDirtyChange,
}: {
  initial: NewsletterContent;
  notify: Notify;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { draft, setDraft, dirty, saving, error, save, discard } =
    useSectionState(initial, "newsletter", notify, onDirtyChange);
  const set = <K extends keyof NewsletterContent>(
    key: K,
    value: NewsletterContent[K],
  ) => setDraft((d) => ({ ...d, [key]: value }));

  return (
    <div className="space-y-6">
      <SectionCard
        title="Newsletter signup"
        subtitle="The email capture form in the site footer"
      >
        <Toggle
          checked={draft.enabled}
          onChange={(v) => set("enabled", v)}
          label="Show newsletter form"
        />
        <Field label="Title (input placeholder)">
          <TextInput
            value={draft.title}
            onChange={(v) => set("title", v)}
            placeholder="Email for 10% off"
          />
        </Field>
        <Field label="Description (optional)" hint="Small caption shown under the form">
          <TextInput
            value={draft.description}
            onChange={(v) => set("description", v)}
            placeholder="Early access to drops. No spam."
          />
        </Field>
        <Field label="Button text">
          <TextInput
            value={draft.buttonText}
            onChange={(v) => set("buttonText", v)}
            placeholder="Join"
          />
        </Field>
      </SectionCard>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      <SaveBar dirty={dirty} saving={saving} onSave={() => void save()} onDiscard={discard} />
    </div>
  );
}

// -------------------------------- FOOTER -----------------------------------

type FooterDraft = {
  description: string;
  showContact: boolean;
  copyright: string;
  socialLinks: { label: string; url: string }[];
  linkGroups: { title: string; links: { label: string; href: string }[] }[];
};

export function FooterEditor({
  initial,
  notify,
  onDirtyChange,
}: {
  initial: FooterContent;
  notify: Notify;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { draft, setDraft, dirty, saving, error, save, discard } =
    useSectionState<FooterDraft>(
      {
        description: initial.description,
        showContact: initial.showContact,
        copyright: initial.copyright,
        socialLinks: initial.socialLinks.map((s) => ({ ...s })),
        linkGroups: initial.linkGroups.map((g) => ({
          title: g.title,
          links: g.links.map((l) => ({ ...l })),
        })),
      },
      "footer",
      notify,
      onDirtyChange,
    );

  return (
    <div className="space-y-6">
      <SectionCard
        title="Footer"
        subtitle="Store description, links, social profiles and copyright"
      >
        <Field label="Store description">
          <TextArea
            value={draft.description}
            onChange={(v) => setDraft((d) => ({ ...d, description: v }))}
            rows={3}
          />
        </Field>
        <Toggle
          checked={draft.showContact}
          onChange={(v) => setDraft((d) => ({ ...d, showContact: v }))}
          label="Show contact information"
          description="Email, phone and address are managed under Settings — single source of truth"
        />
        <Field label="Copyright text" hint="The year is added automatically">
          <TextInput
            value={draft.copyright}
            onChange={(v) => setDraft((d) => ({ ...d, copyright: v }))}
            placeholder="Ruven Dept. All rights reserved."
          />
        </Field>
      </SectionCard>

      <SectionCard
        title="Social links"
        subtitle="Shown in the bottom bar of the footer"
      >
        {draft.socialLinks.length === 0 && (
          <p className="text-sm text-slate-400">No social links yet.</p>
        )}
        {draft.socialLinks.map((s, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
            <input
              value={s.label}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  socialLinks: d.socialLinks.map((x, idx) =>
                    idx === i ? { ...x, label: e.target.value } : x,
                  ),
                }))
              }
              placeholder="Instagram"
              className={inputCls}
            />
            <input
              value={s.url}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  socialLinks: d.socialLinks.map((x, idx) =>
                    idx === i ? { ...x, url: e.target.value } : x,
                  ),
                }))
              }
              placeholder="https://instagram.com/…"
              className={inputCls}
            />
            <button
              type="button"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  socialLinks: d.socialLinks.filter((_, idx) => idx !== i),
                }))
              }
              className="flex h-10 w-full items-center justify-center rounded-lg border border-rose-200 text-rose-600 transition-colors hover:bg-rose-50 sm:w-10"
              aria-label="Remove social link"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setDraft((d) => ({
              ...d,
              socialLinks: [...d.socialLinks, { label: "", url: "" }],
            }))
          }
          className="w-full rounded-xl border-2 border-dashed border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50"
        >
          + Add social link
        </button>
      </SectionCard>

      <SectionCard
        title="Footer link columns"
        subtitle="The navigation columns next to the store description"
      >
        {draft.linkGroups.map((g, gi) => (
          <div
            key={gi}
            className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <input
                value={g.title}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    linkGroups: d.linkGroups.map((x, idx) =>
                      idx === gi ? { ...x, title: e.target.value } : x,
                    ),
                  }))
                }
                placeholder="Column title"
                className={`${inputCls} max-w-xs font-semibold`}
              />
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete column "${g.title || gi + 1}"?`)) {
                    setDraft((d) => ({
                      ...d,
                      linkGroups: d.linkGroups.filter((_, idx) => idx !== gi),
                    }));
                  }
                }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rose-200 text-rose-600 transition-colors hover:bg-rose-50"
                aria-label="Delete link column"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 7h16M9 7V5h6v2m-8 0l1 13h8l1-13" />
                </svg>
              </button>
            </div>

            {g.links.map((l, li) => (
              <div key={li} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <input
                  value={l.label}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      linkGroups: d.linkGroups.map((x, xi) =>
                        xi === gi
                          ? {
                              ...x,
                              links: x.links.map((y, yi) =>
                                yi === li ? { ...y, label: e.target.value } : y,
                              ),
                            }
                          : x,
                      ),
                    }))
                  }
                  placeholder="Label"
                  className={inputCls}
                />
                <input
                  value={l.href}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      linkGroups: d.linkGroups.map((x, xi) =>
                        xi === gi
                          ? {
                              ...x,
                              links: x.links.map((y, yi) =>
                                yi === li ? { ...y, href: e.target.value } : y,
                              ),
                            }
                          : x,
                      ),
                    }))
                  }
                  placeholder="/shop?…"
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      linkGroups: d.linkGroups.map((x, xi) =>
                        xi === gi
                          ? { ...x, links: x.links.filter((_, yi) => yi !== li) }
                          : x,
                      ),
                    }))
                  }
                  className="flex h-10 w-full items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 sm:w-10"
                  aria-label="Remove link"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  linkGroups: d.linkGroups.map((x, xi) =>
                    xi === gi
                      ? { ...x, links: [...x.links, { label: "", href: "/shop" }] }
                      : x,
                  ),
                }))
              }
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              + Add link
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() =>
            setDraft((d) => ({
              ...d,
              linkGroups: [
                ...d.linkGroups,
                { title: "", links: [{ label: "", href: "/shop" }] },
              ],
            }))
          }
          className="w-full rounded-xl border-2 border-dashed border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50"
        >
          + Add link column
        </button>
      </SectionCard>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      <SaveBar dirty={dirty} saving={saving} onSave={() => void save()} onDiscard={discard} />
    </div>
  );
}
