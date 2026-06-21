"use client";

import { useState, useTransition, useCallback, useRef } from "react";
import {
  ShoppingCartIcon,
  TagIcon,
  TicketIcon,
  CreditCardIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XMarkIcon,
  ArrowPathIcon,
  ClipboardDocumentIcon,
  NoSymbolIcon,
} from "@heroicons/react/24/outline";
import {
  getCoupons,
  createCoupon,
  toggleCoupon,
  searchStudents,
  validateCoupon,
  processManualSale,
  type Coupon,
  type StudentOption,
  type CouponValidation,
} from "./actions";
import { createPlan, type GymPlan } from "@/app/dashboard/finance/subscription-actions";
import type { DailyPassRow } from "./page";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function fmtDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Intl.DateTimeFormat("pt-BR").format(
    new Date(dateStr.includes("T") ? dateStr : dateStr + "T12:00:00")
  );
}

const CYCLE_LABELS: Record<string, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  yearly: "Anual",
};

const PASS_STATUS_STYLES: Record<string, string> = {
  available: "bg-primary/10 text-primary border-primary/20",
  used: "bg-zinc-700/30 text-zinc-400 border-zinc-700/50",
  expired: "bg-zinc-900/30 text-zinc-600 border-zinc-800",
};

const PASS_STATUS_LABELS: Record<string, string> = {
  available: "Disponível",
  used: "Utilizado",
  expired: "Expirado",
};

type Tab = "plans" | "balcao" | "coupons" | "passes";

type Props = {
  initialPlans: GymPlan[];
  initialCoupons: Coupon[];
  initialPasses: DailyPassRow[];
};

// ── Root component ─────────────────────────────────────────────────────────────

export function PlansClient({ initialPlans, initialCoupons, initialPasses }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("plans");
  const [plans, setPlans] = useState(initialPlans);
  const [coupons, setCoupons] = useState(initialCoupons);
  const [passes] = useState(initialPasses);

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "plans",   label: "Planos",   icon: CreditCardIcon   },
    { id: "balcao",  label: "Balcão",   icon: ShoppingCartIcon },
    { id: "coupons", label: "Cupons",   icon: TagIcon          },
    { id: "passes",  label: "Passes",   icon: TicketIcon       },
  ];

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-surface-1 border border-white/5 rounded-2xl w-fit">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === id
                ? "bg-primary text-black shadow-sm"
                : "text-zinc-500 hover:text-white"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "plans"   && <PlansTab   plans={plans}   onPlansChange={setPlans} />}
      {activeTab === "balcao"  && <BalcaoTab  plans={plans}   coupons={coupons} />}
      {activeTab === "coupons" && <CouponsTab coupons={coupons} onCouponsChange={setCoupons} />}
      {activeTab === "passes"  && <PassesTab  passes={passes} />}
    </div>
  );
}

// ── Plans tab ─────────────────────────────────────────────────────────────────

