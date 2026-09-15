"use client";

import { useT } from "@/i18n/language-context";
import { useStoreConfig } from "@/context/store-context";

import Image from "next/image";
import { useState } from "react";
import { ImageLightbox } from "@/components/image-lightbox";

/**
 * Per-theme gallery composition — identical imagery/zoom/lightbox logic,
 * different presentation:
 *   noir/district  → thumbnail rail beside the stage (desktop)
 *   concrete       → squared framed stage, thumbnails underneath
 *   nightshift     → glowing framed stage, side rail
 *   archive        → matte-framed plate, thumbnails underneath
 *   signature      → clean stage, thumbnails underneath
 */
const GALLERY_THEME = {
  noir: {
    root: "flex flex-col-reverse gap-3 lg:flex-row",
    thumbs: "",
    thumbBtn: "rounded-lg",
    main: "rounded-lg",
  },
  concrete: {
    root: "flex flex-col gap-3",
    thumbs: "order-last lg:max-h-none lg:flex-row lg:overflow-x-auto lg:overflow-y-visible",
    thumbBtn: "rounded-none border-2 border-ink",
    main: "rounded-none border-2 border-ink",
  },
  district: {
    root: "flex flex-col-reverse gap-3 lg:flex-row",
    thumbs: "",
    thumbBtn: "rounded-lg",
    main: "rounded-2xl",
  },
  nightshift: {
    root: "flex flex-col-reverse gap-3 lg:flex-row",
    thumbs: "",
    thumbBtn: "rounded-md border border-brand-100",
    main: "rounded-xl border border-brand-100",
  },
  archive: {
    root: "flex flex-col gap-3",
    thumbs: "order-last lg:max-h-none lg:flex-row lg:overflow-x-auto lg:overflow-y-visible",
    thumbBtn: "rounded-none border border-black/25",
    main: "rounded-none border border-black/25 bg-brand-50 p-2.5",
  },
  signature: {
    root: "flex flex-col gap-3",
    thumbs: "order-last lg:max-h-none lg:flex-row lg:overflow-x-auto lg:overflow-y-visible",
    thumbBtn: "rounded-sm",
    main: "rounded-sm",
  },
  seventh: {
    root: "flex flex-col gap-3",
    thumbs: "order-last lg:max-h-none lg:flex-row lg:overflow-x-auto lg:overflow-y-visible",
    thumbBtn: "rounded-none border-2 border-ink",
    main: "rounded-none",
  },
} as const;

export function ProductGallery({
  images,
  name,
  badge,
}: {
  images: string[];
  name: string;
  badge?: string | null;
}) {
  const t = useT();
  const { theme } = useStoreConfig();
  const g = GALLERY_THEME[theme] ?? GALLERY_THEME.district;
  const [active, setActive] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const list = images.length ? images : [""];

  return (
    <div className={`${g.root} rd-gallery-root`}>
      {/* thumbnails */}
      <div className={`flex gap-3 overflow-x-auto lg:max-h-[640px] lg:flex-col lg:overflow-y-auto no-scrollbar ${g.thumbs}`}>
        {list.map((src, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`relative aspect-[3/4] w-20 shrink-0 overflow-hidden transition-all lg:w-24 ${g.thumbBtn} ${
              active === i
                ? "ring-2 ring-ink ring-offset-2 ring-offset-bone"
                : "opacity-60 hover:opacity-100"
            }`}
            aria-label={t("product.viewImage", { n: i + 1 })}
          >
            {src ? (
              <Image
                src={src}
                alt=""
                fill
                sizes="96px"
                className="object-cover"
              />
            ) : null}
          </button>
        ))}
      </div>

      {/* main image — click/tap opens the fullscreen viewer */}
      <button
        type="button"
        onClick={() => list[active] && setViewerOpen(true)}
        aria-label={t("product.viewImage", { n: active + 1 })}
        className={`rd-gallery-frame group relative block w-full flex-1 cursor-zoom-in overflow-hidden bg-brand-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${g.main}`}
      >
        {badge && (
          <span className="absolute start-4 top-4 z-10 rounded-full bg-ink px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-bone">
            {badge}
          </span>
        )}
        <div className="relative aspect-[3/4] w-full">
          {list[active] ? (
            <Image
              key={list[active]}
              src={list[active]}
              alt={name}
              fill
              priority={active === 0}
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : null}
        </div>
      </button>

      {viewerOpen && (
        <ImageLightbox
          images={list}
          initialIndex={active}
          alt={name}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </div>
  );
}
