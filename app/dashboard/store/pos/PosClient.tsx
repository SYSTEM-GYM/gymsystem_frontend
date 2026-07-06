"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BanknotesIcon,
  CreditCardIcon,
  MagnifyingGlassIcon,
  MinusIcon,
  PhotoIcon,
  PlusIcon,
  PrinterIcon,
  QrCodeIcon,
  ShoppingCartIcon,
  TagIcon,
  TrashIcon,
  UserIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import {
  registerPosSale,
  searchStudentsForPos,
  type PosSaleResult,
  type StoreCategory,
  type StoreProduct,
  type ProductVariant,
} from "../actions";

type CartLine = {
  variantId: string;
  productTitle: string;
  variantLabel: string | null;
  unitPrice: number;
  quantity: number;
  maxStock: number;
};

type PaymentMethod = "pix" | "credit" | "debit" | "cash";

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { value: "cash",   label: "Dinheiro", icon: <BanknotesIcon className="w-4 h-4" /> },
  { value: "pix",    label: "PIX",      icon: <QrCodeIcon className="w-4 h-4" /> },
  { value: "credit", label: "Crédito",  icon: <CreditCardIcon className="w-4 h-4" /> },
  { value: "debit",  label: "Débito",   icon: <CreditCardIcon className="w-4 h-4" /> },
];

