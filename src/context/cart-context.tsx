"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";

export type CartItem = {
  productId: number;
  slug: string;
  name: string;
  price: number; // cents
  image: string;
  size: string;
  color: string;
  quantity: number;
  maxStock: number;
  /** Exact variant purchased (Phase 5) — present for variant-backed items. */
  variantId?: number;
  /** Variant-level SKU sent to checkout/Meta when available. */
  sku?: string;
};

type CartState = {
  items: CartItem[];
  hydrated: boolean;
};

type CartAction =
  | { type: "ADD"; item: CartItem }
  | { type: "REPLACE"; item: CartItem }
  | { type: "REMOVE"; key: string }
  | { type: "SET_QTY"; key: string; quantity: number }
  | { type: "CLEAR" }
  | { type: "HYDRATE"; items: CartItem[] };

const STORAGE_KEY = "ruven-cart-v1";

export function lineKey(item: Pick<CartItem, "productId" | "size" | "color">) {
  return `${item.productId}-${item.size}-${item.color}`;
}

function reducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "HYDRATE":
      return { ...state, items: action.items, hydrated: true };
    case "ADD": {
      const key = lineKey(action.item);
      const existing = state.items.find((i) => lineKey(i) === key);
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            lineKey(i) === key
              ? {
                  ...i,
                  quantity: Math.min(
                    i.quantity + action.item.quantity,
                    i.maxStock,
                  ),
                }
              : i,
          ),
        };
      }
      return { ...state, items: [...state.items, action.item] };
    }
    case "REPLACE":
      // Direct-purchase (BUY NOW): checkout exactly the selected line.
      return { ...state, items: [action.item] };
    case "REMOVE":
      return { ...state, items: state.items.filter((i) => lineKey(i) !== action.key) };
    case "SET_QTY":
      return {
        ...state,
        items: state.items.map((i) =>
          lineKey(i) === action.key
            ? { ...i, quantity: Math.max(1, Math.min(action.quantity, i.maxStock)) }
            : i,
        ),
      };
    case "CLEAR":
      return { ...state, items: [] };
    default:
      return state;
  }
}

type CartContextValue = {
  items: CartItem[];
  isOpen: boolean;
  count: number;
  subtotal: number;
  openCart: () => void;
  closeCart: () => void;
  addItem: (item: CartItem) => void;
  /** Direct-purchase: replace the cart with a single line (no drawer). */
  buyNow: (item: CartItem) => void;
  removeItem: (key: string) => void;
  setQuantity: (key: string, quantity: number) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { items: [], hydrated: false });
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let items: CartItem[] = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartItem[];
        if (Array.isArray(parsed)) items = parsed;
      }
    } catch {
      // ignore
    }
    // Dispatching once (instead of setState) keeps the hydration flag inside
    // the reducer, so persistence stays gated until after the stored cart is
    // reflected in state.
    dispatch({ type: "HYDRATE", items });
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    } catch {
      // ignore
    }
  }, [state.items, state.hydrated]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const value = useMemo<CartContextValue>(() => {
    const count = state.items.reduce((a, i) => a + i.quantity, 0);
    const subtotal = state.items.reduce((a, i) => a + i.price * i.quantity, 0);
    return {
      items: state.items,
      isOpen,
      count,
      subtotal,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
      addItem: (item) => {
        dispatch({ type: "ADD", item });
        setIsOpen(true);
      },
      buyNow: (item) => dispatch({ type: "REPLACE", item }),
      removeItem: (key) => dispatch({ type: "REMOVE", key }),
      setQuantity: (key, quantity) =>
        dispatch({ type: "SET_QTY", key, quantity }),
      clearCart: () => dispatch({ type: "CLEAR" }),
    };
  }, [state.items, isOpen]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
