/**
 * Mobile menu state machine — pure, dependency-free, fully unit-tested.
 * See use-mobile-menu.ts for the React binding and the root-cause notes of
 * the stuck-menu bug this matrix fixes.
 */

export type MenuState = {
  open: boolean;
  /** Monotonic counter — lets effects observe repeated close requests. */
  closeCount: number;
};

export type MenuAction =
  | { type: "toggle" }
  | { type: "open" }
  | { type: "close" }
  | { type: "navigate" }
  | { type: "localeChange" }
  | { type: "viewportDesktop" }
  | { type: "escape" };

export const initialMenuState: MenuState = { open: false, closeCount: 0 };

export function menuReducer(state: MenuState, action: MenuAction): MenuState {
  switch (action.type) {
    case "toggle":
      return state.open
        ? { open: false, closeCount: state.closeCount + 1 }
        : { open: true, closeCount: state.closeCount };
    case "open":
      return state.open ? state : { open: true, closeCount: state.closeCount };
    case "close":
    case "navigate":
    case "localeChange":
    case "viewportDesktop":
    case "escape":
      return state.open
        ? { open: false, closeCount: state.closeCount + 1 }
        : state;
  }
}
