"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRightIcon, CloseIcon, MinusIcon, PlusIcon } from "./icons";
import { useT } from "@/i18n/language-context";

/**
 * Fullscreen product image viewer (lightbox) with real zoom & pan.
 *
 * - Dialog semantics (`role="dialog"`, `aria-modal`, focus moved to the
 *   close button on open and restored on close, Tab cycles inside).
 * - Keyboard: Escape closes, ArrowLeft/ArrowRight navigate, +/- zoom.
 * - Pointer events: one-finger drag pans when zoomed, swipes between
 *   images at scale 1; two-finger pinch zooms; double-click/tap toggles
 *   a 2.5× zoom. Wheel zooms on desktop.
 * - The zoom is a real transform on the actual image element (sharp at the
 *   served resolution), not a fake overlay effect.
 */

export const LIGHTBOX_MIN_SCALE = 1;
export const LIGHTBOX_MAX_SCALE = 4;
export const LIGHTBOX_ZOOM_STEP = 1.6;
export const LIGHTBOX_SWIPE_DISTANCE = 60;
const DOUBLE_TAP_MS = 300;

/** Clamp a requested zoom level into the supported [1, 4] range. */
export function clampScale(scale: number): number {
  if (!Number.isFinite(scale)) return LIGHTBOX_MIN_SCALE;
  return Math.min(LIGHTBOX_MAX_SCALE, Math.max(LIGHTBOX_MIN_SCALE, scale));
}

/**
 * Clamp a pan offset so the zoomed image can never be dragged completely
 * off-screen. At scale 1 the offset is always 0.
 */
export function clampOffset(
  value: number,
  scale: number,
  stageSize: number,
): number {
  if (!Number.isFinite(value)) return 0;
  if (scale <= LIGHTBOX_MIN_SCALE) return 0;
  const max = Math.max(0, ((scale - 1) * stageSize) / 2) + 48;
  return Math.min(max, Math.max(-max, value));
}

type ViewTransform = { scale: number; x: number; y: number };

type GestureState = {
  mode: "idle" | "pan" | "pinch" | "swipe";
  startDist: number;
  startScale: number;
  startX: number;
  startY: number;
  startView: ViewTransform;
  moved: boolean;
};