function fmt(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function variantLabel(v: ProductVariant): string | null {
  const parts = [v.size, v.color, v.model].filter((p): p is string => !!p);
  return parts.length ? parts.join(" / ") : null;
}

function unitPrice(product: StoreProduct, v: ProductVariant): number {
  return v.price_override ?? product.base_price;
}

// ── Receipt (printable) ───────────────────────────────────────────────────────

function Receipt({
  sale,
  buyerLabel,
  paymentMethod,
  onNewSale,
}: {
  sale: NonNullable<Extract<PosSaleResult, { ok: true }>["sale"]>;
  buyerLabel: string;
  paymentMethod: PaymentMethod;
  onNewSale: () => void;
}) {
  const payment = PAYMENT_OPTIONS.find((p) => p.value === paymentMethod)?.label ?? paymentMethod;
  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="flex items-center gap-3 p-4 bg-primary/10 border border-primary/25 rounded-2xl" data-print-hide="">
        <CheckCircleIcon className="w-8 h-8 text-primary shrink-0" />
        <div>
          <p className="font-black text-white">Venda concluída!</p>
          <p className="text-xs text-zinc-400">Estoque atualizado e receita lançada no financeiro.</p>
        </div>
      </div>

      {/* Printable area */}
      <div className="bg-surface-1 border border-white/8 rounded-2xl p-5 print:bg-white print:border-none">
        <div className="text-center border-b border-dashed border-white/10 pb-3 mb-3">
          <p className="font-black text-white tracking-widest uppercase">Recibo de Venda</p>
          <p className="text-[10px] text-zinc-500 mt-1 font-mono">
            Pedido #{sale.orderId.slice(0, 8)} · {new Date().toLocaleString("pt-BR")}
          </p>
          <p className="text-[10px] text-zinc-500">Cliente: {buyerLabel} · Pagamento: {payment}</p>
        </div>

        <div className="space-y-1.5">
          {sale.items.map((item, idx) => (
            <div key={idx} className="flex items-start justify-between gap-2 text-xs">
              <span className="text-zinc-300">
                {item.quantity}× {item.title}
                {item.variant && <span className="text-zinc-600"> ({item.variant})</span>}
              </span>
              <span className="text-zinc-300 tabular-nums shrink-0">{fmt(item.totalPrice)}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-dashed border-white/10 mt-3 pt-3 space-y-1 text-xs">
          <div className="flex justify-between text-zinc-500">
            <span>Subtotal</span><span className="tabular-nums">{fmt(sale.subtotal)}</span>
          </div>
          {sale.discount > 0 && (
            <div className="flex justify-between text-zinc-500">
              <span>Desconto{sale.couponCode ? ` (${sale.couponCode})` : ""}</span>
              <span className="tabular-nums">−{fmt(sale.discount)}</span>
            </div>
          )}
          <div className="flex justify-between font-black text-white pt-1">
            <span>TOTAL</span><span className="tabular-nums text-primary">{fmt(sale.total)}</span>
          </div>
        </div>
        <p className="text-center text-[9px] text-zinc-600 mt-4">Obrigado pela preferência! 💪</p>
      </div>

      <div className="flex gap-3" data-print-hide="">
        <button type="button" onClick={() => window.print()}
          className="flex-1 flex items-center justify-center gap-2 min-h-12 rounded-2xl bg-surface-1 border border-white/10 text-zinc-300 text-sm font-bold hover:border-primary/40 transition-colors">
          <PrinterIcon className="w-4 h-4" />
          Imprimir Recibo
        </button>
        <button type="button" onClick={onNewSale}
          className="flex-1 min-h-12 rounded-2xl bg-primary text-black text-sm font-black hover:opacity-90 active:scale-[0.98] transition-all">
          Nova Venda
        </button>
      </div>
    </div>
  );
}

// ── Variant picker ────────────────────────────────────────────────────────────

function VariantPicker({
  product,
  onPick,
  onClose,
}: {
  product: StoreProduct;
  onPick: (v: ProductVariant) => void;
  onClose: () => void;
}) {
  const variants = product.product_variants.filter((v) => v.active);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm bg-surface-1 border border-white/10 rounded-3xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-bold text-white text-sm">{product.title}</p>
          <button type="button" onClick={onClose} className="p-1.5 text-zinc-500 hover:text-white">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {variants.map((v) => {
            const out = v.stock_quantity === 0;
            return (
              <button key={v.id} type="button" disabled={out}
                onClick={() => { onPick(v); onClose(); }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-colors ${
                  out ? "bg-surface-2/40 border-white/5 text-zinc-600 cursor-not-allowed"
                      : "bg-surface-2 border-white/8 text-zinc-200 hover:border-primary/40"
                }`}>
                <span className="font-semibold">{variantLabel(v) ?? "Padrão"}</span>
                <span className="text-xs tabular-nums">
                  {out ? "Esgotado" : `${fmt(unitPrice(product, v))} · ${v.stock_quantity} un.`}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main POS ──────────────────────────────────────────────────────────────────

export function PosClient({
  products,
  categories,
}: {
  products: StoreProduct[];
  categories: StoreCategory[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [pickerProduct, setPickerProduct] = useState<StoreProduct | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [buyerQuery, setBuyerQuery] = useState("");
  const [buyerResults, setBuyerResults] = useState<{ id: string; full_name: string }[]>([]);
  const [buyer, setBuyer] = useState<{ id: string | null; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [completedSale, setCompletedSale] =
    useState<Extract<PosSaleResult, { ok: true }>["sale"] | null>(null);
  const [completedPayment, setCompletedPayment] = useState<PaymentMethod>("cash");
  const [completedBuyer, setCompletedBuyer] = useState("");

  const activeProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (!p.active) return false;
      if (categoryId && p.category_id !== categoryId) return false;
      if (q && !p.title.toLowerCase().includes(q) && !(p.brand ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, search, categoryId]);

  const subtotal = cart.reduce((acc, l) => acc + l.unitPrice * l.quantity, 0);
  const itemCount = cart.reduce((acc, l) => acc + l.quantity, 0);

  function addVariant(product: StoreProduct, v: ProductVariant) {
    setError(null);
    setCart((prev) => {
      const existing = prev.find((l) => l.variantId === v.id);
      if (existing) {
        return prev.map((l) =>
          l.variantId === v.id
            ? { ...l, quantity: Math.min(l.maxStock, l.quantity + 1) }
            : l,
        );
      }
      return [
        ...prev,
        {
          variantId: v.id,
          productTitle: product.title,
          variantLabel: variantLabel(v),
          unitPrice: unitPrice(product, v),
          quantity: 1,
          maxStock: v.stock_quantity,
        },
      ];
    });
  }

  function handleProductTap(product: StoreProduct) {
    const variants = product.product_variants.filter((v) => v.active && v.stock_quantity > 0);
    if (variants.length === 0) { setError(`"${product.title}" está sem estoque.`); return; }
    if (variants.length === 1) addVariant(product, variants[0]);
    else setPickerProduct(product);
  }

  function updateQty(variantId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) =>
          l.variantId === variantId
            ? { ...l, quantity: Math.min(l.maxStock, Math.max(0, l.quantity + delta)) }
            : l,
        )
        .filter((l) => l.quantity > 0),
    );
  }

  async function handleBuyerSearch(q: string) {
    setBuyerQuery(q);
    if (q.trim().length < 2) { setBuyerResults([]); return; }
    setBuyerResults(await searchStudentsForPos(q));
  }

  function resetSale() {
    setCart([]); setCouponCode(""); setBuyer(null); setBuyerQuery("");
    setCompletedSale(null); setError(null);
    router.refresh();
  }

  function handleFinalize() {
    setError(null);
    if (cart.length === 0) { setError("Adicione itens à venda."); return; }
    const buyerName = buyer?.id ? undefined : (buyer?.name || buyerQuery.trim() || undefined);
    if (!buyer?.id && !buyerName) {
      setError("Identifique o comprador: busque um aluno ou digite o nome do cliente.");
      return;
    }

    startTransition(async () => {
      const res = await registerPosSale({
        items: cart.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
        couponCode: couponCode.trim() || undefined,
        paymentMethod,
        buyerId: buyer?.id ?? undefined,
        buyerName,
      });
      if (res.ok) {
        setCompletedSale(res.sale);
        setCompletedPayment(paymentMethod);
        setCompletedBuyer(buyer?.name ?? buyerName ?? "Cliente");
      } else {
        setError(res.message);
      }
    });
  }

  if (completedSale) {
    return (
      <Receipt
        sale={completedSale}
        buyerLabel={completedBuyer}
        paymentMethod={completedPayment}
        onNewSale={resetSale}
      />
    );
  }

  const inputCls =
    "w-full bg-surface-1 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-primary/40 transition-colors";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5 items-start">
      {/* ── Catalog panel ── */}
      <div className="space-y-3">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto ou marca..." autoFocus
            className="w-full pl-11 pr-4 py-3 bg-surface-1 border border-white/8 rounded-2xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-primary/40 transition-colors" />
        </div>

        <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
          <button type="button" onClick={() => setCategoryId(null)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
              categoryId === null ? "bg-primary text-black border-primary" : "bg-surface-1 border-white/10 text-zinc-500"
            }`}>
            Todos
          </button>
          {categories.filter((c) => c.active).map((c) => (
            <button key={c.id} type="button"
              onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
                categoryId === c.id ? "bg-primary text-black border-primary" : "bg-surface-1 border-white/10 text-zinc-500"
              }`}>
              {c.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
          {activeProducts.map((p) => {
            const stock = p.product_variants.reduce((a, v) => a + (v.active ? v.stock_quantity : 0), 0);
            return (
              <button key={p.id} type="button" onClick={() => handleProductTap(p)} disabled={stock === 0}
                className={`text-left bg-surface-1 border rounded-2xl overflow-hidden transition-all active:scale-[0.98] ${
                  stock === 0 ? "border-white/5 opacity-40 cursor-not-allowed" : "border-white/8 hover:border-primary/40"
                }`}>
                <div className="relative aspect-square bg-surface-2">
                  {p.media_urls[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.media_urls[0]} alt={p.title} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <PhotoIcon className="w-6 h-6 text-zinc-700" />
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-[11px] font-bold text-white leading-tight line-clamp-2">{p.title}</p>
                  <p className="text-xs font-black text-primary tabular-nums mt-1">{fmt(p.base_price)}</p>
                </div>
              </button>
            );
          })}
          {activeProducts.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-zinc-600">Nenhum produto encontrado.</p>
          )}
        </div>
      </div>

      {/* ── Sale panel ── */}
      <div className="bg-surface-1 border border-white/8 rounded-3xl p-4 space-y-4 lg:sticky lg:top-4">
        <div className="flex items-center gap-2">
          <ShoppingCartIcon className="w-4 h-4 text-primary" />
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
            Venda Atual {itemCount > 0 && `(${itemCount})`}
          </h2>
        </div>

        {/* Cart lines */}
        {cart.length === 0 ? (
          <p className="text-xs text-zinc-600 text-center py-6">Toque nos produtos para adicionar.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {cart.map((l) => (
              <div key={l.variantId} className="flex items-center gap-2 bg-surface-2/60 rounded-xl p-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{l.productTitle}</p>
                  <p className="text-[10px] text-zinc-500">
                    {l.variantLabel ? `${l.variantLabel} · ` : ""}{fmt(l.unitPrice)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => updateQty(l.variantId, -1)}
                    className="w-7 h-7 rounded-lg bg-surface-1 border border-white/10 text-zinc-400 flex items-center justify-center hover:text-white">
                    <MinusIcon className="w-3 h-3" />
                  </button>
                  <span className="w-6 text-center text-xs font-black text-white tabular-nums">{l.quantity}</span>
                  <button type="button" onClick={() => updateQty(l.variantId, +1)} disabled={l.quantity >= l.maxStock}
                    className="w-7 h-7 rounded-lg bg-surface-1 border border-white/10 text-zinc-400 flex items-center justify-center hover:text-white disabled:opacity-30">
                    <PlusIcon className="w-3 h-3" />
                  </button>
                  <button type="button" onClick={() => updateQty(l.variantId, -l.quantity)}
                    className="w-7 h-7 rounded-lg text-zinc-600 flex items-center justify-center hover:text-danger">
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Buyer */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
            <UserIcon className="w-3 h-3" /> Comprador
          </label>
          {buyer ? (
            <div className="flex items-center justify-between bg-primary/10 border border-primary/25 rounded-xl px-3 py-2.5">
              <span className="text-sm font-semibold text-white truncate">{buyer.name}</span>
              <button type="button" onClick={() => { setBuyer(null); setBuyerQuery(""); }}
                className="text-zinc-500 hover:text-white shrink-0 ml-2">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <input value={buyerQuery} onChange={(e) => handleBuyerSearch(e.target.value)}
                placeholder="Buscar aluno ou digitar nome..." className={inputCls} />
              {buyerResults.length > 0 && (
                <div className="absolute z-10 inset-x-0 top-full mt-1 bg-surface-2 border border-white/10 rounded-xl overflow-hidden shadow-xl">
                  {buyerResults.map((s) => (
                    <button key={s.id} type="button"
                      onClick={() => { setBuyer({ id: s.id, name: s.full_name }); setBuyerResults([]); }}
                      className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-surface-1 hover:text-white transition-colors">
                      {s.full_name}
                    </button>
                  ))}
                  <button type="button"
                    onClick={() => { setBuyer({ id: null, name: buyerQuery.trim() }); setBuyerResults([]); }}
                    className="w-full text-left px-3 py-2 text-xs text-primary hover:bg-surface-1 transition-colors border-t border-white/5">
                    Usar &ldquo;{buyerQuery.trim()}&rdquo; como cliente de balcão
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Coupon */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
            <TagIcon className="w-3 h-3" /> Cupom
          </label>
          <input value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            placeholder="CÓDIGO (opcional)" className={`${inputCls} font-mono uppercase tracking-widest`} />
        </div>

        {/* Payment */}
        <div className="grid grid-cols-4 gap-1.5">
          {PAYMENT_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" onClick={() => setPaymentMethod(opt.value)}
              className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-[10px] font-bold transition-colors ${
                paymentMethod === opt.value
                  ? "bg-primary/10 border-primary/50 text-primary"
                  : "bg-surface-2 border-white/8 text-zinc-500 hover:text-zinc-300"
              }`}>
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>

        {/* Total + finalize */}
        <div className="border-t border-white/5 pt-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white">Total</span>
            <span className="text-xl font-black text-primary tabular-nums">{fmt(subtotal)}</span>
          </div>
          {couponCode && (
            <p className="text-[10px] text-zinc-600">
              O desconto do cupom é validado e aplicado na finalização.
            </p>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}
          <button type="button" onClick={handleFinalize} disabled={pending || cart.length === 0}
            className="w-full min-h-13 rounded-2xl bg-primary text-black font-black text-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40">
            {pending ? "Processando..." : "Finalizar Venda"}
          </button>
        </div>
      </div>

      {pickerProduct && (
        <VariantPicker
          product={pickerProduct}
          onPick={(v) => addVariant(pickerProduct, v)}
          onClose={() => setPickerProduct(null)}
        />
      )}
    </div>
  );
}