function PlansTab({
  plans,
  onPlansChange,
}: {
  plans: GymPlan[];
  onPlansChange: (p: GymPlan[]) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = (fd.get("name") as string).trim();
    const price = parseFloat((fd.get("price") as string).replace(",", "."));
    const billing_cycle = fd.get("billing_cycle") as "monthly" | "quarterly" | "yearly";

    if (!name || isNaN(price) || price <= 0) {
      setError("Preencha todos os campos corretamente.");
      return;
    }

    startTransition(async () => {
      const res = await createPlan({ name, price, billing_cycle });
      if (res.ok) {
        // Optimistic: re-fetch would normally happen via revalidatePath;
        // for instant feel add optimistically
        onPlansChange([
          ...plans,
          {
            id: crypto.randomUUID(),
            name,
            price,
            billing_cycle,
            active: true,
          } as GymPlan,
        ]);
        setShowForm(false);
        setError(null);
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{plans.length} plano{plans.length !== 1 ? "s" : ""} cadastrado{plans.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-black text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Novo Plano
        </button>
      </div>

      {/* Inline create form */}
      {showForm && (
        <div className="bg-surface-1 border border-white/8 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Novo Plano de Assinatura</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <input
              name="name"
              required
              placeholder="Nome do plano"
              className="bg-surface-2 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-primary/50"
            />
            <input
              name="price"
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="Valor (R$)"
              className="bg-surface-2 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-primary/50"
            />
            <select
              name="billing_cycle"
              defaultValue="monthly"
              className="bg-surface-2 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-primary/50"
            >
              <option value="monthly">Mensal</option>
              <option value="quarterly">Trimestral</option>
              <option value="yearly">Anual</option>
            </select>
            {error && <p className="sm:col-span-3 text-xs text-danger">{error}</p>}
            <div className="sm:col-span-3 flex gap-3">
              <button
                type="submit"
                disabled={isPending}
                className="px-5 py-2.5 rounded-xl bg-primary text-black text-sm font-semibold disabled:opacity-50"
              >
                {isPending ? "Salvando..." : "Criar Plano"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 rounded-xl bg-surface-2 text-zinc-400 text-sm font-semibold hover:text-white"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Plans table */}
      <div className="bg-surface-1 border border-white/5 rounded-2xl overflow-hidden">
        {plans.length === 0 ? (
          <div className="p-12 text-center">
            <CreditCardIcon className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
            <p className="text-sm text-zinc-500">Nenhum plano cadastrado ainda.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Nome</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Ciclo</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Valor</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">MRR equiv.</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {plans.map((plan) => {
                const mrrEquiv =
                  plan.billing_cycle === "monthly" ? plan.price
                  : plan.billing_cycle === "quarterly" ? plan.price / 3
                  : plan.price / 12;
                return (
                  <tr key={plan.id} className="hover:bg-surface-2/50 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-zinc-200">{plan.name}</td>
                    <td className="px-4 py-3.5 text-xs text-zinc-500">{CYCLE_LABELS[plan.billing_cycle]}</td>
                    <td className="px-4 py-3.5 text-right font-semibold text-primary tabular-nums">{fmt(plan.price)}</td>
                    <td className="px-5 py-3.5 text-right text-xs text-zinc-500 tabular-nums">{fmt(mrrEquiv)}/mês</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${plan.active ? "bg-primary/10 text-primary border-primary/20" : "bg-zinc-700/30 text-zinc-500 border-zinc-700/50"}`}>
                        {plan.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Balcão (POS) tab ──────────────────────────────────────────────────────────

function BalcaoTab({ plans, coupons }: { plans: GymPlan[]; coupons: Coupon[] }) {
  const [step, setStep] = useState<"idle" | "form" | "success">("idle");
  const [result, setResult] = useState<{ message: string; stripe_url?: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [student, setStudent] = useState<StudentOption | null>(null);
  const [productType, setProductType] = useState<"plan" | "daily_pass">("plan");
  const [selectedPlan, setSelectedPlan] = useState<GymPlan | null>(null);
  const [passQty, setPassQty] = useState(1);
  const [couponCode, setCouponCode] = useState("");
  const [couponResult, setCouponResult] = useState<CouponValidation | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash_pix" | "stripe">("cash_pix");
  const [copiedUrl, setCopiedUrl] = useState(false);

  const baseAmount = productType === "plan"
    ? (selectedPlan?.price ?? 0)
    : passQty * 20; // default pass price — in real usage, fetch from config

  const finalAmount = couponResult?.valid
    ? couponResult.final_amount
    : baseAmount;

  const discount = couponResult?.valid
    ? couponResult.discount_percentage
    : 0;

  async function handleApplyCoupon() {
    if (!couponCode) return;
    setCheckingCoupon(true);
    const res = await validateCoupon(couponCode, baseAmount);
    setCouponResult(res);
    setCheckingCoupon(false);
  }

  function handleSubmit() {
    if (!student) { setError("Selecione um aluno."); return; }
    if (productType === "plan" && !selectedPlan) { setError("Selecione um plano."); return; }
    setError(null);

    startTransition(async () => {
      const res = await processManualSale({
        student_id: student.id,
        product_type: productType,
        plan_id: selectedPlan?.id,
        daily_pass_quantity: passQty,
        coupon_code: couponCode || undefined,
        payment_method: paymentMethod,
        base_amount: baseAmount,
      });

      if (res.ok) {
        setResult({ message: res.message, stripe_url: res.stripe_url });
        setStep("success");
      } else {
        setError(res.message);
      }
    });
  }

  function reset() {
    setStep("idle");
    setStudent(null);
    setProductType("plan");
    setSelectedPlan(null);
    setPassQty(1);
    setCouponCode("");
    setCouponResult(null);
    setPaymentMethod("cash_pix");
    setResult(null);
    setError(null);
  }

  if (step === "success" && result) {
    return (
      <div className="flex flex-col items-center gap-5 py-10 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
          <CheckCircleIcon className="w-8 h-8 text-primary" />
        </div>
        <div>
          <p className="text-lg font-bold text-white">{result.message}</p>
          {result.stripe_url && (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-zinc-400">Compartilhe o link de pagamento com o aluno:</p>
              <div className="flex items-center gap-2 bg-surface-1 border border-white/8 rounded-xl px-4 py-3">
                <p className="text-xs font-mono text-zinc-400 flex-1 truncate">{result.stripe_url}</p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(result.stripe_url!);
                    setCopiedUrl(true);
                    setTimeout(() => setCopiedUrl(false), 2000);
                  }}
                  className="flex-shrink-0 p-1.5 rounded-lg bg-surface-2 text-zinc-400 hover:text-white transition-colors"
                >
                  {copiedUrl ? <CheckCircleIcon className="w-4 h-4 text-primary" /> : <ClipboardDocumentIcon className="w-4 h-4" />}
                </button>
              </div>
              <a
                href={result.stripe_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-5 py-2.5 rounded-xl bg-primary text-black text-sm font-semibold"
              >
                Abrir Link
              </a>
            </div>
          )}
        </div>
        <button onClick={reset} className="px-5 py-2.5 rounded-xl bg-surface-2 text-zinc-400 text-sm font-semibold hover:text-white transition-colors">
          Nova Venda
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-xl">
      <div className="bg-surface-1 border border-white/5 rounded-2xl p-5 space-y-5">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <ShoppingCartIcon className="w-4 h-4 text-primary" />
          O Balcão — Venda Manual
        </h3>

        {/* 1. Student selector */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">1. Aluno</label>
          {student ? (
            <div className="flex items-center justify-between bg-surface-2 border border-white/8 rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-white">{student.full_name}</p>
                <p className="text-xs text-zinc-500">{student.email}</p>
              </div>
              <button onClick={() => setStudent(null)} className="p-1.5 rounded-lg text-zinc-500 hover:text-white">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <StudentSearch onSelect={setStudent} />
          )}
        </div>

        {/* 2. Product */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">2. Produto</label>
          <div className="flex gap-2">
            <button
              onClick={() => setProductType("plan")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${productType === "plan" ? "bg-primary/10 border-primary/30 text-primary" : "bg-surface-2 border-white/8 text-zinc-400 hover:text-white"}`}
            >
              Assinatura
            </button>
            <button
              onClick={() => setProductType("daily_pass")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${productType === "daily_pass" ? "bg-primary/10 border-primary/30 text-primary" : "bg-surface-2 border-white/8 text-zinc-400 hover:text-white"}`}
            >
              Passe Avulso
            </button>
          </div>

          {productType === "plan" && (
            <div className="grid grid-cols-1 gap-2">
              {plans.filter((p) => p.active).map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlan(p)}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-all ${selectedPlan?.id === p.id ? "bg-primary/10 border-primary/30" : "bg-surface-2 border-white/5 hover:border-white/10"}`}
                >
                  <span className="font-semibold text-zinc-200">{p.name} <span className="text-zinc-500 font-normal">({CYCLE_LABELS[p.billing_cycle]})</span></span>
                  <span className={`font-bold tabular-nums ${selectedPlan?.id === p.id ? "text-primary" : "text-zinc-400"}`}>{fmt(p.price)}</span>
                </button>
              ))}
            </div>
          )}

          {productType === "daily_pass" && (
            <div className="flex items-center gap-4">
              <label className="text-sm text-zinc-400">Quantidade de passes:</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPassQty(Math.max(1, passQty - 1))}
                  className="w-8 h-8 rounded-lg bg-surface-2 text-zinc-400 hover:text-white font-bold flex items-center justify-center"
                >−</button>
                <span className="text-base font-bold text-white w-8 text-center tabular-nums">{passQty}</span>
                <button
                  onClick={() => setPassQty(Math.min(30, passQty + 1))}
                  className="w-8 h-8 rounded-lg bg-surface-2 text-zinc-400 hover:text-white font-bold flex items-center justify-center"
                >+</button>
              </div>
            </div>
          )}
        </div>

        {/* 3. Coupon */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">3. Cupom (opcional)</label>
          <div className="flex gap-2">
            <input
              value={couponCode}
              onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponResult(null); }}
              placeholder="CÓDIGO"
              className="flex-1 bg-surface-2 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-primary/50 font-mono tracking-wider uppercase"
            />
            <button
              onClick={handleApplyCoupon}
              disabled={!couponCode || checkingCoupon}
              className="px-4 py-2.5 rounded-xl bg-surface-2 border border-white/8 text-sm text-zinc-400 hover:text-white transition-colors disabled:opacity-40"
            >
              {checkingCoupon ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : "Aplicar"}
            </button>
          </div>
          {couponResult && (
            <p className={`text-xs font-medium ${couponResult.valid ? "text-primary" : "text-danger"}`}>
              {couponResult.valid
                ? `✓ ${couponResult.discount_percentage}% de desconto aplicado → ${fmt(couponResult.final_amount)}`
                : `✗ ${couponResult.message}`}
            </p>
          )}
        </div>

        {/* 4. Payment method */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">4. Forma de Pagamento</label>
          <div className="flex gap-2">
            <button
              onClick={() => setPaymentMethod("cash_pix")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${paymentMethod === "cash_pix" ? "bg-primary/10 border-primary/30 text-primary" : "bg-surface-2 border-white/8 text-zinc-400 hover:text-white"}`}
            >
              💵 Dinheiro / Pix
            </button>
            <button
              onClick={() => setPaymentMethod("stripe")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${paymentMethod === "stripe" ? "bg-primary/10 border-primary/30 text-primary" : "bg-surface-2 border-white/8 text-zinc-400 hover:text-white"}`}
            >
              💳 Stripe / Link
            </button>
          </div>
        </div>

        {/* Summary & submit */}
        <div className="border-t border-white/5 pt-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-500">Subtotal</span>
            <span className="text-zinc-300 tabular-nums">{fmt(baseAmount)}</span>
          </div>
          {discount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Desconto ({discount}%)</span>
              <span className="text-danger tabular-nums">−{fmt(baseAmount - finalAmount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between font-bold">
            <span className="text-white">Total</span>
            <span className="text-primary text-lg tabular-nums">{fmt(finalAmount)}</span>
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={isPending || !student || (productType === "plan" && !selectedPlan)}
            className="w-full py-3 rounded-xl bg-primary text-black font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPending
              ? "Processando..."
              : paymentMethod === "cash_pix"
              ? "Confirmar Venda"
              : "Gerar Link Stripe"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Student search sub-component ──────────────────────────────────────────────

function StudentSearch({ onSelect }: { onSelect: (s: StudentOption) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudentOption[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 2) { setResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const res = await searchStudents(value);
      setResults(res);
      setSearching(false);
    }, 300);
  }, []);

  return (
    <div className="relative">
      <div className="flex items-center bg-surface-2 border border-white/8 rounded-xl px-3 py-2.5 gap-2">
        <MagnifyingGlassIcon className="w-4 h-4 text-zinc-500 flex-shrink-0" />
        <input
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Buscar aluno por nome ou email..."
          className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 outline-none"
        />
        {searching && <ArrowPathIcon className="w-3.5 h-3.5 text-zinc-500 animate-spin" />}
      </div>

      {results.length > 0 && (
        <ul className="absolute top-full left-0 right-0 mt-1 bg-surface-1 border border-white/8 rounded-xl overflow-hidden z-20 shadow-2xl">
          {results.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => { onSelect(s); setResults([]); setQuery(""); }}
                className="w-full text-left px-4 py-3 hover:bg-surface-2 transition-colors"
              >
                <p className="text-sm font-semibold text-zinc-200">{s.full_name}</p>
                <p className="text-xs text-zinc-500">{s.email}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Coupons tab ───────────────────────────────────────────────────────────────

function CouponsTab({
  coupons,
  onCouponsChange,
}: {
  coupons: Coupon[];
  onCouponsChange: (c: Coupon[]) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unlimited, setUnlimited] = useState(true);

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const code = (fd.get("code") as string).trim().toUpperCase();
    const discount_percentage = parseInt(fd.get("discount_percentage") as string, 10);
    const max_uses_raw = fd.get("max_uses") as string;
    const max_uses = unlimited ? null : parseInt(max_uses_raw, 10) || null;
    const expires_raw = fd.get("expires_at") as string;
    const expires_at = expires_raw ? new Date(expires_raw).toISOString() : null;

    if (!code || !discount_percentage) { setError("Preencha código e desconto."); return; }

    startTransition(async () => {
      const res = await createCoupon({ code, discount_percentage, max_uses, expires_at });
      if (res.ok) {
        // optimistic
        onCouponsChange([
          {
            id: crypto.randomUUID(),
            code,
            discount_percentage,
            max_uses,
            current_uses: 0,
            expires_at,
            active: true,
          } as Coupon,
          ...coupons,
        ]);
        setShowForm(false);
        setError(null);
      } else {
        setError(res.message);
      }
    });
  }

  function handleToggle(coupon: Coupon) {
    setTogglingId(coupon.id);
    startTransition(async () => {
      const res = await toggleCoupon(coupon.id, !coupon.active);
      if (res.ok) {
        onCouponsChange(
          coupons.map((c) => c.id === coupon.id ? { ...c, active: !c.active } : c)
        );
      }
      setTogglingId(null);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{coupons.length} cupom{coupons.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-black text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Novo Cupom
        </button>
      </div>

      {showForm && (
        <div className="bg-surface-1 border border-white/8 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Criar Código de Desconto</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Código</label>
                <input
                  name="code"
                  required
                  placeholder="EX: PROMO50"
                  className="w-full bg-surface-2 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-primary/50 font-mono uppercase tracking-widest"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Desconto (%)</label>
                <input
                  name="discount_percentage"
                  type="number"
                  min="1"
                  max="100"
                  required
                  placeholder="Ex: 20"
                  className="w-full bg-surface-2 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-primary/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                  Limite de usos
                </label>
                <div className="flex items-center gap-3 mb-2">
                  <button
                    type="button"
                    onClick={() => setUnlimited(!unlimited)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${unlimited ? "bg-primary" : "bg-zinc-700"}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${unlimited ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                  <span className="text-xs text-zinc-400">{unlimited ? "Ilimitado" : "Definir limite"}</span>
                </div>
                {!unlimited && (
                  <input
                    name="max_uses"
                    type="number"
                    min="1"
                    placeholder="Ex: 50"
                    className="w-full bg-surface-2 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-primary/50"
                  />
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Validade (opcional)</label>
                <input
                  name="expires_at"
                  type="date"
                  className="w-full bg-surface-2 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-primary/50"
                />
              </div>
            </div>

            {error && <p className="text-xs text-danger">{error}</p>}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isPending}
                className="px-5 py-2.5 rounded-xl bg-primary text-black text-sm font-semibold disabled:opacity-50"
              >
                {isPending ? "Criando..." : "Criar Cupom"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 rounded-xl bg-surface-2 text-zinc-400 text-sm font-semibold hover:text-white"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Coupons table */}
      <div className="bg-surface-1 border border-white/5 rounded-2xl overflow-hidden">
        {coupons.length === 0 ? (
          <div className="p-12 text-center">
            <TagIcon className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
            <p className="text-sm text-zinc-500">Nenhum cupom criado ainda.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Código</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Desconto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden sm:table-cell">Usos</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden md:table-cell">Validade</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                <th className="text-right px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {coupons.map((coupon) => {
                const isToggling = togglingId === coupon.id;
                const expired = coupon.expires_at ? new Date(coupon.expires_at) < new Date() : false;
                const exhausted = coupon.max_uses !== null && coupon.current_uses >= coupon.max_uses;
                const effectivelyActive = coupon.active && !expired && !exhausted;

                return (
                  <tr key={coupon.id} className="hover:bg-surface-2/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="font-mono font-semibold text-zinc-200 tracking-wider">{coupon.code}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-bold text-primary">{coupon.discount_percentage}%</span>
                      {coupon.discount_percentage === 100 && (
                        <span className="ml-2 text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-full">Grátis</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 hidden sm:table-cell">
                      <span className="text-xs text-zinc-400 tabular-nums">
                        {coupon.current_uses}
                        {coupon.max_uses !== null ? ` / ${coupon.max_uses}` : " / ∞"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <span className={`text-xs tabular-nums ${expired ? "text-danger" : "text-zinc-400"}`}>
                        {coupon.expires_at ? fmtDate(coupon.expires_at) : "Nunca"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${effectivelyActive ? "bg-primary/10 text-primary border-primary/20" : "bg-zinc-700/30 text-zinc-500 border-zinc-700/50"}`}>
                        {effectivelyActive ? "Ativo" : expired ? "Expirado" : exhausted ? "Esgotado" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => handleToggle(coupon)}
                        disabled={isToggling}
                        title={coupon.active ? "Desativar" : "Ativar"}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-white transition-colors disabled:opacity-40"
                      >
                        {coupon.active
                          ? <NoSymbolIcon className="w-4 h-4" />
                          : <CheckCircleIcon className="w-4 h-4" />
                        }
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Passes tab ────────────────────────────────────────────────────────────────

function PassesTab({ passes }: { passes: DailyPassRow[] }) {
  const today = new Date().toISOString().split("T")[0];
  const availableCount = passes.filter((p) => p.status === "available").length;
  const usedTodayCount = passes.filter((p) => p.status === "used" && p.valid_for_date === today).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface-1 border border-white/5 rounded-2xl p-5">
          <p className="text-2xl font-bold text-white tabular-nums">{availableCount}</p>
          <p className="text-xs text-zinc-500 mt-1">Passes disponíveis</p>
        </div>
        <div className="bg-surface-1 border border-white/5 rounded-2xl p-5">
          <p className="text-2xl font-bold text-white tabular-nums">{usedTodayCount}</p>
          <p className="text-xs text-zinc-500 mt-1">Usados hoje</p>
        </div>
      </div>

      <div className="bg-surface-1 border border-white/5 rounded-2xl overflow-hidden">
        {passes.length === 0 ? (
          <div className="p-12 text-center">
            <TicketIcon className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
            <p className="text-sm text-zinc-500">Nenhum passe avulso registrado.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Aluno</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Data de Uso</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden sm:table-cell">Comprado em</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {passes.map((pass) => (
                <tr key={pass.id} className="hover:bg-surface-2/50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-zinc-300">{pass.student_name}</td>
                  <td className="px-4 py-3.5 text-xs text-zinc-400 tabular-nums">{fmtDate(pass.valid_for_date)}</td>
                  <td className="px-4 py-3.5 text-xs text-zinc-600 hidden sm:table-cell">{fmtDate(pass.purchased_at)}</td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${PASS_STATUS_STYLES[pass.status]}`}>
                      {PASS_STATUS_LABELS[pass.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