export function ImageLightbox({
  images,
  initialIndex,
  alt,
  onClose,
}: {
  images: string[];
  initialIndex: number;
  alt: string;
  onClose: () => void;
}) {
  const t = useT();
  const count = images.length;
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(initialIndex, 0), Math.max(0, count - 1)),
  );
  const [view, setView] = useState<ViewTransform>({ scale: 1, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<GestureState>({
    mode: "idle",
    startDist: 1,
    startScale: 1,
    startX: 0,
    startY: 0,
    startView: { scale: 1, x: 0, y: 0 },
    moved: false,
  });
  const lastTapAt = useRef(0);

  const stageSize = () => ({
    w: stageRef.current?.clientWidth ?? 320,
    h: stageRef.current?.clientHeight ?? 480,
  });

  const resetZoom = useCallback(() => setView({ scale: 1, x: 0, y: 0 }), []);

  const show = useCallback(
    (i: number) => {
      setIndex(Math.min(Math.max(i, 0), count - 1));
      setView({ scale: 1, x: 0, y: 0 });
    },
    [count],
  );
  const prev = useCallback(() => show(index - 1), [show, index]);
  const next = useCallback(() => show(index + 1), [show, index]);

  const zoomByStep = useCallback((dir: 1 | -1) => {
    const { w, h } = stageSize();
    setView((v) => {
      const scale = clampScale(
        dir > 0 ? v.scale * LIGHTBOX_ZOOM_STEP : v.scale / LIGHTBOX_ZOOM_STEP,
      );
      if (scale <= LIGHTBOX_MIN_SCALE) return { scale: 1, x: 0, y: 0 };
      return {
        scale,
        x: clampOffset(v.x, scale, w),
        y: clampOffset(v.y, scale, h),
      };
    });
  }, []);

  const toggleDoubleTapZoom = useCallback(() => {
    setView((v) =>
      v.scale > 1 ? { scale: 1, x: 0, y: 0 } : { scale: 2.5, x: 0, y: 0 },
    );
  }, []);

  // Keyboard: Escape closes, arrows navigate (physical direction in both
  // LTR and RTL), +/- zoom.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft" && count > 1) {
        e.preventDefault();
        prev();
      } else if (e.key === "ArrowRight" && count > 1) {
        e.preventDefault();
        next();
      } else if (e.key === "+" || e.key === "=") {
        zoomByStep(1);
      } else if (e.key === "-" || e.key === "_") {
        zoomByStep(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, prev, next, onClose, zoomByStep]);

  // Scroll-lock the page + move focus into the dialog; restore both on close.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const restoreTarget = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      restoreTarget?.focus?.();
    };
  }, []);

  // Wheel zoom (non-passive so the page underneath never scrolls).
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomByStep(e.deltaY < 0 ? 1 : -1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomByStep]);

  // Keep Tab focus cycling inside the dialog.
  const onDialogKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(
      "button:not([disabled])",
    );
    if (!nodes || nodes.length === 0) return;
    const list = Array.from(nodes);
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // ---- Pointer gestures -------------------------------------------------

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    setDragging(true);
    if (pointers.current.size === 1) {
      g.mode = view.scale > 1 ? "pan" : "swipe";
      g.startX = e.clientX;
      g.startY = e.clientY;
      g.startView = view;
      g.moved = false;
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      g.mode = "pinch";
      g.startDist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      g.startScale = view.scale;
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (g.mode === "pinch" && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const scale = clampScale(g.startScale * (dist / g.startDist));
      setView((v) => ({ ...v, scale }));
    } else if (g.mode === "pan") {
      const { w, h } = stageSize();
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      if (Math.abs(dx) + Math.abs(dy) > 4) g.moved = true;
      setView({
        scale: g.startView.scale,
        x: clampOffset(g.startView.x + dx, g.startView.scale, w),
        y: clampOffset(g.startView.y + dy, g.startView.scale, h),
      });
    } else if (g.mode === "swipe") {
      if (
        Math.abs(e.clientX - g.startX) + Math.abs(e.clientY - g.startY) >
        8
      ) {
        g.moved = true;
      }
    }
  };

  const onTap = () => {
    const now = Date.now();
    if (now - lastTapAt.current < DOUBLE_TAP_MS) {
      lastTapAt.current = 0;
      toggleDoubleTapZoom();
    } else {
      lastTapAt.current = now;
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (pointers.current.size === 0) {
      setDragging(false);
      if (g.mode === "swipe") {
        const dx = e.clientX - g.startX;
        const dy = e.clientY - g.startY;
        if (
          count > 1 &&
          Math.abs(dx) > LIGHTBOX_SWIPE_DISTANCE &&
          Math.abs(dx) > Math.abs(dy) * 1.2
        ) {
          // Physical swipe: left reveals the next image in both LTR and RTL.
          if (dx < 0) next();
          else prev();
        } else if (!g.moved) {
          onTap();
        }
      } else if (g.mode === "pan" && !g.moved) {
        onTap();
      } else if (g.mode === "pinch") {
        setView((v) =>
          v.scale <= LIGHTBOX_MIN_SCALE + 0.01 ? { scale: 1, x: 0, y: 0 } : v,
        );
      }
      g.mode = "idle";
    } else if (pointers.current.size === 1 && g.mode === "pinch") {
      // One finger lifted mid-pinch: continue as pan/swipe from the rest.
      const [rest] = [...pointers.current.values()];
      g.mode = view.scale > 1 ? "pan" : "swipe";
      g.startX = rest.x;
      g.startY = rest.y;
      g.startView = view;
      g.moved = true;
    }
  };

  // Clicking the backdrop (stage area around the image, no drag) closes.
  const onStageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (gesture.current.moved || view.scale > 1) return;
    if (e.target === stageRef.current) onClose();
  };

  const transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
  const zoomed = view.scale > 1;
  const btn =
    "flex h-10 w-10 items-center justify-center rounded-full bg-bone/10 text-bone backdrop-blur transition-colors hover:bg-bone/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bone disabled:opacity-30 disabled:hover:bg-bone/10";

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onKeyDown={onDialogKeyDown}
      className="fixed inset-0 z-[100] flex flex-col bg-ink/95 backdrop-blur-sm animate-fade-in"
    >
      {/* top bar: counter + close */}
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        {count > 1 ? (
          <p className="text-sm font-medium tabular-nums text-bone/80">
            {index + 1} / {count}
          </p>
        ) : (
          <span />
        )}
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label={t("product.lightboxClose")}
          className={btn}
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>

      {/* stage */}
      <div
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onStageClick}
        className={`relative flex-1 touch-none select-none overflow-hidden ${
          zoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[index]}
          alt={alt}
          draggable={false}
          style={{ transform }}
          className={`absolute inset-0 h-full w-full object-contain ${
            dragging ? "" : "transition-transform duration-200 ease-out"
          }`}
        />

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              disabled={index === 0}
              aria-label={t("product.lightboxPrev")}
              className={`${btn} absolute left-2 top-1/2 -translate-y-1/2 sm:left-4`}
            >
              <ArrowRightIcon className="h-5 w-5 -scale-x-100" />
            </button>
            <button
              type="button"
              onClick={next}
              disabled={index === count - 1}
              aria-label={t("product.lightboxNext")}
              className={`${btn} absolute right-2 top-1/2 -translate-y-1/2 sm:right-4`}
            >
              <ArrowRightIcon className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {/* bottom bar: dots + zoom controls */}
      <div className="flex flex-col items-center gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {count > 1 && (
          <div className="flex items-center gap-2" aria-hidden="true">
            {images.map((src, i) => (
              <span
                key={`${src.slice(0, 24)}-${i}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-6 bg-bone" : "w-1.5 bg-bone/40"
                }`}
              />
            ))}
          </div>
        )}
        <div dir="ltr" className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => zoomByStep(-1)}
            disabled={!zoomed}
            aria-label={t("product.zoomOut")}
            className={btn}
          >
            <MinusIcon className="h-5 w-5" />
          </button>
          <span className="w-14 text-center text-sm font-medium tabular-nums text-bone/80">
            {Math.round(view.scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => zoomByStep(1)}
            disabled={view.scale >= LIGHTBOX_MAX_SCALE}
            aria-label={t("product.zoomIn")}
            className={btn}
          >
            <PlusIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
