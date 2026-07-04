"use client";

import { useState, useTransition } from "react";
import {
  CheckCircleIcon,
  XCircleIcon,
  CreditCardIcon,
  TicketIcon,
  CalendarDaysIcon,
  ArrowRightIcon,
  TagIcon,
  ArrowPathIcon,
  ShoppingCartIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { validateCoupon, processStudentCheckout } from "@/app/dashboard/finance/plans/actions";
import type { WalletData, PlanOption, CouponValidation } from "./actions";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function fmtDate(dateStr: string) {
  return new Intl.DateTimeFormat("pt-BR").format(
    new Date(dateStr + "T12:00:00")
  );
}

const CYCLE_LABELS: Record<string, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  yearly: "Anual",
};

const STATUS_STYLES: Record<string, string> = {
  active: "text-primary bg-primary/10 border-primary/20",
  past_due: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  canceled: "text-zinc-400 bg-zinc-700/30 border-zinc-700/40",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Ativo",
  past_due: "Em Atraso",
  canceled: "Cancelado",
};

const PASS_STATUS_STYLES: Record<string, string> = {
  available: "text-primary border-primary/20 bg-primary/5",
  used: "text-zinc-500 border-zinc-700/40 bg-zinc-800/30",
  expired: "text-zinc-600 border-zinc-800 bg-zinc-900/30",
};

const PASS_STATUS_LABELS: Record<string, string> = {
  available: "Disponível",
  used: "Utilizado",
  expired: "Expirado",
};

type Props = {
  wallet: WalletData;
  plans: PlanOption[];
};

// ── Root component ─────────────────────────────────────────────────────────────

export function WalletClient({ wallet, plans }: Props) {
  const { subscription, dailyPasses, hasAccess } = wallet;
  const today = new Date().toISOString().split("T")[0];
  const todayPass = dailyPasses.find(
    (p) => p.valid_for_date === today && p.status === "available"
  );

  const [showCheckout, setShowCheckout] = useState(false);

  return (
    <div className="flex flex-col gap-6 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Carteira</h1>
          <p className="text-sm text-zinc-500 mt-1">Sua assinatura, passes e pagamentos.</p>
        </div>
        <button
          onClick={() => setShowCheckout(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-black text-sm font-bold hover:bg-primary/90 transition-colors"
        >
          <ShoppingCartIcon className="w-4 h-4" />
          Comprar
        </button>
      </div>

      {/* Access badge */}
      <div
        className={`flex items-center gap-3 px-5 py-4 rounded-2xl border ${
          hasAccess
            ? "bg-primary/10 border-primary/25"
            : "bg-danger/10 border-danger/25"
        }`}
      >
        {hasAccess ? (
          <CheckCircleIcon className="w-6 h-6 text-primary shrink-0" />
        ) : (
          <XCircleIcon className="w-6 h-6 text-danger shrink-0" />
        )}
        <div>
          <p className={`text-sm font-bold uppercase tracking-widest ${hasAccess ? "text-primary" : "text-danger"}`}>
            {hasAccess ? "Acesso Liberado" : "Acesso Bloqueado"}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">
            {hasAccess
              ? subscription?.status === "active"
                ? `Plano ${CYCLE_LABELS[subscription.billing_cycle] ?? ""} ativo`
                : "Passe diário válido para hoje"
              : "Regularize sua situação ou compre um plano."}
          </p>
        </div>
      </div>

      {/* Subscription */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CreditCardIcon className="w-4 h-4 text-zinc-500" />
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Minha Assinatura</h2>
        </div>

        {subscription ? (
          <div className="bg-surface-1 border border-white/5 rounded-2xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-white">{subscription.plan_name}</p>
                <p className="text-sm text-zinc-500">
                  {CYCLE_LABELS[subscription.billing_cycle]} · {fmt(subscription.plan_price)}
                </p>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_STYLES[subscription.status]}`}>
                {STATUS_LABELS[subscription.status]}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-white/5">
              <div>
                <p className="text-[10px] text-zinc-600 uppercase tracking-wide mb-0.5">Ativo desde</p>
                <p className="text-sm font-semibold text-zinc-300">{fmtDate(subscription.start_date)}</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-600 uppercase tracking-wide mb-0.5">Próxima cobrança</p>
                <p className="text-sm font-semibold text-zinc-300">{fmtDate(subscription.next_billing_date)}</p>
              </div>
            </div>

            <button
              onClick={() => setShowCheckout(true)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm font-semibold text-zinc-300 transition-colors"
            >
              Gerenciar Assinatura
              <ArrowRightIcon className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="bg-surface-1 border border-white/5 rounded-2xl p-5 text-center">
            <p className="text-sm text-zinc-500">Você não possui uma assinatura ativa.</p>
            <button
              onClick={() => setShowCheckout(true)}
              className="mt-3 inline-flex items-center gap-2 py-2.5 px-5 rounded-xl bg-primary/10 border border-primary/20 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors"
            >
              Ver Planos
              <ArrowRightIcon className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Daily passes */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TicketIcon className="w-4 h-4 text-zinc-500" />
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Passes Avulsos</h2>
          </div>
          {todayPass && (
            <span className="text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full">
              Válido Hoje
            </span>
          )}
        </div>

        {dailyPasses.length === 0 ? (
          <div className="bg-surface-1 border border-white/5 rounded-2xl p-5 text-center">
            <p className="text-sm text-zinc-500">Nenhum passe avulso disponível.</p>
            <button
              onClick={() => setShowCheckout(true)}
              className="mt-3 flex items-center gap-1.5 mx-auto py-2.5 px-5 rounded-xl bg-primary/10 border border-primary/20 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors"
            >
              <TicketIcon className="w-4 h-4" />
              Comprar Passe
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {dailyPasses.map((pass) => (
              <div key={pass.id} className="bg-surface-1 border border-white/5 rounded-xl px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CalendarDaysIcon className="w-4 h-4 text-zinc-500 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-zinc-200">{fmtDate(pass.valid_for_date)}</p>
                    {pass.valid_for_date === today && (
                      <p className="text-[10px] text-primary font-semibold">Hoje</p>
                    )}
                  </div>
                </div>
                <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${PASS_STATUS_STYLES[pass.status]}`}>
                  {PASS_STATUS_LABELS[pass.status]}
                </span>
              </div>
            ))}

            <button
              onClick={() => setShowCheckout(true)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-dashed border-zinc-700 text-sm font-semibold text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors"
            >
              <TicketIcon className="w-4 h-4" />
              Comprar Mais Passes
            </button>
          </div>
        )}
      </div>

      {/* Checkout modal */}
      {showCheckout && (
        <CheckoutModal plans={plans} onClose={() => setShowCheckout(false)} />
      )}
    </div>
  );
}

