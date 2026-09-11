"use client";

import { useState } from "react";

export function ProductGallery({
  images,
  name,
  badge,
}: {
  images: string[];
  name: string;
  badge?: string | null;
}) {
  const [active, setActive] = useState(0);
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
            aria-label={`View image ${i + 1}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              className="h-full w-full object-cover"
            />
          </button>
        ))}
      </div>

      {/* main image */}
      <div className="group relative flex-1 overflow-hidden rounded-2xl bg-brand-100">
        {badge && (
          <span className="absolute left-4 top-4 z-10 rounded-full bg-ink px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-bone">
            {badge}
          </span>
        )}
        <div className="aspect-[3/4] w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={list[active]}
            alt={name}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        </div>
      </div>
    </div>
  );
}
