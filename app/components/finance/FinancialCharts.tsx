"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { SparklesIcon } from "@heroicons/react/24/outline";

// ── Types ────────────────────────────────────────────────────────────────────

export type CashFlowPoint = {
  month: string;   // "Jun", "Mai", etc.
  income: number;
  expenses: number;
};

export type ExpenseSlice = {
  category: string; // PT label
  value: number;
};

type Props = {
  cashFlow: CashFlowPoint[];
  expensesByCategory: ExpenseSlice[];
  historicalMonths: number; // how many months of data exist
};

// ── Colors ───────────────────────────────────────────────────────────────────

const COLOR_INCOME   = "#C1F429"; // --color-primary
const COLOR_EXPENSE  = "#FF6D6D"; // --color-danger
const COLOR_SURFACE  = "#27272A"; // --color-surface-2
const COLOR_TEXT     = "#71717A"; // zinc-500
const COLOR_BORDER   = "rgba(255,255,255,0.05)";

// Slice palette for the donut — cycling through muted tones that work on dark bg
const DONUT_COLORS = [
  "#C1F429", "#18FFC8", "#60A5FA", "#F472B6",
  "#FB923C", "#A78BFA", "#34D399", "#FBBF24",
  "#FF6D6D", "#94A3B8",
];

// ── Formatters ───────────────────────────────────────────────────────────────

function formatBRL(value: number) {
  if (value >= 1000) return `R$${(value / 1000).toFixed(1)}k`;
  return `R$${value.toFixed(0)}`;
}

function formatBRLFull(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

// ── Custom Tooltip ───────────────────────────────────────────────────────────

type CashFlowPayload = { name: string; value: number; color: string };

function CashFlowTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: CashFlowPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#141414] border border-white/10 rounded-2xl px-4 py-3 shadow-2xl text-xs">
      <p className="font-semibold text-white mb-2">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="leading-relaxed">
          {p.name === "income" ? "Receita" : "Despesas"}: {formatBRLFull(p.value)}
        </p>
      ))}
    </div>
  );
}

type DonutPayload = { name: string; value: number };

function DonutTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: DonutPayload[];
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="bg-[#141414] border border-white/10 rounded-2xl px-4 py-3 shadow-2xl text-xs">
      <p className="text-white font-semibold">{entry.name}</p>
      <p className="text-zinc-400 mt-0.5">{formatBRLFull(entry.value)}</p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function FinancialCharts({ cashFlow, expensesByCategory, historicalMonths }: Props) {
  const hasExpenses = expensesByCategory.length > 0;
  const hasFlow     = cashFlow.some((p) => p.income > 0 || p.expenses > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

      {/* ── Fluxo de Caixa (2/3 width on desktop) ── */}
      <div className="lg:col-span-2 bg-surface-1 border border-white/5 rounded-3xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-0.5">
              Últimos 6 meses
            </p>
            <h2 className="text-base font-bold text-white">Fluxo de Caixa</h2>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-primary inline-block" />
              <span className="text-zinc-400">Receita</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-danger inline-block" />
              <span className="text-zinc-400">Despesas</span>
            </span>
          </div>
        </div>

        {!hasFlow ? (
          <div className="flex items-center justify-center h-48 text-sm text-zinc-600">
            Nenhum dado disponível para o período.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={cashFlow}
              barCategoryGap="30%"
              barGap={4}
              margin={{ top: 0, right: 0, left: -16, bottom: 0 }}
            >
              <CartesianGrid vertical={false} stroke={COLOR_BORDER} />
              <XAxis
                dataKey="month"
                tick={{ fill: COLOR_TEXT, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatBRL}
                tick={{ fill: COLOR_TEXT, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip
                content={<CashFlowTooltip />}
                cursor={{ fill: COLOR_SURFACE, radius: 8 }}
              />
              <Bar dataKey="income"   fill={COLOR_INCOME}  radius={[6, 6, 0, 0]} maxBarSize={40} />
              <Bar dataKey="expenses" fill={COLOR_EXPENSE} radius={[6, 6, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Right column: Donut + AI Projection ── */}
      <div className="flex flex-col gap-4">

        {/* Despesas por Categoria */}
        <div className="flex-1 bg-surface-1 border border-white/5 rounded-3xl p-6">
          <div className="mb-4">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-0.5">
              Mês atual
            </p>
            <h2 className="text-base font-bold text-white">Despesas por Categoria</h2>
          </div>

          {!hasExpenses ? (
            <div className="flex items-center justify-center h-32 text-sm text-zinc-600">
              Nenhuma despesa registrada.
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={expensesByCategory}
                    dataKey="value"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={68}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {expensesByCategory.map((_, i) => (
                      <Cell
                        key={i}
                        fill={DONUT_COLORS[i % DONUT_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<DonutTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              {/* Legend */}
              <ul className="space-y-1.5 mt-2">
                {expensesByCategory.slice(0, 5).map((slice, i) => (
                  <li key={slice.category} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-zinc-400 truncate">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
                      />
                      {slice.category}
                    </span>
                    <span className="text-zinc-300 tabular-nums ml-2 flex-shrink-0">
                      {formatBRLFull(slice.value)}
                    </span>
                  </li>
                ))}
                {expensesByCategory.length > 5 && (
                  <li className="text-xs text-zinc-600 pl-4">
                    +{expensesByCategory.length - 5} outras categorias
                  </li>
                )}
              </ul>
            </>
          )}
        </div>

        {/* Projeção Financeira (IA) — placeholder */}
        <div className="bg-surface-1 border border-white/5 rounded-3xl p-5 relative overflow-hidden">
          {/* Subtle glow */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-start gap-3 relative">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <SparklesIcon className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">
                Projeção Financeira (IA)
              </p>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                Disponível após{" "}
                <span className="text-zinc-300 font-medium">3 meses</span>{" "}
                de histórico.{" "}
                {historicalMonths > 0 && (
                  <span className="text-primary">
                    {historicalMonths}/3 {historicalMonths === 1 ? "mês coletado" : "meses coletados"}.
                  </span>
                )}
              </p>
              <div className="mt-3 h-1.5 w-full bg-surface-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary/50 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min((historicalMonths / 3) * 100, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-zinc-600 mt-1.5 uppercase tracking-wider">
                {historicalMonths >= 3 ? "Desbloqueado" : `${3 - historicalMonths} ${3 - historicalMonths === 1 ? "mês restante" : "meses restantes"}`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
