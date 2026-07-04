"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createManualTransaction, type TransactionActionState } from "@/app/dashboard/finance/actions";
import { MagnifyingGlassIcon, CheckIcon } from "@heroicons/react/24/outline";

type Member = { id: string; full_name: string };

type Props = {
  members: Member[];
  onSuccess: () => void;
};

const INITIAL_STATE: TransactionActionState = { status: "idle" };

const CATEGORY_OPTIONS = [
  { value: "subscription", label: "Mensalidade",           types: ["income"] },
  { value: "ecommerce",    label: "E-commerce",            types: ["income"] },
  { value: "rent",         label: "Aluguel",               types: ["expense"] },
  { value: "energy",       label: "Energia",               types: ["expense"] },
  { value: "payroll",      label: "Folha de Pagamento",    types: ["expense"] },
  { value: "other",        label: "Outros",                types: ["income", "expense"] },
] as const;

export function TransactionForm({ members, onSuccess }: Props) {
  const [state, formAction, isPending] = useActionState(
    createManualTransaction,
    INITIAL_STATE
  );

  const [type, setType]           = useState<"income" | "expense">("income");
  const [category, setCategory]   = useState("subscription");
  const [memberQuery, setMemberQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showMemberList, setShowMemberList] = useState(false);
  const memberInputRef = useRef<HTMLInputElement>(null);

  // Notify parent on success
  useEffect(() => {
    if (state.status === "success") onSuccess();
  }, [state.status, onSuccess]);

  // Reset category to a valid one when type changes
  useEffect(() => {
    const validForType = CATEGORY_OPTIONS.filter((c) => (c.types as readonly string[]).includes(type));
    if (!validForType.find((c) => c.value === category)) {
      setCategory(validForType[0].value);
    }
  }, [type, category]);

  const showMemberPicker = type === "income" && category === "subscription";
  const categoriesForType = CATEGORY_OPTIONS.filter((c) => (c.types as readonly string[]).includes(type));

  const filteredMembers = members.filter((m) =>
    m.full_name.toLowerCase().includes(memberQuery.toLowerCase())
  );

  function handleMemberSelect(member: Member) {
    setSelectedMember(member);
    setMemberQuery(member.full_name);
    setShowMemberList(false);
  }

  const inputClass =
    "w-full bg-surface-2 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors";

  const labelClass = "block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2";

  return (
    <form action={formAction} className="space-y-5">

      {/* Type toggle */}
      <div>
        <label className={labelClass}>Tipo</label>
        <div className="grid grid-cols-2 gap-2">
          {(["income", "expense"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`py-3 rounded-2xl text-sm font-semibold transition-all ${
                type === t
                  ? t === "income"
                    ? "bg-primary text-black"
                    : "bg-danger/20 text-danger border border-danger/30"
                  : "bg-surface-2 text-zinc-500 hover:text-white border border-white/5"
              }`}
            >
              {t === "income" ? "Receita" : "Despesa"}
            </button>
          ))}
        </div>
        <input type="hidden" name="type" value={type} />
      </div>

      {/* Category */}
      <div>
        <label htmlFor="category" className={labelClass}>Categoria</label>
        <select
          id="category"
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={inputClass}
        >
          {categoriesForType.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Member picker — only for income + subscription */}
      {showMemberPicker && (
        <div className="relative">
          <label className={labelClass}>Aluno</label>
          {selectedMember && (
            <input type="hidden" name="linked_user_id" value={selectedMember.id} />
          )}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            <input
              ref={memberInputRef}
              type="text"
              placeholder="Buscar aluno pelo nome..."
              value={memberQuery}
              onChange={(e) => {
                setMemberQuery(e.target.value);
                setSelectedMember(null);
                setShowMemberList(true);
              }}
              onFocus={() => setShowMemberList(true)}
              onBlur={() => setTimeout(() => setShowMemberList(false), 150)}
              className={`${inputClass} pl-9`}
              autoComplete="off"
            />
          </div>
          {showMemberList && filteredMembers.length > 0 && (
            <ul className="absolute z-10 top-full mt-1 w-full bg-surface-1 border border-white/10 rounded-2xl overflow-hidden shadow-2xl max-h-48 overflow-y-auto">
              {filteredMembers.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onMouseDown={() => handleMemberSelect(m)}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm text-zinc-300 hover:bg-surface-2 hover:text-white transition-colors text-left"
                  >
                    <span>{m.full_name}</span>
                    {selectedMember?.id === m.id && (
                      <CheckIcon className="w-4 h-4 text-primary shrink-0" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {showMemberList && memberQuery && filteredMembers.length === 0 && (
            <div className="absolute z-10 top-full mt-1 w-full bg-surface-1 border border-white/10 rounded-2xl px-4 py-3 text-sm text-zinc-500">
              Nenhum aluno encontrado.
            </div>
          )}
        </div>
      )}

      {/* Amount */}
      <div>
        <label htmlFor="amount" className={labelClass}>Valor (R$)</label>
        <input
          id="amount"
          name="amount"
          type="text"
          inputMode="decimal"
          placeholder="0,00"
          required
          className={inputClass}
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className={labelClass}>Descrição</label>
        <input
          id="description"
          name="description"
          type="text"
          placeholder="Opcional"
          className={inputClass}
        />
      </div>

      {/* Due date */}
      <div>
        <label htmlFor="due_date" className={labelClass}>Data de Vencimento</label>
        <input
          id="due_date"
          name="due_date"
          type="date"
          className={`${inputClass} [color-scheme:dark]`}
        />
      </div>

      {/* Status */}
      <div>
        <label className={labelClass}>Status</label>
        <div className="grid grid-cols-3 gap-2">
          {(["pending", "paid", "overdue"] as const).map((s) => {
            const labels = { pending: "Pendente", paid: "Pago", overdue: "Vencido" };
            const activeStyles = {
              pending: "bg-zinc-700 text-white border-zinc-600",
              paid:    "bg-primary/20 text-primary border-primary/30",
              overdue: "bg-danger/20 text-danger border-danger/30",
            };
            return (
              <label
                key={s}
                className={`flex items-center justify-center py-2.5 rounded-2xl text-xs font-semibold border cursor-pointer transition-all
                  has-[:checked]:${activeStyles[s]} border-white/5 text-zinc-500 hover:text-white hover:bg-surface-2`}
              >
                <input type="radio" name="status" value={s} defaultChecked={s === "pending"} className="sr-only" />
                {labels[s]}
              </label>
            );
          })}
        </div>
      </div>

      {/* Error message */}
      {state.status === "error" && (
        <p className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-2xl px-4 py-3">
          {state.message}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending || (showMemberPicker && !selectedMember)}
        className="w-full py-3.5 rounded-full bg-primary text-black text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] transition-transform"
      >
        {isPending ? "Salvando..." : "Salvar Lançamento"}
      </button>
    </form>
  );
}
