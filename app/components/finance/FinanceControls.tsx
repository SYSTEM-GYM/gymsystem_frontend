"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PlusIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
  ChevronDownIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { TransactionForm } from "./TransactionForm";

// ── Types ─────────────────────────────────────────────────────────────────────

type Member = { id: string; full_name: string };

export type ExportableTransaction = {
  created_at: string;
  description: string | null;
  category: string;
  status: string;
  type: "income" | "expense";
  amount: number;
};

type Props = {
  currentFilter: string;
  members: Member[];
  transactions: ExportableTransaction[];
};

// ── Constants ─────────────────────────────────────────────────────────────────

const FILTERS = [
  { key: "todos",        label: "Todos" },
  { key: "mensalidades", label: "Mensalidades" },
  { key: "ecommerce",    label: "E-commerce" },
  { key: "despesas",     label: "Despesas" },
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  subscription: "Mensalidade",
  ecommerce:    "E-commerce",
  rent:         "Aluguel",
  energy:       "Energia",
  water:        "Água",
  payroll:      "Folha de Pagamento",
  maintenance:  "Manutenção",
  supplies:     "Materiais",
  equipment:    "Equipamentos",
  other:        "Outros",
};

const STATUS_LABELS: Record<string, string> = {
  paid:    "Pago",
  pending: "Pendente",
  overdue: "Vencido",
};

// ── CSV Export ────────────────────────────────────────────────────────────────

function exportToCSV(transactions: ExportableTransaction[]) {
  const BOM = "﻿"; // UTF-8 BOM so Excel opens accented chars correctly

  const headers = ["Data", "Descrição", "Categoria", "Tipo", "Status", "Valor (R$)"];

  const rows = transactions.map((t) => {
    const date = new Intl.DateTimeFormat("pt-BR").format(new Date(t.created_at));
    const description = (t.description ?? CATEGORY_LABELS[t.category] ?? t.category).replace(/"/g, '""');
    const category = CATEGORY_LABELS[t.category] ?? t.category;
    const type = t.type === "income" ? "Receita" : "Despesa";
    const status = STATUS_LABELS[t.status] ?? t.status;
    const amount = Number(t.amount).toFixed(2).replace(".", ",");

    return [
      `"${date}"`,
      `"${description}"`,
      `"${category}"`,
      `"${type}"`,
      `"${status}"`,
      `"${amount}"`,
    ].join(";");
  });

  const csv = BOM + [headers.join(";"), ...rows].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const filename = `extrato-simp-${dateStamp}.csv`;

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

// ── Export Dropdown ───────────────────────────────────────────────────────────

function ExportDropdown({ transactions }: { transactions: ExportableTransaction[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  const handleBlur = () => setTimeout(() => setOpen(false), 120);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        onBlur={handleBlur}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-surface-2 text-zinc-300 border border-white/10 hover:bg-zinc-700 hover:text-white transition-colors"
      >
        <ArrowDownTrayIcon className="w-3.5 h-3.5" />
        Exportar
        <ChevronDownIcon
          className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-44 bg-surface-1 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-30">
          <button
            onMouseDown={() => {
              exportToCSV(transactions);
              setOpen(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-300 hover:bg-surface-2 hover:text-white transition-colors text-left"
          >
            <ArrowDownTrayIcon className="w-4 h-4 flex-shrink-0" />
            Baixar CSV
          </button>
          <div className="h-px bg-white/5 mx-3" />
          <button
            onMouseDown={() => {
              setOpen(false);
              // Small delay so dropdown closes before print dialog opens
              setTimeout(() => window.print(), 80);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-300 hover:bg-surface-2 hover:text-white transition-colors text-left"
          >
            <PrinterIcon className="w-4 h-4 flex-shrink-0" />
            Imprimir / PDF
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function FinanceControls({ currentFilter, members, transactions }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);

  function handleFilterClick(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "todos") {
      params.delete("filter");
    } else {
      params.set("filter", key);
    }
    router.push(`?${params.toString()}`);
  }

  const handleSuccess = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  return (
    <>
      {/* Control bar — hidden when printing */}
      <div className="finance-controls flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Filter pills */}
        <div className="flex items-center gap-2 flex-wrap flex-1">
          {FILTERS.map(({ key, label }) => {
            const isActive = currentFilter === key;
            return (
              <button
                key={key}
                onClick={() => handleFilterClick(key)}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-primary text-black"
                    : "bg-surface-2 text-zinc-400 hover:text-white border border-white/5"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <ExportDropdown transactions={transactions} />

          <button
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-primary text-black hover:scale-105 active:scale-95 transition-transform"
          >
            <PlusIcon className="w-4 h-4" />
            Novo Lançamento
          </button>
        </div>
      </div>

      {/* Backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Slide-in drawer */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-surface-1 border-l border-white/5 flex flex-col transform transition-transform duration-300 ease-in-out ${
          drawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-white">Novo Lançamento</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Registre uma receita ou despesa manualmente.
            </p>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="p-2 rounded-xl text-zinc-500 hover:bg-surface-2 hover:text-white transition-colors"
            aria-label="Fechar"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {drawerOpen && (
            <TransactionForm members={members} onSuccess={handleSuccess} />
          )}
        </div>
      </aside>
    </>
  );
}
