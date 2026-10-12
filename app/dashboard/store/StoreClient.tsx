"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArchiveBoxIcon,
  PhotoIcon,
  PlusIcon,
  TagIcon,
  TicketIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  deleteCategory,
  deleteCoupon,
  deleteVariant,
  saveCategory,
  saveCoupon,
  saveProduct,
  saveVariant,
  uploadProductImage,
  type StoreCategory,
  type StoreCoupon,
  type StoreDashboardData,
  type StoreProduct,
  type ProductVariant,
} from "./actions";

const inputCls =
  "w-full bg-surface-2 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-primary/40 transition-colors";
const labelCls = "block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5";

function fmt(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function totalStock(p: StoreProduct): number {
  return p.product_variants.reduce((acc, v) => acc + (v.active ? v.stock_quantity : 0), 0);
}

// ── Product editor modal ──────────────────────────────────────────────────────

function VariantRow({
  variant,
  productId,
  onChanged,
}: {
  variant: ProductVariant | null;
  productId: string;
  onChanged: () => void;
}) {
  const [size, setSize] = useState(variant?.size ?? "");
  const [color, setColor] = useState(variant?.color ?? "");
  const [model, setModel] = useState(variant?.model ?? "");
  const [sku, setSku] = useState(variant?.sku ?? "");
  const [price, setPrice] = useState(variant?.price_override?.toString() ?? "");
  const [stock, setStock] = useState(variant?.stock_quantity?.toString() ?? "0");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const res = await saveVariant({
        id: variant?.id,
        productId,
        size: size || null,
        color: color || null,
        model: model || null,
        sku: sku || null,
        priceOverride: price ? parseFloat(price) : null,
        stockQuantity: parseInt(stock, 10) || 0,
        active: variant?.active ?? true,
      });
      if (res.ok) {
        if (!variant) {
          setSize(""); setColor(""); setModel(""); setSku(""); setPrice(""); setStock("0");
        }
        onChanged();
      } else setError(res.message);
    });
  }

  function handleDelete() {
    if (!variant) return;
    if (!confirm("Excluir esta variação?")) return;
    startTransition(async () => {
      const res = await deleteVariant(variant.id);
      if (res.ok) onChanged();
      else setError(res.message);
    });
  }

  const cellCls =
    "bg-surface-2 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-primary/40 min-w-0";

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[1fr_1fr_1fr_1fr_80px_64px_auto] gap-1.5 items-center">
        <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="Tamanho" className={cellCls} />
        <input value={color} onChange={(e) => setColor(e.target.value)} placeholder="Cor" className={cellCls} />
        <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Modelo" className={cellCls} />
        <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="SKU" className={`${cellCls} font-mono`} />
        <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="R$ dif." type="number" min="0" step="0.01" className={`${cellCls} text-right`} />
        <input value={stock} onChange={(e) => setStock(e.target.value)} type="number" min="0" className={`${cellCls} text-right tabular-nums`} />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors disabled:opacity-40 ${
              variant ? "bg-surface-2 text-zinc-300 hover:text-white border border-white/10" : "bg-primary text-black"
            }`}
          >
            {pending ? "..." : variant ? "Salvar" : "Adicionar"}
          </button>
          {variant && (
            <button type="button" onClick={handleDelete} disabled={pending} title="Excluir variação"
              className="p-1.5 text-zinc-600 hover:text-danger transition-colors disabled:opacity-40">
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      {error && <p className="text-[10px] text-danger">{error}</p>}
    </div>
  );
}

function ProductModal({
  product,
  categories,
  onClose,
}: {
  product: StoreProduct | null;
  categories: StoreCategory[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(product?.title ?? "");
  const [brand, setBrand] = useState(product?.brand ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [basePrice, setBasePrice] = useState(product?.base_price?.toString() ?? "");
  const [categoryId, setCategoryId] = useState(product?.category_id ?? "");
  const [active, setActive] = useState(product?.active ?? true);
  const [mediaUrls, setMediaUrls] = useState<string[]>(product?.media_urls ?? []);
  const [savedId, setSavedId] = useState<string | null>(product?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    e.target.value = "";
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    for (const file of Array.from(files).slice(0, 6)) {
      const fd = new FormData();
      fd.set("image", file);
      const res = await uploadProductImage(fd);
      if (res.ok) setMediaUrls((prev) => [...prev, res.url]);
      else setError(res.message);
    }
    setUploading(false);
  }

  function handleSave() {
    setError(null);
    const price = parseFloat(basePrice);
    startTransition(async () => {
      const res = await saveProduct({
        id: savedId ?? undefined,
        title,
        description: description || null,
        brand: brand || null,
        basePrice: Number.isFinite(price) ? price : -1,
        categoryId: categoryId || null,
        mediaUrls,
        active,
      });
      if (res.ok) {
        setSavedId(res.productId ?? null);
        router.refresh();
      } else setError(res.message);
    });
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      {/* Bottom sheet on small screens, centered dialog from sm: up */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="w-full sm:max-w-2xl max-h-[94vh] sm:max-h-[90vh] bg-surface-1 border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 sm:py-5 border-b border-white/5 shrink-0">
            <div className="min-w-0">
              <h3 className="font-bold text-white truncate">
                {savedId ? "Editar Produto" : "Novo Produto"}
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5 truncate">
                {savedId ? "Ajuste dados, fotos e variações." : "Salve o produto para liberar as variações."}
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl text-zinc-500 hover:bg-surface-2 hover:text-white transition-colors shrink-0 min-h-11 min-w-11 flex items-center justify-center">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="px-4 sm:px-6 py-5 sm:py-6 space-y-5 overflow-y-auto overscroll-contain flex-1 min-w-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={labelCls}>Título *</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Camiseta Dry-Fit CM" className={inputCls} maxLength={140} />
              </div>
              <div>
                <label className={labelCls}>Marca</label>
                <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Ex: Growth, Max Titanium" className={inputCls} maxLength={80} />
              </div>
              <div>
                <label className={labelCls}>Preço base (R$) *</label>
                <input value={basePrice} onChange={(e) => setBasePrice(e.target.value)} type="number" min="0" step="0.01" placeholder="99,90" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Categoria</label>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
                  <option value="">Sem categoria</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                  <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)}
                    className="w-4 h-4 rounded accent-primary" />
                  Produto ativo na loja
                </label>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Descrição</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                  placeholder="Detalhes, composição, indicações de uso..." className={`${inputCls} resize-none`} />
              </div>
            </div>

            {/* Photos — uniform responsive grid, no misaligned wrap on phones */}
            <div>
              <label className={labelCls}>Fotos do produto</label>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {mediaUrls.map((url, idx) => (
                  <div key={url} className="relative aspect-square rounded-xl overflow-hidden border border-white/10 group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Foto ${idx + 1}`} className="absolute inset-0 w-full h-full object-cover" />
                    <button type="button" onClick={() => setMediaUrls((prev) => prev.filter((u) => u !== url))}
                      aria-label="Remover foto"
                      className="absolute top-1 right-1 p-1 rounded-lg bg-black/70 text-zinc-300 hover:text-danger sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <TrashIcon className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="aspect-square rounded-xl border border-dashed border-white/15 flex flex-col items-center justify-center gap-1 text-zinc-600 hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-40">
                  <PhotoIcon className="w-5 h-5" />
                  <span className="text-[9px] font-semibold">{uploading ? "Enviando..." : "Adicionar"}</span>
                </button>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handleUpload} />
              </div>
            </div>

            {/* Variants — horizontal scroll keeps the grid intact on phones */}
            {savedId ? (
              <div className="space-y-2">
                <label className={labelCls}>Variações & Estoque</label>
                <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 pb-1">
                  <div className="min-w-140 space-y-2">
                    <div className="grid grid-cols-[1fr_1fr_1fr_1fr_80px_64px_auto] gap-1.5 text-[9px] text-zinc-600 uppercase tracking-wide px-0.5">
                      <span>Tamanho</span><span>Cor</span><span>Modelo</span><span>SKU</span>
                      <span className="text-right">Preço dif.</span><span className="text-right">Estoque</span><span />
                    </div>
                    {(product?.product_variants ?? []).map((v) => (
                      <VariantRow key={v.id} variant={v} productId={savedId} onChanged={() => router.refresh()} />
                    ))}
                    <VariantRow variant={null} productId={savedId} onChanged={() => router.refresh()} />
                  </div>
                </div>
                <p className="text-[10px] text-zinc-600 sm:hidden">
                  Arraste para o lado para ver todos os campos.
                </p>
              </div>
            ) : (
              <p className="text-xs text-zinc-600 bg-surface-2/50 border border-white/5 rounded-xl px-4 py-3">
                Salve o produto primeiro — depois cadastre tamanhos, cores e estoque aqui.
              </p>
            )}

            {error && <p className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-2xl px-4 py-3">{error}</p>}

            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="flex-1 py-3 rounded-full text-sm font-semibold bg-surface-2 text-zinc-400 hover:text-white border border-white/5 transition-colors">
                Fechar
              </button>
              <button type="button" onClick={handleSave} disabled={pending || uploading}
                className="flex-1 py-3 rounded-full text-sm font-bold bg-primary text-black disabled:opacity-40 hover:scale-[1.02] active:scale-[0.98] transition-transform">
                {pending ? "Salvando..." : savedId ? "Salvar Alterações" : "Criar Produto"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Coupon modal ──────────────────────────────────────────────────────────────

function CouponModal({ coupon, onClose }: { coupon: StoreCoupon | null; onClose: () => void }) {
  const router = useRouter();
  const [code, setCode] = useState(coupon?.code ?? "");
  const [type, setType] = useState<"percentage" | "fixed">(coupon?.discount_type ?? "percentage");
  const [value, setValue] = useState(coupon?.discount_value?.toString() ?? "");
  const [minOrder, setMinOrder] = useState(coupon?.min_order_amount?.toString() ?? "0");
  const [maxUses, setMaxUses] = useState(coupon?.max_uses?.toString() ?? "");
  // datetime-local wants "YYYY-MM-DDTHH:mm" in the browser's local timezone
  const [expiresAt, setExpiresAt] = useState(() => {
    if (!coupon?.expires_at) return "";
    const d = new Date(coupon.expires_at);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [active, setActive] = useState(coupon?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const res = await saveCoupon({
        id: coupon?.id,
        code,
        discountType: type,
        discountValue: parseFloat(value) || 0,
        minOrderAmount: parseFloat(minOrder) || 0,
        maxUses: maxUses ? parseInt(maxUses, 10) : null,
        // datetime-local is timezone-naive → toISOString converts local → UTC
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        active,
      });
      if (res.ok) { router.refresh(); onClose(); }
      else setError(res.message);
    });
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-surface-1 border border-white/10 rounded-3xl shadow-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white">{coupon ? "Editar Cupom" : "Novo Cupom"}</h3>
            <button onClick={onClose} className="p-2 rounded-xl text-zinc-500 hover:text-white transition-colors">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Código *</label>
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="PROMO10"
                className={`${inputCls} font-mono uppercase tracking-widest`} maxLength={30} />
            </div>
            <div>
              <label className={labelCls}>Tipo</label>
              <select value={type} onChange={(e) => setType(e.target.value as "percentage" | "fixed")} className={inputCls}>
                <option value="percentage">Percentual (%)</option>
                <option value="fixed">Valor fixo (R$)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>{type === "percentage" ? "Desconto (%)" : "Desconto (R$)"} *</label>
              <input value={value} onChange={(e) => setValue(e.target.value)} type="number" min="0" step="0.01" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Pedido mínimo (R$)</label>
              <input value={minOrder} onChange={(e) => setMinOrder(e.target.value)} type="number" min="0" step="0.01" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Limite de usos</label>
              <input value={maxUses} onChange={(e) => setMaxUses(e.target.value)} type="number" min="1" placeholder="Ilimitado" className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Validade (data e hora exatas)</label>
              <input value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} type="datetime-local" className={inputCls} />
              <p className="text-[10px] text-zinc-600 mt-1">
                Perfeito para cupons relâmpago — o desconto expira no minuto marcado.
              </p>
            </div>
            <label className="col-span-2 flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-4 h-4 rounded accent-primary" />
              Cupom ativo
            </label>
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <button type="button" onClick={handleSave} disabled={pending}
            className="w-full py-3 rounded-full text-sm font-bold bg-primary text-black disabled:opacity-40 hover:scale-[1.02] active:scale-[0.98] transition-transform">
            {pending ? "Salvando..." : "Salvar Cupom"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Main client ───────────────────────────────────────────────────────────────

type Tab = "products" | "categories" | "coupons";

export function StoreClient({ initialData }: { initialData: StoreDashboardData }) {
  const router = useRouter();
  const { categories, products, coupons } = initialData;
  const [tab, setTab] = useState<Tab>("products");
  const [editingProduct, setEditingProduct] = useState<StoreProduct | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<StoreCoupon | null>(null);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [catError, setCatError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const categoryName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? null;

  function handleAddCategory() {
    setCatError(null);
    startTransition(async () => {
      const res = await saveCategory({ name: newCategory });
      if (res.ok) { setNewCategory(""); router.refresh(); }
      else setCatError(res.message);
    });
  }

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "products", label: `Produtos (${products.length})`, icon: <ArchiveBoxIcon className="w-4 h-4" /> },
    { id: "categories", label: `Categorias (${categories.length})`, icon: <TagIcon className="w-4 h-4" /> },
    { id: "coupons", label: `Cupons (${coupons.length})`, icon: <TicketIcon className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
        {TABS.map(({ id, label, icon }) => (
          <button key={id} type="button" onClick={() => setTab(id)}
            className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors ${
              tab === id ? "bg-primary text-black" : "bg-surface-1 border border-white/8 text-zinc-500 hover:text-zinc-300"
            }`}>
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Products */}
      {tab === "products" && (
        <div className="space-y-4">
          <button type="button" onClick={() => { setEditingProduct(null); setShowProductModal(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold bg-primary text-black hover:scale-105 active:scale-95 transition-transform">
            <PlusIcon className="w-4 h-4" />
            Novo Produto
          </button>

          {products.length === 0 ? (
            <div className="p-12 text-center bg-surface-1 border border-dashed border-white/10 rounded-3xl">
              <ArchiveBoxIcon className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm font-semibold text-zinc-500">Nenhum produto cadastrado</p>
              <p className="text-xs text-zinc-600 mt-1">Crie o primeiro produto da sua loja.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {products.map((p) => {
                const stock = totalStock(p);
                return (
                  <button key={p.id} type="button"
                    onClick={() => { setEditingProduct(p); setShowProductModal(true); }}
                    className="text-left bg-surface-1 border border-white/5 rounded-2xl overflow-hidden hover:border-primary/25 transition-colors group">
                    <div className="relative aspect-video bg-surface-2">
                      {p.media_urls[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.media_urls[0]} alt={p.title} className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <PhotoIcon className="w-8 h-8 text-zinc-700" />
                        </div>
                      )}
                      {!p.active && (
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/70 text-zinc-400">
                          Inativo
                        </span>
                      )}
                      <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-sm ${
                        stock === 0 ? "bg-danger/20 text-danger" : "bg-black/60 text-primary"
                      }`}>
                        {stock === 0 ? "Sem estoque" : `${stock} un.`}
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-bold text-white truncate">{p.title}</p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-zinc-500 truncate">
                          {categoryName(p.category_id) ?? p.brand ?? "—"} · {p.product_variants.length} var.
                        </p>
                        <p className="text-sm font-black text-primary tabular-nums">{fmt(p.base_price)}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Categories */}
      {tab === "categories" && (
        <div className="max-w-lg space-y-3">
          <div className="flex gap-2">
            <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
              placeholder="Nova categoria (Ex: Suplementos, Feminino...)" className={inputCls} maxLength={80} />
            <button type="button" onClick={handleAddCategory} disabled={pending || newCategory.trim().length < 2}
              className="shrink-0 px-4 rounded-xl bg-primary text-black text-sm font-bold disabled:opacity-40">
              Adicionar
            </button>
          </div>
          {catError && <p className="text-xs text-danger">{catError}</p>}

          <div className="bg-surface-1 border border-white/5 rounded-2xl divide-y divide-white/5 overflow-hidden">
            {categories.length === 0 && (
              <p className="px-4 py-6 text-sm text-zinc-600 text-center">Nenhuma categoria ainda.</p>
            )}
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-semibold text-zinc-200">{c.name}</span>
                <button type="button" title="Excluir categoria"
                  onClick={() => {
                    if (!confirm(`Excluir a categoria "${c.name}"? Os produtos ficam sem categoria.`)) return;
                    startTransition(async () => {
                      const res = await deleteCategory(c.id);
                      if (res.ok) router.refresh();
                    });
                  }}
                  className="p-2 text-zinc-600 hover:text-danger transition-colors">
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Coupons */}
      {tab === "coupons" && (
        <div className="space-y-4">
          <button type="button" onClick={() => { setEditingCoupon(null); setShowCouponModal(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold bg-primary text-black hover:scale-105 active:scale-95 transition-transform">
            <PlusIcon className="w-4 h-4" />
            Novo Cupom
          </button>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {coupons.map((c) => (
              <div key={c.id} className={`bg-surface-1 border rounded-2xl p-4 ${c.active ? "border-white/8" : "border-white/5 opacity-60"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono font-black text-primary tracking-widest">{c.code}</p>
                    <p className="text-xs text-zinc-400 mt-1">
                      {c.discount_type === "percentage" ? `${c.discount_value}% de desconto` : `${fmt(c.discount_value)} de desconto`}
                    </p>
                    <p className="text-[10px] text-zinc-600 mt-1">
                      {c.used_count}{c.max_uses ? `/${c.max_uses}` : ""} usos
                      {c.min_order_amount > 0 && ` · mín. ${fmt(c.min_order_amount)}`}
                      {c.expires_at &&
                        ` · até ${new Date(c.expires_at).toLocaleString("pt-BR", {
                          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                        })}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => { setEditingCoupon(c); setShowCouponModal(true); }}
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-surface-2 text-zinc-300 border border-white/10 hover:text-white">
                      Editar
                    </button>
                    <button type="button" title="Excluir cupom"
                      onClick={() => {
                        if (!confirm(`Excluir o cupom ${c.code}?`)) return;
                        startTransition(async () => {
                          const res = await deleteCoupon(c.id);
                          if (res.ok) router.refresh();
                        });
                      }}
                      className="p-1.5 text-zinc-600 hover:text-danger transition-colors">
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {coupons.length === 0 && (
              <p className="text-sm text-zinc-600 col-span-full py-6 text-center">Nenhum cupom criado.</p>
            )}
          </div>
        </div>
      )}

      {showProductModal && (
        <ProductModal
          product={editingProduct}
          categories={categories}
          onClose={() => { setShowProductModal(false); setEditingProduct(null); }}
        />
      )}
      {showCouponModal && (
        <CouponModal coupon={editingCoupon} onClose={() => { setShowCouponModal(false); setEditingCoupon(null); }} />
      )}
    </div>
  );
}
