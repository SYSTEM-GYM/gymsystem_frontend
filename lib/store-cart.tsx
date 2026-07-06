"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/**
 * Persistent shopping cart (localStorage). Prices held here are DISPLAY
 * ONLY — the backend recomputes every amount from the catalog at checkout,
 * so tampering with this storage cannot change what is charged.
 */

export type CartItem = {
  variantId: string;
  productId: string;
  title: string;
  variantLabel: string | null;
  unitPrice: number;
  image: string | null;
  quantity: number;
  maxStock: number;
};

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  updateQuantity: (variantId: string, delta: number) => void;
  removeItem: (variantId: string) => void;
  clear: () => void;
};

const STORAGE_KEY = "simp_store_cart_v1";

const CartContext = createContext<CartContextValue | null>(null);

type CartState = { hydrated: boolean; items: CartItem[] };

export function StoreCartProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CartState>({ hydrated: false, items: [] });
  const items = state.items;

  // Hydrate from localStorage one tick after mount (SSR renders an empty
  // cart; the deferred callback keeps setState out of the effect body).
  useEffect(() => {
    const t = setTimeout(() => {
      let stored: CartItem[] = [];
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) stored = JSON.parse(raw) as CartItem[];
      } catch {
        // Corrupted storage → start clean
      }
      setState({ hydrated: true, items: stored });
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // Persist on every change after hydration
  useEffect(() => {
    if (!state.hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    } catch {
      // Storage full/unavailable — cart just won't persist
    }
  }, [state]);

  const mutateItems = useCallback(
    (fn: (prev: CartItem[]) => CartItem[]) =>
      setState((prev) => ({ ...prev, items: fn(prev.items) })),
    [],
  );

  const addItem = useCallback(
    (item: Omit<CartItem, "quantity">, quantity = 1) => {
      mutateItems((prev) => {
        const existing = prev.find((i) => i.variantId === item.variantId);
        if (existing) {
          return prev.map((i) =>
            i.variantId === item.variantId
              ? { ...i, quantity: Math.min(i.maxStock, i.quantity + quantity) }
              : i,
          );
        }
        return [...prev, { ...item, quantity: Math.min(item.maxStock, quantity) }];
      });
    },
    [mutateItems],
  );

  const updateQuantity = useCallback(
    (variantId: string, delta: number) => {
      mutateItems((prev) =>
        prev
          .map((i) =>
            i.variantId === variantId
              ? { ...i, quantity: Math.min(i.maxStock, Math.max(0, i.quantity + delta)) }
              : i,
          )
          .filter((i) => i.quantity > 0),
      );
    },
    [mutateItems],
  );

  const removeItem = useCallback(
    (variantId: string) => {
      mutateItems((prev) => prev.filter((i) => i.variantId !== variantId));
    },
    [mutateItems],
  );

  const clear = useCallback(() => mutateItems(() => []), [mutateItems]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count: items.reduce((acc, i) => acc + i.quantity, 0),
      subtotal: items.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0),
      addItem,
      updateQuantity,
      removeItem,
      clear,
    }),
    [items, addItem, updateQuantity, removeItem, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useStoreCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useStoreCart must be used inside <StoreCartProvider>");
  }
  return ctx;
}
