import { describe, expect, it } from "vitest";
import {
  LIGHTBOX_MAX_SCALE,
  LIGHTBOX_MIN_SCALE,
  LIGHTBOX_SWIPE_DISTANCE,
  LIGHTBOX_ZOOM_STEP,
  clampOffset,
  clampScale,
} from "./image-lightbox";

describe("clampScale", () => {
  it("keeps values inside the supported zoom range", () => {
    expect(clampScale(1)).toBe(1);
    expect(clampScale(2.5)).toBe(2.5);
    expect(clampScale(LIGHTBOX_MAX_SCALE)).toBe(LIGHTBOX_MAX_SCALE);
  });

  it("clamps below the minimum (no fake sub-1 zoom)", () => {
    expect(clampScale(0.5)).toBe(LIGHTBOX_MIN_SCALE);
    expect(clampScale(0)).toBe(LIGHTBOX_MIN_SCALE);
    expect(clampScale(-3)).toBe(LIGHTBOX_MIN_SCALE);
  });

  it("clamps above the maximum", () => {
    expect(clampScale(LIGHTBOX_MAX_SCALE + 1)).toBe(LIGHTBOX_MAX_SCALE);
    expect(clampScale(99)).toBe(LIGHTBOX_MAX_SCALE);
  });

  it("is safe for non-finite input", () => {
    expect(clampScale(Number.NaN)).toBe(LIGHTBOX_MIN_SCALE);
    expect(clampScale(Number.POSITIVE_INFINITY)).toBe(LIGHTBOX_MIN_SCALE);
  });

  it("zoom steps stay inside the range over repeated application", () => {
    let scale = LIGHTBOX_MIN_SCALE;
    for (let i = 0; i < 20; i += 1) {
      scale = clampScale(scale * LIGHTBOX_ZOOM_STEP);
      expect(scale).toBeGreaterThanOrEqual(LIGHTBOX_MIN_SCALE);
      expect(scale).toBeLessThanOrEqual(LIGHTBOX_MAX_SCALE);
    }
    for (let i = 0; i < 20; i += 1) {
      scale = clampScale(scale / LIGHTBOX_ZOOM_STEP);
      expect(scale).toBeGreaterThanOrEqual(LIGHTBOX_MIN_SCALE);
    }
    expect(scale).toBe(LIGHTBOX_MIN_SCALE);
  });
});

describe("clampOffset", () => {
  it("forces zero offset at scale 1 (image centered, never panned away)", () => {
    expect(clampOffset(500, 1, 800)).toBe(0);
    expect(clampOffset(-500, 1, 800)).toBe(0);
  });

  it("allows panning within bounds when zoomed", () => {
    // scale 2 on a 800px stage: max = (1 * 800) / 2 + 48 = 448
    expect(clampOffset(100, 2, 800)).toBe(100);
    expect(clampOffset(-100, 2, 800)).toBe(-100);
  });

  it("never lets the image be dragged completely off-screen", () => {
    const max = ((2 - 1) * 800) / 2 + 48;
    expect(clampOffset(10_000, 2, 800)).toBe(max);
    expect(clampOffset(-10_000, 2, 800)).toBe(-max);
  });

  it("grows the allowed pan area with the zoom level", () => {
    const atTwo = clampOffset(10_000, 2, 800);
    const atFour = clampOffset(10_000, 4, 800);
    expect(atFour).toBeGreaterThan(atTwo);
  });

  it("is safe for non-finite input", () => {
    expect(clampOffset(Number.NaN, 2, 800)).toBe(0);
  });
});

describe("swipe threshold", () => {
  it("requires a deliberate horizontal gesture", () => {
    expect(LIGHTBOX_SWIPE_DISTANCE).toBeGreaterThanOrEqual(48);
  });
});
