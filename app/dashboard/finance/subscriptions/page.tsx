import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getSubscriptionKpis,
  getInvoices,
  getPlans,
} from "@/app/dashboard/finance/subscription-actions";
import {
  InadimplentesTable,
  RecentInvoicesTable,
  InvoiceControlButtons,
  CreatePlanButton,
} from "@/app/components/finance/SubscriptionControls";
import { Card } from "@/components/ui/Card";
import {
  BanknotesIcon,
  UserGroupIcon,
  ExclamationTriangleIcon,
  ArrowLeftIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";

export const revalidate = 0;

function fmt(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default async function SubscriptionsPage() {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await authClient
    .from("users").select("role").eq("id", user.id).single();

  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const [kpis, overdueInvoices, recentInvoices, plans] = await Promise.all([
    getSubscriptionKpis(),
    getInvoices("overdue", 50),
    getInvoices("all", 30),
    getPlans(),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/dashboard/finance"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors mb-3"
          >
            <ArrowLeftIcon className="w-3.5 h-3.5" />
            Financeiro
          </Link>
          <h1 className="text-2xl font-bold text-white tracking-tight">Assinaturas & Faturas</h1>
          <p className="text-sm text-zinc-500 mt-1">Planos, inadimplência e controle de recorrência.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/dashboard/finance/plans"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-semibold hover:bg-zinc-700 transition-colors"
          >
            Planos & Passes
          </Link>
          <CreatePlanButton plans={plans} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card padding="md">
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <ChartBarIcon className="w-5 h-5 text-primary" />
            </div>
            <span className="text-[10px] font-semibold text-primary uppercase tracking-widest">MRR</span>
          </div>
          <p className="text-2xl font-bold text-white tabular-nums">{fmt(kpis.mrr)}</p>
          <p className="text-xs text-zinc-500 mt-1">Receita mensal recorrente</p>
        </Card>

        <Card padding="md">
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <UserGroupIcon className="w-5 h-5 text-primary" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white tabular-nums">{kpis.activeCount}</p>
          <p className="text-xs text-zinc-500 mt-1">Alunos ativos</p>
        </Card>

        <Card padding="md">
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-2xl bg-danger/10 flex items-center justify-center">
              <ExclamationTriangleIcon className="w-5 h-5 text-danger" />
            </div>
            <span className="text-[10px] font-semibold text-danger uppercase tracking-widest">Atenção</span>
          </div>
          <p className="text-2xl font-bold text-white tabular-nums">{fmt(kpis.overdueInvoiceTotal)}</p>
          <p className="text-xs text-zinc-500 mt-1">Total em inadimplência</p>
        </Card>

        <Card padding="md">
          <div className="flex items-start justify-between mb-4">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${kpis.defaultRate > 10 ? "bg-danger/10" : "bg-zinc-800"}`}>
              <BanknotesIcon className={`w-5 h-5 ${kpis.defaultRate > 10 ? "text-danger" : "text-zinc-400"}`} />
            </div>
          </div>
          <p className={`text-2xl font-bold tabular-nums ${kpis.defaultRate > 10 ? "text-danger" : "text-zinc-300"}`}>
            {kpis.defaultRate.toFixed(1)}%
          </p>
          <p className="text-xs text-zinc-500 mt-1">Taxa de inadimplência</p>
        </Card>
      </div>

      {/* Sync controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-xs text-zinc-600">
          Use os botões para gerar novas faturas e marcar pendentes como atrasadas.
        </p>
        <InvoiceControlButtons />
      </div>

      {/* Inadimplentes */}
      <Card padding="sm" className="overflow-hidden !p-0 border-danger/20">
        <div className="px-5 py-4 border-b border-danger/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
            <h2 className="text-sm font-semibold text-danger">Inadimplentes</h2>
          </div>
          {kpis.overdueInvoiceCount > 0 && (
            <span className="text-xs font-semibold text-danger/70 bg-danger/10 px-2.5 py-1 rounded-full">
              {kpis.overdueInvoiceCount} aluno{kpis.overdueInvoiceCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <InadimplentesTable invoices={overdueInvoices} />
      </Card>

      {/* Recent Invoices */}
      <Card padding="sm" className="overflow-hidden !p-0">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Faturas Recentes</h2>
          <span className="text-xs text-zinc-600">{recentInvoices.length} registros</span>
        </div>
        <RecentInvoicesTable invoices={recentInvoices} />
      </Card>
    </div>
  );
}