// ── Checkout modal ─────────────────────────────────────────────────────────────

type CheckoutStep = "select" | "coupon" | "confirm" | "success" | "error";

function CheckoutModal({
  plans,
  onClose,
}: {
  plans: PlanOption[];
  onClose: () => void;
}) {
  const [step, setStep] = useState<CheckoutStep>("select");
  const [productType, setProductType] = useState<"plan" | "daily_pass">("plan");
  const [selectedPlan, setSelectedPlan] = useState<PlanOption | null>(null);
  const [passQty, setPassQty] = useState(1);
  const [couponCode, setCouponCode] = useState("");
  const [couponResult, setCouponResult] = useState<CouponValidation | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const PASS_UNIT_PRICE = 25; // R$25/passe — hardcoded for student self-service

  const baseAmount =
    productType === "plan"
      ? (selectedPlan?.price ?? 0)
      : passQty * PASS_UNIT_PRICE;

  const couponDiscount = couponResult?.valid ? couponResult.discount_percentage : 0;
  const finalAmount = couponResult?.valid ? couponResult.final_amount : baseAmount;
  const isFree = finalAmount === 0;

  async function handleApplyCoupon() {
    if (!couponCode) return;
    setCheckingCoupon(true);
    const res = await validateCoupon(couponCode, baseAmount);
    setCouponResult(res);
    setCheckingCoupon(false);
  }

  function handleCheckout() {
    startTransition(async () => {
      const res = await processStudentCheckout({
        product_type: productType,
        plan_id: selectedPlan?.id,
        daily_pass_quantity: passQty,
        coupon_code: couponCode || undefined,
        base_amount: baseAmount,
      });

      if (!res.ok) {
        setErrorMsg(res.message);
        setStep("error");
        return;
      }

      if (res.action === "activated") {
        setSuccessMsg(res.message);
        setStep("success");
      } else {
        // Stripe redirect
        window.location.href = res.stripe_url;
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-surface-1 border border-white/8 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
        {/* Modal header */}
        <div className="sticky top-0 bg-surface-1 flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h2 className="font-bold text-white">
            {step === "success" ? "Parabéns!" : step === "error" ? "Erro" : "Comprar"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-xl text-zinc-500 hover:text-white">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Success state */}
          {step === "success" && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircleIcon className="w-8 h-8 text-primary" />
              </div>
              <p className="text-lg font-bold text-white">{successMsg}</p>
              <button
                onClick={onClose}
                className="px-6 py-3 rounded-xl bg-primary text-black font-bold text-sm"
              >
                Fechar
              </button>
            </div>
          )}

          {/* Error state */}
          {step === "error" && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center">
                <XCircleIcon className="w-8 h-8 text-danger" />
              </div>
              <p className="text-sm text-zinc-300">{errorMsg}</p>
              <button
                onClick={() => setStep("select")}
                className="px-6 py-3 rounded-xl bg-surface-2 text-zinc-400 font-bold text-sm hover:text-white"
              >
                Tentar Novamente
              </button>
            </div>
          )}

          {/* Product selection */}
          {(step === "select" || step === "coupon" || step === "confirm") && (
            <>
              {/* Product type */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">O que deseja comprar?</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setProductType("plan"); setSelectedPlan(null); setCouponResult(null); }}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${productType === "plan" ? "bg-primary/10 border-primary/30 text-primary" : "bg-surface-2 border-white/8 text-zinc-400"}`}
                  >
                    Assinatura
                  </button>
                  <button
                    onClick={() => { setProductType("daily_pass"); setSelectedPlan(null); setCouponResult(null); }}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${productType === "daily_pass" ? "bg-primary/10 border-primary/30 text-primary" : "bg-surface-2 border-white/8 text-zinc-400"}`}
                  >
                    Passe Avulso
                  </button>
                </div>
              </div>

              {/* Plan selector */}
              {productType === "plan" && (
                <div className="space-y-2">
                  {plans.length === 0 ? (
                    <p className="text-sm text-zinc-500 text-center py-4">
                      Nenhum plano disponível. Fale com a recepção.
                    </p>
                  ) : (
                    plans.map((plan) => (
                      <button
                        key={plan.id}
                        onClick={() => { setSelectedPlan(plan); setCouponResult(null); }}
                        className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border text-sm transition-all ${selectedPlan?.id === plan.id ? "bg-primary/10 border-primary/30" : "bg-surface-2 border-white/5 hover:border-white/10"}`}
                      >
                        <span className="font-semibold text-zinc-200">
                          {plan.name}
                          <span className="text-zinc-500 font-normal ml-2">({CYCLE_LABELS[plan.billing_cycle]})</span>
                        </span>
                        <span className={`font-bold tabular-nums ${selectedPlan?.id === plan.id ? "text-primary" : "text-zinc-400"}`}>
                          {fmt(plan.price)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Pass quantity */}
              {productType === "daily_pass" && (
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Quantidade ({fmt(PASS_UNIT_PRICE)} cada)
                  </label>
                  <div className="flex items-center justify-center gap-6">
                    <button
                      onClick={() => { setPassQty(Math.max(1, passQty - 1)); setCouponResult(null); }}
                      className="w-10 h-10 rounded-xl bg-surface-2 border border-white/8 text-zinc-300 font-bold text-lg flex items-center justify-center hover:border-white/20"
                    >−</button>
                    <span className="text-3xl font-black text-white tabular-nums w-12 text-center">{passQty}</span>
                    <button
                      onClick={() => { setPassQty(Math.min(30, passQty + 1)); setCouponResult(null); }}
                      className="w-10 h-10 rounded-xl bg-surface-2 border border-white/8 text-zinc-300 font-bold text-lg flex items-center justify-center hover:border-white/20"
                    >+</button>
                  </div>
                </div>
              )}

              {/* Coupon */}
              {baseAmount > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <TagIcon className="w-3.5 h-3.5" />
                    Cupom de Desconto
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={couponCode}
                      onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponResult(null); }}
                      placeholder="CÓDIGO"
                      className="flex-1 bg-surface-2 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-primary/50 font-mono uppercase tracking-widest"
                    />
                    <button
                      onClick={handleApplyCoupon}
                      disabled={!couponCode || checkingCoupon || !baseAmount}
                      className="px-4 py-2.5 rounded-xl bg-surface-2 border border-white/8 text-sm text-zinc-400 hover:text-white disabled:opacity-40"
                    >
                      {checkingCoupon ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : "Aplicar"}
                    </button>
                  </div>
                  {couponResult && (
                    <p className={`text-xs font-medium ${couponResult.valid ? "text-primary" : "text-danger"}`}>
                      {couponResult.valid
                        ? `✓ ${couponResult.discount_percentage}% de desconto → ${fmt(couponResult.final_amount)}`
                        : `✗ ${couponResult.message}`}
                    </p>
                  )}
                </div>
              )}

              {/* Order summary & CTA */}
              {(productType === "daily_pass" || selectedPlan) && (
                <div className="border-t border-white/5 pt-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Subtotal</span>
                    <span className="text-zinc-300 tabular-nums">{fmt(baseAmount)}</span>
                  </div>
                  {couponDiscount > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-500">Desconto ({couponDiscount}%)</span>
                      <span className="text-danger tabular-nums">−{fmt(baseAmount - finalAmount)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-white">Total</span>
                    <span className="text-primary text-xl tabular-nums">{fmt(finalAmount)}</span>
                  </div>

                  <button
                    onClick={handleCheckout}
                    disabled={isPending || (productType === "plan" && !selectedPlan)}
                    className="w-full py-3.5 rounded-xl bg-primary text-black font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-40"
                  >
                    {isPending
                      ? "Processando..."
                      : isFree
                      ? "Ativar Grátis 🎉"
                      : "Ir para Pagamento"}
                  </button>

                  {!isFree && (
                    <p className="text-[10px] text-zinc-600 text-center">
                      Você será redirecionado para o checkout seguro Stripe.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
