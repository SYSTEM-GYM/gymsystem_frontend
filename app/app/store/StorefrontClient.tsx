"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  HeartIcon,
  MagnifyingGlassIcon,
  PhotoIcon,
} from "@heroicons/react/24/outline";
import { HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";
import { toggleWishlist } from "./actions";

export type StorefrontProduct = {
  id: string;
  category_id: string | null;
  title: string;
  brand: string | null;
  base_price: number;
  media_urls: string[];
  product_variants: {
    id: string;
    price_override: number | null;
    stock_quantity: number;
    active: boolean;
  }[];
};

function fmt(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function priceFrom(p: StorefrontProduct): number {
  const prices = p.product_variants
    .filter((v) => v.active)
    .map((v) => v.price_override ?? p.base_price);
  return prices.length ? Math.min(...prices) : p.base_price;
}

function inStock(p: StorefrontProduct): boolean {
  return p.product_variants.some((v) => v.active && v.stock_quantity > 0);
}

function WishlistButton({
  productId,
  liked,
  onToggle,
}: {
  productId: string;
  liked: boolean;
  onToggle: (liked: boolean) => void;
}) {
  const [, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    // Optimistic flip; revert on failure
    onToggle(!liked);
    startTransition(async () => {
      const res = await toggleWishlist(productId);
      if (!res.ok) onToggle(liked);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={liked ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      className="absolute top-2 right-2 w-9 h-9 rounded-xl bg-black/50 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform"
    >
      {liked ? (
        <HeartIconSolid className="w-5 h-5 text-danger" />
      ) : (
        <HeartIcon className="w-5 h-5 text-white" />
      )}
    </button>
  );
}

export function StorefrontClient({
  products,
  categories,
  initialLiked,
}: {
  products: StorefrontProduct[];
  categories: { id: string; name: string }[];
  initialLiked: string[];
}) {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [onlyLiked, setOnlyLiked] = useState(false);
  const [liked, setLiked] = useState<Set<string>>(new Set(initialLiked));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryId && p.category_id !== categoryId) return false;
      if (onlyLiked && !liked.has(p.id)) return false;
      if (q && !p.title.toLowerCase().includes(q) && !(p.brand ?? "").toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [products, search, categoryId, onlyLiked, liked]);

  function setLikedFor(productId: string) {
    return (isLiked: boolean) =>
      setLiked((prev) => {
        const next = new Set(prev);
        if (isLiked) next.add(productId);
        else next.delete(productId);
        return next;
      });
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar produto ou marca..."
          className="w-full min-h-11 pl-11 pr-4 bg-surface-1 border border-white/8 rounded-2xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-primary/40 transition-colors"
        />
      </div>

      {/* Category chips */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4 pb-1">
        <button
          type="button"
          onClick={() => { setCategoryId(null); setOnlyLiked(false); }}
          className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
            categoryId === null && !onlyLiked
              ? "bg-primary text-black border-primary"
              : "bg-surface-1 border-white/10 text-zinc-500"
          }`}
        >
          Todos
        </button>
        <button
          type="button"
          onClick={() => setOnlyLiked(!onlyLiked)}
          className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
            onlyLiked
              ? "bg-danger/15 text-danger border-danger/40"
              : "bg-surface-1 border-white/10 text-zinc-500"
          }`}
        >
          <HeartIconSolid className="w-3 h-3" />
          Favoritos
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
              categoryId === c.id
                ? "bg-primary text-black border-primary"
                : "bg-surface-1 border-white/10 text-zinc-500"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <PhotoIcon className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">
            {products.length === 0 ? "A vitrine ainda está vazia." : "Nenhum produto encontrado."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((p) => {
            const available = inStock(p);
            return (
              <Link
                key={p.id}
                href={`/app/store/product/${p.id}`}
                className="bg-surface-1 border border-white/8 rounded-3xl overflow-hidden active:scale-[0.98] hover:border-primary/25 transition-all"
              >
                <div className="relative aspect-square bg-surface-2">
                  {p.media_urls[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.media_urls[0]}
                      alt={p.title}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <PhotoIcon className="w-8 h-8 text-zinc-700" />
                    </div>
                  )}
                  <WishlistButton
                    productId={p.id}
                    liked={liked.has(p.id)}
                    onToggle={setLikedFor(p.id)}
                  />
                  {!available && (
                    <div className="absolute inset-x-0 bottom-0 bg-black/70 backdrop-blur-sm py-1 text-center">
                      <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wide">
                        Esgotado
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  {p.brand && (
                    <p className="text-[9px] font-semibold text-zinc-600 uppercase tracking-widest">
                      {p.brand}
                    </p>
                  )}
                  <p className="text-xs font-bold text-white leading-tight line-clamp-2 mt-0.5">
                    {p.title}
                  </p>
                  <p className="text-sm font-black text-primary tabular-nums mt-1.5">
                    {fmt(priceFrom(p))}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
