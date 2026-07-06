"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  MinusIcon,
  PhotoIcon,
  PlusIcon,
  ShoppingBagIcon,
  TagIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { useStoreCart } from "@/lib/store-cart";
import { createStoreCheckout, previewCoupon, type CouponPreview } from "../actions";

function fmt(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function CartClient() {
  const router = useRouter();
  const { items, subtotal, updateQuantity, removeItem, clear } = useStoreCart();
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<CouponPreview | null>(null);
  const [checkingCoupon, startCouponCheck] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [freeSuccess, setFreeSuccess] = useState(false);

  const discount = coupon?.ok ? coupon.discount : 0;
  const total = Math.max(0, subtotal - discount);

  function handleApplyCoupon() {
    if (!couponCode.trim()) return;
    startCouponCheck(async () => {
      setCoupon(await previewCoupon(couponCode, subtotal));
    });
  }

  function handleCheckout() {
    setError(null);
    startTransition(async () => {
      const res = await createStoreCheckout({
        items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        couponCode: coupon?.ok ? coupon.code : undefined,
      });

      if (!res.ok) {
        setError(res.message);
        return;
      }
      clear();
      if (res.requiresPayment) {
        window.location.href = res.checkoutUrl;
      } else {
        setFreeSuccess(true);
      }
    });
  }

  if (freeSuccess) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <CheckCircleIcon className="w-9 h-9 text-primary" />
        </div>
        <div>
          <p className="text-lg font-black text-white">Pedido confirmado! 🎉</p>
          <p className="text-sm text-zinc-500 mt-1">Cupom de 100% aplicado — retire na recepção.</p>
        </div>
        <Link
          href="/app/store/orders"
          className="px-6 py-3 rounded-2xl bg-primary text-black font-bold text-sm active:scale-95 transition-transform"
        >
          Ver Meus Pedidos
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 -ml-2 rounded-xl text-zinc-500 hover:text-white transition-colors min-h-11 min-w-11 flex items-center justify-center"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div>
          <p className="text-[10px] font-semibold text-primary uppercase tracking-widest">Loja</p>
          <h1 className="text-xl font-black text-white leading-tight">Carrinho</h1>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="py-16 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-surface-1 flex items-center justify-center mx-auto">
            <ShoppingBagIcon className="w-8 h-8 text-zinc-700" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-500">Seu carrinho está vazio</p>
            <p className="text-xs text-zinc-600 mt-1">Explore a vitrine e adicione produtos.</p>
          </div>
          <Link
            href="/app/store"
            className="inline-block px-6 py-3 rounded-2xl bg-primary text-black font-bold text-sm active:scale-95 transition-transform"
          >
            Ir para a Loja
          </Link>
        </div>
      ) : (
        <>
          {/* Items */}
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.variantId}
                className="flex items-center gap-3 bg-surface-1 border border-white/5 rounded-2xl p-3"
              >
                <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-surface-2 shrink-0">
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image} alt={item.title} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <PhotoIcon className="w-6 h-6 text-zinc-700" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{item.title}</p>
                  {item.variantLabel && (
                    <p className="text-[10px] text-zinc-500">{item.variantLabel}</p>
                  )}
                  <p className="text-sm font-black text-primary tabular-nums mt-1">
                    {fmt(item.unitPrice * item.quantity)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => removeItem(item.variantId)}
                    aria-label="Remover item"
                    className="p-1 text-zinc-600 hover:text-danger transition-colors"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.variantId, -1)}
                      className="w-8 h-8 rounded-lg bg-surface-2 border border-white/10 text-zinc-400 flex items-center justify-center active:scale-90 transition-transform"
                    >
                      <MinusIcon className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-black text-white tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.variantId, +1)}
                      disabled={item.quantity >= item.maxStock}
                      className="w-8 h-8 rounded-lg bg-surface-2 border border-white/10 text-zinc-400 flex items-center justify-center active:scale-90 transition-transform disabled:opacity-30"
                    >
                      <PlusIcon className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Coupon */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              <TagIcon className="w-3.5 h-3.5" />
              Cupom de Desconto
            </label>
            <div className="flex gap-2">
              <input
                value={couponCode}
                onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCoupon(null); }}
                placeholder="CÓDIGO"
                className="flex-1 min-h-11 bg-surface-1 border border-white/8 rounded-xl px-4 text-sm text-white placeholder-zinc-600 outline-none focus:border-primary/50 font-mono uppercase tracking-widest"
              />
              <button
                type="button"
                onClick={handleApplyCoupon}
                disabled={!couponCode.trim() || checkingCoupon}
                className="px-4 min-h-11 rounded-xl bg-surface-1 border border-white/8 text-sm text-zinc-400 hover:text-white disabled:opacity-40 transition-colors"
              >
                {checkingCoupon ? "..." : "Aplicar"}
              </button>
            </div>
            {coupon && (
              <p className={`text-xs font-medium ${coupon.ok ? "text-primary" : "text-danger"}`}>
                {coupon.ok
                  ? `✓ Cupom ${coupon.code}: −${fmt(coupon.discount)}`
                  : `✗ ${coupon.message}`}
              </p>
            )}
          </div>

          {/* Summary */}
          <div className="bg-surface-1 border border-white/5 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Subtotal</span>
              <span className="text-zinc-300 tabular-nums">{fmt(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500">Desconto</span>
                <span className="text-danger tabular-nums">−{fmt(discount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between font-black pt-2 border-t border-white/5">
              <span className="text-white">Total</span>
              <span className="text-primary text-xl tabular-nums">{fmt(total)}</span>
            </div>
          </div>

          {error && (
            <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleCheckout}
            disabled={pending}
            className="w-full min-h-13 rounded-2xl bg-primary text-black font-black text-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40"
          >
            {pending ? "Processando..." : total === 0 ? "Confirmar Pedido Grátis 🎉" : "Ir para Pagamento"}
          </button>
          <p className="text-[10px] text-zinc-600 text-center -mt-2">
            PIX, crédito ou débito via checkout seguro Stripe. O valor final é
            calculado no servidor.
          </p>
        </>
      )}
    </div>
  );
}
