import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { QRCodeGenerator } from "@/app/components/access/QRCodeGenerator";
import { ArrowUpRightIcon } from "@heroicons/react/24/outline";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, plan_type, experience_points")
    .eq("id", user.id)
    .single();

  const displayName = profile?.full_name
    ? profile.full_name.split(" ")[0]
    : user.email;

  const formattedXP = (profile?.experience_points ?? 0).toLocaleString("pt-BR");
  const formattedPlan = formatPlan(profile?.plan_type);

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-1">
          Painel
        </p>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Olá, {displayName} 👋
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Aqui está o resumo da sua academia hoje.
        </p>
      </div>

      {/* Main content — QR + stats side by side on larger screens */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* QR Access Pass — takes up 1 column */}
        <Card className="flex items-center justify-center py-8">
          <QRCodeGenerator />
        </Card>

        {/* Stats column — takes up 2 columns */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 content-start">
          {/* Plan card */}
          <Card className="flex flex-col justify-between gap-6">
            <div className="flex items-start justify-between">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Plano atual
              </p>
              <ArrowUpRightIcon className="w-4 h-4 text-zinc-600" />
            </div>
            <div>
              <p className="text-3xl font-bold text-primary">{formattedPlan}</p>
              <p className="text-xs text-zinc-600 mt-1">Assinatura ativa</p>
            </div>
          </Card>

          {/* XP card */}
          <Card className="flex flex-col justify-between gap-6">
            <div className="flex items-start justify-between">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Pontos de experiência
              </p>
              <ArrowUpRightIcon className="w-4 h-4 text-zinc-600" />
            </div>
            <div>
              <p className="text-3xl font-bold text-primary">
                {formattedXP}
                <span className="font-normal text-zinc-500 ml-1.5">
                  XP
                </span>
              </p>
              <p className="text-xs text-zinc-600 mt-1">
                Gamificação — check-ins
              </p>
            </div>
          </Card>

          {/* Occupancy card */}
          <Card className="flex flex-col justify-between gap-6 sm:col-span-2">
            <div className="flex items-start justify-between">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Ocupação atual
              </p>
              <ArrowUpRightIcon className="w-4 h-4 text-zinc-600" />
            </div>
            <div>
              <p className="text-3xl font-bold text-white">
                —
                <span className="font-normal text-zinc-500 ml-1.5">
                  alunos
                </span>
              </p>
              <p className="text-xs text-zinc-600 mt-1">
                Módulo de ocupação em breve
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function formatPlan(plan?: string) {
  const labels: Record<string, string> = {
    basic: "Básico",
    premium: "Premium",
    vip: "VIP",
  };
  return labels[plan ?? ""] ?? "—";
}
