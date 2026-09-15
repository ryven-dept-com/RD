import { describe, expect, it } from "vitest";
import {
  initialMenuState,
  menuReducer,
  type MenuState,
} from "./mobile-menu-state";

/**
 * Regression matrix for the "mobile menu stuck open" bug.
 * The menu must start closed and close under every exit path.
 */

const open: MenuState = { open: true, closeCount: 0 };
const closed = initialMenuState;

describe("mobile menu state machine", () => {
  it("starts closed by default", () => {
    expect(initialMenuState.open).toBe(false);
  });

  it("opens only on explicit toggle/open", () => {
    expect(menuReducer(closed, { type: "toggle" }).open).toBe(true);
    expect(menuReducer(closed, { type: "open" }).open).toBe(true);
  });

  it("toggle closes an open menu", () => {
    expect(menuReducer(open, { type: "toggle" }).open).toBe(false);
  });

  it("closes on explicit close", () => {
    expect(menuReducer(open, { type: "close" }).open).toBe(false);
  });

  it("closes on route change (navigate)", () => {
    expect(menuReducer(open, { type: "navigate" }).open).toBe(false);
  });

  it("closes on language change", () => {
    expect(menuReducer(open, { type: "localeChange" }).open).toBe(false);
  });

  it("closes when the viewport reaches the desktop breakpoint", () => {
    expect(menuReducer(open, { type: "viewportDesktop" }).open).toBe(false);
  });

  it("closes on Escape", () => {
    expect(menuReducer(open, { type: "escape" }).open).toBe(false);
  });

  it("increments closeCount exactly once per closing transition", () => {
    const r = menuReducer(open, { type: "close" });
    expect(r.closeCount).toBe(open.closeCount + 1);
    // already closed → no-op, no counter churn (scroll lock can't re-run)
    const again = menuReducer(closed, { type: "close" });
    expect(again).toBe(closed);
  });

  it("repeated close attempts on a closed menu are no-ops", () => {
    for (const type of ["close", "navigate", "localeChange", "viewportDesktop", "escape"] as const) {
      expect(menuReducer(closed, { type })).toBe(closed);
    }
  });

  it("open on an already-open menu is a no-op", () => {
    expect(menuReducer(open, { type: "open" })).toBe(open);
  });
});
