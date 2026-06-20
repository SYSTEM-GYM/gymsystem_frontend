import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/Card";
import { FinanceControls } from "@/app/components/finance/FinanceControls";
import { FinancialCharts, type CashFlowPoint, type ExpenseSlice } from "@/app/components/finance/FinancialCharts";
import { RecurringExpensesManager, type RecurringExpense } from "@/app/components/finance/RecurringExpensesManager";
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  BanknotesIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

type Transaction = {
  id: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  status: "pending" | "paid" | "overdue";
  description: string | null;
  due_date: string | null;
  created_at: string;
};

type Member = { id: string; full_name: string };

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

const STATUS_STYLES: Record<string, string> = {
  paid:    "bg-primary/10 text-primary border border-primary/20",
  pending: "bg-zinc-700/30 text-zinc-400 border border-zinc-700/50",
  overdue: "bg-danger/10 text-danger border border-danger/20",
};

const STATUS_LABELS: Record<string, string> = {
  paid:    "Pago",
  pending: "Pendente",
  overdue: "Vencido",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(dateStr));
}

type FilterKey = "todos" | "mensalidades" | "ecommerce" | "despesas";

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter: rawFilter } = await searchParams;
  const filter = (["todos", "mensalidades", "ecommerce", "despesas"].includes(rawFilter ?? "")
    ? rawFilter
    : "todos") as FilterKey;

  // Auth guard
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await authClient
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "trainer")) {
    redirect("/dashboard");
  }

  const admin = createAdminClient();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  // KPI aggregates — always the full month, unfiltered
  const { data: allMonthly } = await admin
    .from("financial_transactions")
    .select("amount, type, status")
    .gte("created_at", monthStart)
    .lte("created_at", monthEnd)
    .returns<Pick<Transaction, "amount" | "type" | "status">[]>();

  // Filtered transaction list for the table
  let filteredQuery = admin
    .from("financial_transactions")
    .select("id, amount, type, category, status, description, due_date, created_at")
    .gte("created_at", monthStart)
    .lte("created_at", monthEnd)
    .order("created_at", { ascending: false });

  if (filter === "mensalidades") filteredQuery = filteredQuery.eq("category", "subscription");
  else if (filter === "ecommerce") filteredQuery = filteredQuery.eq("category", "ecommerce");
  else if (filter === "despesas") filteredQuery = filteredQuery.eq("type", "expense");

  const { data: filteredTransactions } = await filteredQuery.returns<Transaction[]>();

  // Overdue (any month, unfiltered — always show)
  const { data: overdueTransactions } = await admin
    .from("financial_transactions")
    .select("id, amount, type, category, status, description, due_date, created_at")
    .eq("status", "overdue")
    .order("due_date", { ascending: true })
    .limit(10)
    .returns<Transaction[]>();

  // Recurring expense templates
  const { data: recurringExpenses } = await admin
    .from("recurring_expenses")
    .select("id, name, description, amount, category, day_of_month, is_active")
    .order("day_of_month", { ascending: true })
    .returns<RecurringExpense[]>();

  // Members for the transaction form user picker
  const { data: members } = await admin
    .from("users")
    .select("id, full_name")
    .order("full_name", { ascending: true })
    .returns<Member[]>();

  // 6-month cash flow data for the BI bar chart
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();
  const { data: sixMonthRaw } = await admin
    .from("financial_transactions")
    .select("amount, type, status, created_at")
    .gte("created_at", sixMonthsAgo)
    .eq("status", "paid")
    .returns<Pick<Transaction, "amount" | "type" | "status" | "created_at">[]>();

  // Build cash flow points — one per month in order (oldest → newest)
  const cashFlow: CashFlowPoint[] = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const label = d.toLocaleDateString("pt-BR", { month: "short" });
    const y = d.getFullYear();
    const m = d.getMonth();
    const rows = (sixMonthRaw ?? []).filter((t) => {
      const td = new Date(t.created_at);
      return td.getFullYear() === y && td.getMonth() === m;
    });
    return {
      month: label.replace(".", ""),
      income:   rows.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0),
      expenses: rows.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0),
    };
  });

  // Expense breakdown by category for current month (paid only)
  const all = allMonthly ?? [];
  const transactions = filteredTransactions ?? [];

  type RawRow = Pick<Transaction, "amount" | "type" | "status" | "created_at">;
  const currentMonthExpenses = (sixMonthRaw ?? []).filter((t: RawRow) => {
    const td = new Date(t.created_at);
    return td.getFullYear() === now.getFullYear() && td.getMonth() === now.getMonth() && t.type === "expense";
  });

  const { data: currentMonthCatRaw } = await admin
    .from("financial_transactions")
    .select("amount, category")
    .gte("created_at", monthStart)
    .lte("created_at", monthEnd)
    .eq("type", "expense")
    .eq("status", "paid")
    .returns<{ amount: number; category: string }[]>();

  const categoryTotals: Record<string, number> = {};
  for (const row of currentMonthCatRaw ?? []) {
    const label = CATEGORY_LABELS[row.category] ?? row.category;
    categoryTotals[label] = (categoryTotals[label] ?? 0) + Number(row.amount);
  }
  const expensesByCategory: ExpenseSlice[] = Object.entries(categoryTotals)
    .map(([category, value]) => ({ category, value }))
    .sort((a, b) => b.value - a.value);

  // Count distinct months with any paid data for the AI projection progress bar
  const monthsWithData = new Set(
    (sixMonthRaw ?? []).map((t) => {
      const d = new Date(t.created_at);
      return `${d.getFullYear()}-${d.getMonth()}`;
    })
  ).size;

  const monthlyIncome   = all.filter((t) => t.type === "income"  && t.status === "paid").reduce((s, t) => s + Number(t.amount), 0);
  const monthlyExpenses = all.filter((t) => t.type === "expense" && t.status === "paid").reduce((s, t) => s + Number(t.amount), 0);
  const pendingIncome   = all.filter((t) => t.type === "income"  && t.status === "pending").reduce((s, t) => s + Number(t.amount), 0);
  const netBalance      = monthlyIncome - monthlyExpenses;
  const isPositive      = netBalance >= 0;

  const currentMonthLabel = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-1">
          Financeiro
        </p>
        <h1 className="text-2xl font-bold text-white tracking-tight capitalize">
          {currentMonthLabel}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Resumo de receitas e despesas do mês atual.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card padding="md">
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <ArrowTrendingUpIcon className="w-5 h-5 text-primary" />
            </div>
            <span className="text-[10px] font-semibold text-primary uppercase tracking-widest">Mês</span>
          </div>
          <p className="text-2xl font-bold text-white tabular-nums">{formatCurrency(monthlyIncome)}</p>
          <p className="text-xs text-zinc-500 mt-1">Receita confirmada</p>
        </Card>

        <Card padding="md">
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-2xl bg-danger/10 flex items-center justify-center">
              <ArrowTrendingDownIcon className="w-5 h-5 text-danger" />
            </div>
            <span className="text-[10px] font-semibold text-danger uppercase tracking-widest">Mês</span>
          </div>
          <p className="text-2xl font-bold text-white tabular-nums">{formatCurrency(monthlyExpenses)}</p>
          <p className="text-xs text-zinc-500 mt-1">Despesas pagas</p>
        </Card>

        <Card padding="md">
          <div className="flex items-start justify-between mb-4">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isPositive ? "bg-primary/10" : "bg-danger/10"}`}>
              <BanknotesIcon className={`w-5 h-5 ${isPositive ? "text-primary" : "text-danger"}`} />
            </div>
          </div>
          <p className={`text-2xl font-bold tabular-nums ${isPositive ? "text-primary" : "text-danger"}`}>
            {isPositive ? "+" : ""}{formatCurrency(netBalance)}
          </p>
          <p className="text-xs text-zinc-500 mt-1">Saldo líquido</p>
        </Card>

        <Card padding="md">
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-2xl bg-zinc-800 flex items-center justify-center">
              <ClockIcon className="w-5 h-5 text-zinc-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-zinc-300 tabular-nums">{formatCurrency(pendingIncome)}</p>
          <p className="text-xs text-zinc-500 mt-1">A receber</p>
        </Card>
      </div>

      {/* BI Charts */}
      <FinancialCharts
        cashFlow={cashFlow}
        expensesByCategory={expensesByCategory}
        historicalMonths={monthsWithData}
      />

      {/* Filter bar + Novo Lançamento drawer trigger */}
      <FinanceControls
        currentFilter={filter}
        members={members ?? []}
        transactions={transactions}
      />

      {/* Transactions table */}
      <Card padding="sm" className="overflow-hidden !p-0">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Lançamentos do Mês</h2>
          <span className="text-xs text-zinc-600">{transactions.length} registros</span>
        </div>

        {transactions.length === 0 ? (
          <div className="p-12 flex flex-col items-center gap-3 text-center">
            <BanknotesIcon className="w-10 h-10 text-zinc-700" />
            <p className="text-sm text-zinc-500">Nenhum lançamento encontrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Descrição</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden sm:table-cell">Categoria</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden md:table-cell">Vencimento</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-surface-2/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.type === "income" ? "bg-primary" : "bg-danger"}`} />
                        <span className="text-zinc-300 font-medium">
                          {t.description || CATEGORY_LABELS[t.category] || t.category}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 hidden sm:table-cell">
                      <span className="text-zinc-500 text-xs">{CATEGORY_LABELS[t.category] ?? t.category}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[t.status] ?? STATUS_STYLES.pending}`}>
                        {STATUS_LABELS[t.status] ?? t.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <span className="text-zinc-500 text-xs tabular-nums">{formatDate(t.due_date)}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-semibold tabular-nums ${t.type === "income" ? "text-primary" : "text-danger"}`}>
                        {t.type === "income" ? "+" : "−"}{formatCurrency(Number(t.amount))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Overdue panel */}
      {overdueTransactions && overdueTransactions.length > 0 && (
        <Card padding="sm" className="overflow-hidden !p-0 border-danger/20">
          <div className="px-6 py-4 border-b border-danger/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
              <h2 className="text-sm font-semibold text-danger">Vencimentos em Atraso</h2>
            </div>
            <span className="text-xs text-danger/60">
              {overdueTransactions.length} pendente{overdueTransactions.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-white/5">
                {overdueTransactions.map((t: Transaction) => (
                  <tr key={t.id} className="hover:bg-surface-2/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-zinc-300 font-medium">
                        {t.description || CATEGORY_LABELS[t.category] || t.category}
                      </span>
                    </td>
                    <td className="px-4 py-4 hidden sm:table-cell">
                      <span className="text-xs text-zinc-500">{CATEGORY_LABELS[t.category] ?? t.category}</span>
                    </td>
                    <td className="px-4 py-4 text-right hidden md:table-cell">
                      <span className="text-xs text-danger/70 tabular-nums">
                        Venceu em {formatDate(t.due_date)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-semibold text-danger tabular-nums">
                        {t.type === "income" ? "+" : "−"}{formatCurrency(Number(t.amount))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Recurring Expenses Manager */}
      <div data-print-hide className="recurring-manager">
        <RecurringExpensesManager initialExpenses={recurringExpenses ?? []} />
      </div>
    </div>
  );
}
