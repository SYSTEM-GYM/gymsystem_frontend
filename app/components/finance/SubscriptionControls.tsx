"use client";

import { useState, useTransition } from "react";
import {
  generateMonthlyInvoices,
  markOverdueInvoices,
  markInvoiceAsPaid,
  createPlan,
  type InvoiceRow,
  type GymPlan,
} from "@/app/dashboard/finance/subscription-actions";
import { buildWhatsAppUrl } from "@/lib/finance-utils";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ChatBubbleLeftEllipsisIcon,
  PlusIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline";

// ── Utility ───────────────────────────────────────────────────────────────────

function fmt(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function fmtDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(dateStr + "T12:00:00"));
}

const STATUS_STYLES: Record<string, string> = {
  paid:    "bg-primary/10 text-primary border border-primary/20",
  pending: "bg-zinc-700/30 text-zinc-400 border border-zinc-700/50",
  overdue: "bg-danger/10 text-danger border border-danger/20",
};

const STATUS_LABELS: Record<string, string> = {
  paid:    "Pago",
  pending: "Pendente",
  overdue: "Atrasado",
};

// ── Generate + Sync buttons ───────────────────────────────────────────────────

export function InvoiceControlButtons() {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function handleGenerate() {
    startTransition(async () => {
      const res = await generateMonthlyInvoices();
      if (res.ok) {
        setMsg({ ok: true, text: `${res.created} fatura(s) gerada(s) com sucesso.` });
      } else {
        setMsg({ ok: false, text: res.message });
      }
      setTimeout(() => setMsg(null), 4000);
    });
  }

  function handleMarkOverdue() {
    startTransition(async () => {
      const res = await markOverdueInvoices();
      setMsg(res.ok
        ? { ok: true, text: "Faturas vencidas atualizadas." }
        : { ok: false, text: res.message });
      setTimeout(() => setMsg(null), 4000);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={handleGenerate}
        disabled={isPending}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors disabled:opacity-50"
      >
        <ArrowPathIcon className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
        Gerar Faturas
      </button>
      <button
        onClick={handleMarkOverdue}
        disabled={isPending}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-danger/10 text-danger text-sm font-semibold hover:bg-danger/20 transition-colors disabled:opacity-50"
      >
        <ExclamationTriangleIcon className="w-4 h-4" />
        Sincronizar Atrasos
      </button>
      {msg && (
        <span className={`text-xs font-medium ${msg.ok ? "text-primary" : "text-danger"}`}>
          {msg.text}
        </span>
      )}
    </div>
  );
}

// ── Inadimplentes table ───────────────────────────────────────────────────────

export function InadimplentesTable({ invoices }: { invoices: InvoiceRow[] }) {
  const [pending, startTransition] = useTransition();
  const [marking, setMarking] = useState<string | null>(null);

  function handlePay(id: string) {
    setMarking(id);
    startTransition(async () => {
      await markInvoiceAsPaid(id);
      setMarking(null);
    });
  }

  if (invoices.length === 0) {
    return (
      <div className="p-10 flex flex-col items-center gap-3 text-center">
        <CheckCircleIcon className="w-10 h-10 text-primary/60" />
        <p className="text-sm text-zinc-500">Nenhum inadimplente no momento. 🎉</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/5">
            <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Aluno</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden sm:table-cell">Plano</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Vencimento</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden md:table-cell">Atraso</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Valor</th>
            <th className="text-right px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {invoices.map((inv) => {
            const waUrl = buildWhatsAppUrl(inv.student_phone, inv.student_name, inv.amount);
            const isMarking = marking === inv.id;
            return (
              <tr key={inv.id} className="hover:bg-surface-2/50 transition-colors">
                <td className="px-5 py-3.5">
                  <span className="text-zinc-300 font-medium">{inv.student_name}</span>
                </td>
                <td className="px-4 py-3.5 hidden sm:table-cell">
                  <span className="text-xs text-zinc-500">{inv.plan_name}</span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-xs text-zinc-400 tabular-nums">{fmtDate(inv.due_date)}</span>
                </td>
                <td className="px-4 py-3.5 hidden md:table-cell">
                  <span className="text-xs font-semibold text-danger">
                    {inv.days_overdue} dia{inv.days_overdue !== 1 ? "s" : ""}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <span className="font-semibold text-danger tabular-nums">{fmt(inv.amount)}</span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-end gap-2">
                    {waUrl && (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Notificar via WhatsApp"
                        className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                      >
                        <ChatBubbleLeftEllipsisIcon className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      onClick={() => handlePay(inv.id)}
                      disabled={pending || isMarking}
                      title="Marcar como pago"
                      className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-40"
                    >
                      <CheckCircleIcon className={`w-4 h-4 ${isMarking ? "animate-pulse" : ""}`} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Recent invoices table ─────────────────────────────────────────────────────

export function RecentInvoicesTable({ invoices }: { invoices: InvoiceRow[] }) {
  const [pending, startTransition] = useTransition();
  const [marking, setMarking] = useState<string | null>(null);

  function handlePay(id: string) {
    setMarking(id);
    startTransition(async () => {
      await markInvoiceAsPaid(id);
      setMarking(null);
    });
  }

  if (invoices.length === 0) {
    return (
      <div className="p-10 flex flex-col items-center gap-3 text-center">
        <BanknotesIcon className="w-10 h-10 text-zinc-700" />
        <p className="text-sm text-zinc-500">Nenhuma fatura encontrada.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/5">
            <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Aluno</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden sm:table-cell">Plano</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Vencimento</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Valor</th>
            <th className="text-right px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {invoices.map((inv) => {
            const isMarking = marking === inv.id;
            return (
              <tr key={inv.id} className="hover:bg-surface-2/50 transition-colors">
                <td className="px-5 py-3.5">
                  <span className="text-zinc-300 font-medium">{inv.student_name}</span>
                </td>
                <td className="px-4 py-3.5 hidden sm:table-cell">
                  <span className="text-xs text-zinc-500">{inv.plan_name}</span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-xs text-zinc-400 tabular-nums">
                    {inv.status === "paid" ? fmtDate(inv.paid_date) : fmtDate(inv.due_date)}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[inv.status] ?? STATUS_STYLES.pending}`}>
                    {STATUS_LABELS[inv.status] ?? inv.status}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <span className={`font-semibold tabular-nums ${inv.status === "paid" ? "text-primary" : inv.status === "overdue" ? "text-danger" : "text-zinc-300"}`}>
                    {fmt(inv.amount)}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  {inv.status !== "paid" && (
                    <button
                      onClick={() => handlePay(inv.id)}
                      disabled={pending || isMarking}
                      title="Marcar como pago"
                      className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-40"
                    >
                      <CheckCircleIcon className={`w-4 h-4 ${isMarking ? "animate-pulse" : ""}`} />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Create Plan modal ─────────────────────────────────────────────────────────

export function CreatePlanButton({ plans }: { plans: GymPlan[] }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const CYCLE_LABELS: Record<string, string> = {
    monthly: "Mensal",
    quarterly: "Trimestral",
    yearly: "Anual",
  };

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
        setOpen(false);
        setError(null);
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-black text-sm font-semibold hover:bg-primary/90 transition-colors"
      >
        <PlusIcon className="w-4 h-4" />
        Novo Plano
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-1 border border-white/8 rounded-2xl w-full max-w-sm p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-white">Criar Plano</h2>
              <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-white text-xl leading-none">×</button>
            </div>

            {plans.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Planos Atuais</p>
                {plans.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-300">{p.name} <span className="text-zinc-600">({CYCLE_LABELS[p.billing_cycle]})</span></span>
                    <span className="font-semibold text-primary tabular-nums">{fmt(p.price)}</span>
                  </div>
                ))}
                <div className="border-t border-white/5 mt-2" />
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Nome do Plano</label>
                <input
                  name="name"
                  required
                  placeholder="Ex: Plano Mensal"
                  className="w-full bg-surface-2 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-primary/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Valor (R$)</label>
                <input
                  name="price"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="99,90"
                  className="w-full bg-surface-2 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-primary/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Ciclo de Cobrança</label>
                <select
                  name="billing_cycle"
                  defaultValue="monthly"
                  className="w-full bg-surface-2 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-primary/50"
                >
                  <option value="monthly">Mensal</option>
                  <option value="quarterly">Trimestral</option>
                  <option value="yearly">Anual</option>
                </select>
              </div>

              {error && <p className="text-xs text-danger">{error}</p>}

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-2.5 rounded-xl bg-primary text-black text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isPending ? "Salvando..." : "Criar Plano"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
