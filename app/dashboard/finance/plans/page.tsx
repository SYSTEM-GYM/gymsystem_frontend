import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlans } from "@/app/dashboard/finance/subscription-actions";
import { CreatePlanButton } from "@/app/components/finance/SubscriptionControls";
import { Card } from "@/components/ui/Card";
import {
  ArrowLeftIcon,
  CreditCardIcon,
  TicketIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

export const revalidate = 0;

type DailyPassRow = {
  id: string;
  student_name: string;
  valid_for_date: string;
  purchased_at: string;
  status: "available" | "used" | "expired";
};

function fmt(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function fmtDate(dateStr: string) {
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
  available: "bg-primary/10 text-primary border border-primary/20",
  used: "bg-zinc-700/30 text-zinc-400 border border-zinc-700/50",
  expired: "bg-zinc-900/30 text-zinc-600 border border-zinc-800",
};

const PASS_STATUS_LABELS: Record<string, string> = {
  available: "Disponível",
  used: "Utilizado",
  expired: "Expirado",
};

const PASS_STATUS_ICONS: Record<string, React.ElementType> = {
  available: CheckCircleIcon,
  used: ClockIcon,
  expired: XCircleIcon,
};

async function getDailyPasses(): Promise<DailyPassRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("daily_passes")
    .select(
      "id, valid_for_date, purchased_at, status, users!daily_passes_student_id_fkey(full_name)"
    )
    .order("valid_for_date", { ascending: false })
    .limit(50);

  return (data ?? []).map((row: any) => {
    const user = Array.isArray(row.users) ? row.users[0] : row.users;
    return {
      id: row.id,
      student_name: user?.full_name ?? "—",
      valid_for_date: row.valid_for_date,
      purchased_at: row.purchased_at,
      status: row.status as DailyPassRow["status"],
    };
  });
}

export default async function PlansPage() {
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

  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const [plans, dailyPasses] = await Promise.all([getPlans(), getDailyPasses()]);

  const availableCount = dailyPasses.filter((p) => p.status === "available").length;
  const usedTodayCount = dailyPasses.filter(
    (p) =>
      p.status === "used" &&
      p.valid_for_date === new Date().toISOString().split("T")[0]
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/dashboard/finance/subscriptions"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors mb-3"
          >
            <ArrowLeftIcon className="w-3.5 h-3.5" />
            Assinaturas & Faturas
          </Link>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Planos & Passes
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Gerencie planos de assinatura e passes avulsos.
          </p>
        </div>
        <CreatePlanButton plans={plans} />
      </div>

      {/* Plans table */}
      <Card padding="sm" className="overflow-hidden !p-0">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCardIcon className="w-4 h-4 text-zinc-500" />
            <h2 className="text-sm font-semibold text-white">Planos de Assinatura</h2>
          </div>
          <span className="text-xs text-zinc-600">{plans.length} plano{plans.length !== 1 ? "s" : ""}</span>
        </div>

        {plans.length === 0 ? (
          <div className="p-10 text-center">
            <CreditCardIcon className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
            <p className="text-sm text-zinc-500">
              Nenhum plano cadastrado. Crie o primeiro plano.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Ciclo
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Valor
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    MRR equiv.
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {plans.map((plan) => {
                  const mrrEquiv =
                    plan.billing_cycle === "monthly"
                      ? plan.price
                      : plan.billing_cycle === "quarterly"
                      ? plan.price / 3
                      : plan.price / 12;

                  return (
                    <tr key={plan.id} className="hover:bg-surface-2/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-zinc-200">{plan.name}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs text-zinc-500">
                          {CYCLE_LABELS[plan.billing_cycle]}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="font-semibold text-primary tabular-nums">
                          {fmt(plan.price)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-xs text-zinc-500 tabular-nums">
                          {fmt(mrrEquiv)}/mês
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            plan.active
                              ? "bg-primary/10 text-primary border border-primary/20"
                              : "bg-zinc-700/30 text-zinc-500 border border-zinc-700/50"
                          }`}
                        >
                          {plan.active ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Daily passes stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card padding="md">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <TicketIcon className="w-4.5 h-4.5 text-primary" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white tabular-nums">{availableCount}</p>
          <p className="text-xs text-zinc-500 mt-1">Passes disponíveis</p>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-zinc-700/30 flex items-center justify-center">
              <CheckCircleIcon className="w-4.5 h-4.5 text-zinc-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white tabular-nums">{usedTodayCount}</p>
          <p className="text-xs text-zinc-500 mt-1">Passes usados hoje</p>
        </Card>
      </div>

      {/* Daily passes table */}
      <Card padding="sm" className="overflow-hidden !p-0">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TicketIcon className="w-4 h-4 text-zinc-500" />
            <h2 className="text-sm font-semibold text-white">Passes Diários</h2>
          </div>
          <span className="text-xs text-zinc-600">{dailyPasses.length} registros</span>
        </div>

        {dailyPasses.length === 0 ? (
          <div className="p-10 text-center">
            <TicketIcon className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
            <p className="text-sm text-zinc-500">Nenhum passe avulso registrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Aluno
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Data de Uso
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden sm:table-cell">
                    Comprado em
                  </th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {dailyPasses.map((pass) => {
                  const Icon = PASS_STATUS_ICONS[pass.status] ?? TicketIcon;
                  return (
                    <tr key={pass.id} className="hover:bg-surface-2/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="font-medium text-zinc-300">{pass.student_name}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs text-zinc-400 tabular-nums">
                          {fmtDate(pass.valid_for_date)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 hidden sm:table-cell">
                        <span className="text-xs text-zinc-600 tabular-nums">
                          {fmtDate(pass.purchased_at)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                            PASS_STATUS_STYLES[pass.status]
                          }`}
                        >
                          <Icon className="w-3 h-3" />
                          {PASS_STATUS_LABELS[pass.status]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
