"use client";

import {
  CheckCircleIcon,
  XCircleIcon,
  CreditCardIcon,
  TicketIcon,
  CalendarDaysIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import { QRCodeGenerator } from "@/app/components/access/QRCodeGenerator";
import type { WalletData } from "./actions";

function fmt(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
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
};

export function WalletClient({ wallet }: Props) {
  const { subscription, dailyPasses, hasAccess } = wallet;
  const today = new Date().toISOString().split("T")[0];
  const todayPass = dailyPasses.find(
    (p) => p.valid_for_date === today && p.status === "available"
  );

  return (
    <div className="flex flex-col gap-6 pb-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">
          Carteira & Acesso
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Seu passe digital e assinatura.
        </p>
      </div>

      {/* Turnstile access status badge */}
      <div
        className={`flex items-center gap-3 px-5 py-4 rounded-2xl border ${
          hasAccess
            ? "bg-primary/10 border-primary/25"
            : "bg-danger/10 border-danger/25"
        }`}
      >
        {hasAccess ? (
          <CheckCircleIcon className="w-6 h-6 text-primary flex-shrink-0" />
        ) : (
          <XCircleIcon className="w-6 h-6 text-danger flex-shrink-0" />
        )}
        <div>
          <p
            className={`text-sm font-bold uppercase tracking-widest ${
              hasAccess ? "text-primary" : "text-danger"
            }`}
          >
            {hasAccess ? "Acesso Liberado" : "Acesso Bloqueado"}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">
            {hasAccess
              ? subscription?.status === "active"
                ? `Plano ${CYCLE_LABELS[subscription.billing_cycle] ?? ""} ativo`
                : "Passe diário válido para hoje"
              : "Regularize sua situação na recepção."}
          </p>
        </div>
      </div>

      {/* QR Code section */}
      <div className="flex flex-col items-center gap-4 py-2">
        <QRCodeGenerator />
      </div>

      {/* My Subscription */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CreditCardIcon className="w-4 h-4 text-zinc-500" />
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
            Minha Assinatura
          </h2>
        </div>

        {subscription ? (
          <div className="bg-surface-1 border border-white/5 rounded-2xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-bold text-white">
                  {subscription.plan_name}
                </p>
                <p className="text-sm text-zinc-500">
                  {CYCLE_LABELS[subscription.billing_cycle]} ·{" "}
                  {fmt(subscription.plan_price)}
                </p>
              </div>
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                  STATUS_STYLES[subscription.status]
                }`}
              >
                {STATUS_LABELS[subscription.status]}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-white/5">
              <div>
                <p className="text-[10px] text-zinc-600 uppercase tracking-wide mb-0.5">
                  Ativo desde
                </p>
                <p className="text-sm font-semibold text-zinc-300">
                  {fmtDate(subscription.start_date)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-600 uppercase tracking-wide mb-0.5">
                  Próxima cobrança
                </p>
                <p className="text-sm font-semibold text-zinc-300">
                  {fmtDate(subscription.next_billing_date)}
                </p>
              </div>
            </div>

            <button className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm font-semibold text-zinc-300 transition-colors">
              Gerenciar Assinatura
              <ArrowRightIcon className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="bg-surface-1 border border-white/5 rounded-2xl p-5 text-center">
            <p className="text-sm text-zinc-500">
              Você não possui uma assinatura ativa.
            </p>
            <p className="text-xs text-zinc-600 mt-1">
              Fale com a recepção para assinar um plano.
            </p>
          </div>
        )}
      </div>

      {/* Daily Passes */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TicketIcon className="w-4 h-4 text-zinc-500" />
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
              Passes Avulsos
            </h2>
          </div>
          {todayPass && (
            <span className="text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full">
              Válido Hoje
            </span>
          )}
        </div>

        {dailyPasses.length === 0 ? (
          <div className="bg-surface-1 border border-white/5 rounded-2xl p-5 text-center">
            <p className="text-sm text-zinc-500">
              Nenhum passe avulso disponível.
            </p>
            <button className="mt-3 flex items-center gap-1.5 mx-auto py-2.5 px-5 rounded-xl bg-primary/10 border border-primary/20 text-sm font-semibold text-primary transition-colors hover:bg-primary/20">
              <TicketIcon className="w-4 h-4" />
              Comprar Passe Avulso
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {dailyPasses.map((pass) => (
              <div
                key={pass.id}
                className="bg-surface-1 border border-white/5 rounded-xl px-4 py-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <CalendarDaysIcon className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-zinc-200">
                      {fmtDate(pass.valid_for_date)}
                    </p>
                    <p className="text-[10px] text-zinc-600">
                      {pass.valid_for_date === today ? "Hoje" : ""}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${
                    PASS_STATUS_STYLES[pass.status]
                  }`}
                >
                  {PASS_STATUS_LABELS[pass.status]}
                </span>
              </div>
            ))}

            <button className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-dashed border-zinc-700 text-sm font-semibold text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors">
              <TicketIcon className="w-4 h-4" />
              Comprar Passe Avulso
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
