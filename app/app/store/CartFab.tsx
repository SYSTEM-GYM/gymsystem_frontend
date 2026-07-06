"use client";

import Link from "next/link";
import { ShoppingBagIcon } from "@heroicons/react/24/outline";
import { useStoreCart } from "@/lib/store-cart";

/** Floating cart button — sits above the bottom nav on every store screen. */
export function CartFab() {
  const { count } = useStoreCart();
  if (count === 0) return null;

  return (
    <Link
      href="/app/store/cart"
      aria-label={`Abrir carrinho (${count} itens)`}
      className="fixed bottom-24 right-4 z-40 flex items-center gap-2 pl-4 pr-5 min-h-13 rounded-2xl bg-primary text-black font-black text-sm shadow-2xl shadow-primary/20 active:scale-95 transition-transform"
    >
      <span className="relative">
        <ShoppingBagIcon className="w-5 h-5" />
        <span className="absolute -top-2 -right-2 min-w-4 h-4 px-1 rounded-full bg-black text-primary text-[9px] font-black flex items-center justify-center tabular-nums">
          {count}
        </span>
      </span>
      Carrinho
    </Link>
  );
}
