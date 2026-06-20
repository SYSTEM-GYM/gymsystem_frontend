"use client";

import { useActionState, useEffect, useOptimistic, useState, useTransition } from "react";
import {
  PlusIcon,
  XMarkIcon,
  TrashIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import {
  createRecurringExpense,
  toggleRecurringExpense,
  deleteRecurringExpense,
  type RecurringActionState,
} from "@/app/dashboard/finance/recurring-actions";

// ── Types ────────────────────────────────────────────────────────────────────

export type RecurringExpense = {
  id: string;
  name: string;
  description: string | null;
  amount: number;
  category: string;
  day_of_month: number;
  is_active: boolean;
};

type Props = {
  initialExpenses: RecurringExpense[];
};

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  { value: "rent",        label: "Aluguel" },
  { value: "energy",      label: "Energia" },
  { value: "water",       label: "Água" },
  { value: "payroll",     label: "Folha de Pagamento" },
  { value: "maintenance", label: "Manutenção" },
  { value: "supplies",    label: "Materiais" },
  { value: "equipment",   label: "Equipamentos" },
  { value: "other",       label: "Outros" },
] as const;

const CATEGORY_LABELS = Object.fromEntries(
  CATEGORY_OPTIONS.map((c) => [c.value, c.label])
);

const INITIAL_STATE: RecurringActionState = { status: "idle" };

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

// ── Row actions ───────────────────────────────────────────────────────────────

function ToggleButton({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(async () => { await toggleRecurringExpense(id, isActive); })}
      disabled={pending}
      title={isActive ? "Desativar" : "Ativar"}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 focus:outline-none ${
        isActive ? "bg-primary" : "bg-zinc-700"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-black transition-transform ${
          isActive ? "translate-x-[18px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

function DeleteButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => startTransition(async () => { await deleteRecurringExpense(id); })}
          disabled={pending}
          className="text-xs font-semibold text-danger hover:underline disabled:opacity-50"
        >
          {pending ? "..." : "Confirmar"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-zinc-500 hover:text-white"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      disabled={pending}
      title="Excluir"
      className="p-1.5 rounded-xl text-zinc-600 hover:bg-danger/10 hover:text-danger transition-colors disabled:opacity-50"
    >
      <TrashIcon className="w-4 h-4" />
    </button>
  );
}

// ── Create Form Modal ─────────────────────────────────────────────────────────

function CreateModal({ onClose }: { onClose: () => void }) {
  const [state, formAction, isPending] = useActionState(createRecurringExpense, INITIAL_STATE);

  useEffect(() => {
    if (state.status === "success") onClose();
  }, [state.status, onClose]);

  const inputClass =
    "w-full bg-surface-2 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors";

  const labelClass =
    "block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-surface-1 border border-white/10 rounded-3xl shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
            <div>
              <h3 className="text-base font-bold text-white">Nova Despesa Fixa</h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Modelo gerado automaticamente todo mês.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-500 hover:bg-surface-2 hover:text-white transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form action={formAction} className="px-6 py-6 space-y-5">
            {/* Name */}
            <div>
              <label htmlFor="rec-name" className={labelClass}>Nome</label>
              <input
                id="rec-name"
                name="name"
                type="text"
                placeholder="Ex: Aluguel do espaço"
                required
                className={inputClass}
              />
            </div>

            {/* Category */}
            <div>
              <label htmlFor="rec-category" className={labelClass}>Categoria</label>
              <select
                id="rec-category"
                name="category"
                required
                defaultValue=""
                className={inputClass}
              >
                <option value="" disabled>Selecione uma categoria</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Amount + Day — two columns */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="rec-amount" className={labelClass}>Valor (R$)</label>
                <input
                  id="rec-amount"
                  name="amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="rec-day" className={labelClass}>Dia do Mês</label>
                <input
                  id="rec-day"
                  name="day_of_month"
                  type="number"
                  min={1}
                  max={28}
                  placeholder="5"
                  required
                  className={inputClass}
                />
              </div>
            </div>

            {/* Error */}
            {state.status === "error" && (
              <p className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-2xl px-4 py-3">
                {state.message}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-full text-sm font-semibold bg-surface-2 text-zinc-400 hover:text-white border border-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 py-3 rounded-full text-sm font-bold bg-primary text-black disabled:opacity-40 hover:scale-[1.02] active:scale-[0.98] transition-transform"
              >
                {isPending ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function RecurringExpensesManager({ initialExpenses }: Props) {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="bg-surface-1 border border-white/5 rounded-3xl overflow-hidden">
      {/* Section header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
        <div>
          <h2 className="text-base font-bold text-white">Despesas Fixas Recorrentes</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Lançamentos gerados automaticamente todo mês pelo sistema.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold bg-primary text-black hover:scale-105 active:scale-95 transition-transform"
        >
          <PlusIcon className="w-4 h-4" />
          Nova Despesa Fixa
        </button>
      </div>

      {/* Table */}
      {initialExpenses.length === 0 ? (
        <div className="p-12 flex flex-col items-center gap-3 text-center">
          <ArrowPathIcon className="w-10 h-10 text-zinc-700" />
          <p className="text-sm text-zinc-500">
            Nenhuma despesa fixa cadastrada.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Descrição
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden sm:table-cell">
                  Categoria
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden md:table-cell">
                  Dia do Vencimento
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Valor
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {initialExpenses.map((expense) => (
                <tr
                  key={expense.id}
                  className={`hover:bg-surface-2/50 transition-colors ${
                    !expense.is_active ? "opacity-50" : ""
                  }`}
                >
                  {/* Descrição */}
                  <td className="px-6 py-4">
                    <p className="font-medium text-white">{expense.name}</p>
                    {expense.description && (
                      <p className="text-xs text-zinc-600 mt-0.5">{expense.description}</p>
                    )}
                  </td>

                  {/* Categoria */}
                  <td className="px-4 py-4 hidden sm:table-cell">
                    <span className="text-xs text-zinc-400">
                      {CATEGORY_LABELS[expense.category] ?? expense.category}
                    </span>
                  </td>

                  {/* Dia */}
                  <td className="px-4 py-4 hidden md:table-cell">
                    <span className="text-xs text-zinc-400 tabular-nums">
                      Todo dia{" "}
                      <span className="text-white font-semibold">{expense.day_of_month}</span>
                    </span>
                  </td>

                  {/* Valor */}
                  <td className="px-4 py-4 text-right">
                    <span className="font-semibold text-danger tabular-nums">
                      −{formatCurrency(Number(expense.amount))}
                    </span>
                  </td>

                  {/* Toggle */}
                  <td className="px-4 py-4 text-center">
                    <ToggleButton id={expense.id} isActive={expense.is_active} />
                  </td>

                  {/* Delete */}
                  <td className="px-6 py-4 text-right">
                    <DeleteButton id={expense.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Total footer */}
      {initialExpenses.length > 0 && (
        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            {initialExpenses.filter((e) => e.is_active).length} ativa
            {initialExpenses.filter((e) => e.is_active).length !== 1 ? "s" : ""}{" "}
            de {initialExpenses.length} total
          </span>
          <span className="text-sm font-bold text-danger tabular-nums">
            −{formatCurrency(
              initialExpenses
                .filter((e) => e.is_active)
                .reduce((s, e) => s + Number(e.amount), 0)
            )}
            <span className="text-xs font-normal text-zinc-500 ml-1">/mês</span>
          </span>
        </div>
      )}

      {/* Create modal */}
      {showModal && <CreateModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
