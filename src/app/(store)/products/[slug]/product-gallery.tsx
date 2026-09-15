"use client";

import { useT } from "@/i18n/language-context";

import Image from "next/image";
import { useState } from "react";
import { ImageLightbox } from "@/components/image-lightbox";

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
  const [active, setActive] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const list = images.length ? images : [""];

  return (
    <div className="flex flex-col-reverse gap-3 lg:flex-row">
      {/* thumbnails */}
      <div className="flex gap-3 overflow-x-auto lg:max-h-[640px] lg:flex-col lg:overflow-y-auto no-scrollbar">
        {list.map((src, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`relative aspect-[3/4] w-20 shrink-0 overflow-hidden rounded-lg transition-all lg:w-24 ${
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
        className="rd-gallery-frame group relative block w-full flex-1 cursor-zoom-in overflow-hidden rounded-2xl bg-brand-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
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
