"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  HeartIcon,
  MinusIcon,
  PhotoIcon,
  PlusIcon,
  ShoppingBagIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon, HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";
import { useStoreCart } from "@/lib/store-cart";
import { toggleWishlist } from "../../actions";
import { CartFab } from "../../CartFab";

export type ProductDetail = {
  id: string;
  title: string;
  description: string | null;
  brand: string | null;
  base_price: number;
  media_urls: string[];
  product_variants: {
    id: string;
    size: string | null;
    color: string | null;
    model: string | null;
    sku: string | null;
    price_override: number | null;
    stock_quantity: number;
    active: boolean;
  }[];
};

type Variant = ProductDetail["product_variants"][number];

function fmt(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function variantLabel(v: Variant): string {
  const parts = [v.size, v.color, v.model].filter((p): p is string => !!p);
  return parts.length ? parts.join(" / ") : "Padrão";
}

export function ProductDetailClient({
  product,
  initialLiked,
}: {
  product: ProductDetail;
  initialLiked: boolean;
}) {
  const router = useRouter();
  const { addItem } = useStoreCart();
  const variants = useMemo(
    () => product.product_variants.filter((v) => v.active),
    [product.product_variants],
  );

  const [imageIdx, setImageIdx] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(
    variants.length === 1 ? variants[0].id : null,
  );
  const [quantity, setQuantity] = useState(1);
  const [liked, setLiked] = useState(initialLiked);
  const [added, setAdded] = useState(false);
  const [, startTransition] = useTransition();

  const selected = variants.find((v) => v.id === selectedId) ?? null;
  const price = selected
    ? (selected.price_override ?? product.base_price)
    : product.base_price;
  const maxStock = selected?.stock_quantity ?? 0;
  const anyStock = variants.some((v) => v.stock_quantity > 0);

  function handleLike() {
    setLiked(!liked);
    startTransition(async () => {
      const res = await toggleWishlist(product.id);
      if (!res.ok) setLiked(liked);
    });
  }

  function handleAdd() {
    if (!selected || selected.stock_quantity === 0) return;
    addItem(
      {
        variantId: selected.id,
        productId: product.id,
        title: product.title,
        variantLabel: variantLabel(selected) === "Padrão" ? null : variantLabel(selected),
        unitPrice: selected.price_override ?? product.base_price,
        image: product.media_urls[0] ?? null,
        maxStock: selected.stock_quantity,
      },
      quantity,
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  }

  return (
    <div className="space-y-5 pb-8">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 -ml-2 rounded-xl text-zinc-500 hover:text-white transition-colors min-h-11 min-w-11 flex items-center justify-center"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={handleLike}
          aria-label={liked ? "Remover dos favoritos" : "Favoritar"}
          className="p-2 rounded-xl min-h-11 min-w-11 flex items-center justify-center active:scale-90 transition-transform"
        >
          {liked ? (
            <HeartIconSolid className="w-6 h-6 text-danger" />
          ) : (
            <HeartIcon className="w-6 h-6 text-zinc-400" />
          )}
        </button>
      </div>

      {/* Image carousel */}
      <div className="space-y-2">
        <div className="relative aspect-square bg-surface-1 border border-white/5 rounded-3xl overflow-hidden">
          {product.media_urls[imageIdx] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.media_urls[imageIdx]}
              alt={product.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <PhotoIcon className="w-12 h-12 text-zinc-700" />
            </div>
          )}
          {product.media_urls.length > 1 && (
            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
              {product.media_urls.map((_, idx) => (
                <span
                  key={idx}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    idx === imageIdx ? "bg-primary" : "bg-white/30"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
        {product.media_urls.length > 1 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-none">
            {product.media_urls.map((url, idx) => (
              <button
                key={url}
                type="button"
                onClick={() => setImageIdx(idx)}
                className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border transition-colors ${
                  idx === imageIdx ? "border-primary/60" : "border-white/8"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div>
        {product.brand && (
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
            {product.brand}
          </p>
        )}
        <h1 className="text-xl font-black text-white leading-tight mt-0.5">
          {product.title}
        </h1>
        <p className="text-2xl font-black text-primary tabular-nums mt-2">{fmt(price)}</p>
        {product.description && (
          <p className="text-sm text-zinc-400 leading-relaxed mt-3 whitespace-pre-line">
            {product.description}
          </p>
        )}
      </div>

      {/* Variant selector */}
      {variants.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Escolha a opção
          </p>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => {
              const out = v.stock_quantity === 0;
              const active = v.id === selectedId;
              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={out}
                  onClick={() => { setSelectedId(v.id); setQuantity(1); }}
                  className={`px-4 min-h-11 rounded-2xl border text-sm font-bold transition-all ${
                    out
                      ? "bg-surface-1/40 border-white/5 text-zinc-700 line-through cursor-not-allowed"
                      : active
                        ? "bg-primary/10 border-primary/60 text-primary"
                        : "bg-surface-1 border-white/10 text-zinc-300 hover:border-white/25"
                  }`}
                >
                  {variantLabel(v)}
                </button>
              );
            })}
          </div>
          {selected && (
            <p className="text-[11px] text-zinc-600">
              {selected.stock_quantity > 0
                ? `${selected.stock_quantity} em estoque`
                : "Sem estoque"}
            </p>
          )}
        </div>
      )}

      {/* Quantity + add to cart */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 bg-surface-1 border border-white/10 rounded-2xl p-1">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="w-10 h-10 rounded-xl text-zinc-400 flex items-center justify-center hover:text-white"
          >
            <MinusIcon className="w-4 h-4" />
          </button>
          <span className="w-8 text-center font-black text-white tabular-nums">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(Math.max(1, maxStock), q + 1))}
            className="w-10 h-10 rounded-xl text-zinc-400 flex items-center justify-center hover:text-white"
          >
            <PlusIcon className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          disabled={!selected || maxStock === 0 || !anyStock}
          className={`flex-1 min-h-13 rounded-2xl font-black text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40 ${
            added ? "bg-primary/20 text-primary border border-primary/40" : "bg-primary text-black hover:opacity-90"
          }`}
        >
          {added ? (
            <>
              <CheckCircleIcon className="w-5 h-5" />
              Adicionado!
            </>
          ) : (
            <>
              <ShoppingBagIcon className="w-5 h-5" />
              {!anyStock
                ? "Produto Esgotado"
                : !selected
                  ? "Escolha uma opção"
                  : "Adicionar ao Carrinho"}
            </>
          )}
        </button>
      </div>

      <CartFab />
    </div>
  );
}
