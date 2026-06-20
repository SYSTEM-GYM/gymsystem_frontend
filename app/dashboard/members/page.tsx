import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/Card";
import { RegisterStudentTrigger } from "./RegisterStudentTrigger";
import { MembersTable, type MemberRow } from "./MembersTable";
import { UsersIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

export default async function MembersPage() {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) redirect("/login");

  // Fetch the admin's own profile to check gym assignment
  const { data: adminProfile } = await authClient
    .from("users")
    .select("role, home_gym_id")
    .eq("id", user.id)
    .single();

  if (!adminProfile || adminProfile.role !== "admin") redirect("/login");

  // Warn if admin has no gym assigned yet
  if (!adminProfile.home_gym_id) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-1">
            Gerenciamento
          </p>
          <h1 className="text-2xl font-bold text-white tracking-tight">Membros</h1>
        </div>
        <div className="flex items-start gap-3 p-5 bg-yellow-500/10 border border-yellow-500/20 rounded-3xl">
          <ExclamationTriangleIcon className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-300">
            Atenção: Você precisa cadastrar e vincular uma Filial ao seu perfil de Admin antes de
            gerenciar membros. Acesse{" "}
            <a href="/dashboard/settings?tab=gyms" className="underline font-semibold">
              Configurações → Filiais
            </a>{" "}
            para começar.
          </p>
        </div>
      </div>
    );
  }

  const admin = createAdminClient();
  const { data: members, error } = await admin
    .from("users")
    .select(
      "id, full_name, first_name, last_name, photo_url, phone, cpf, birth_date, weight, height, plan_type, status, experience_points, medical_notes, created_at"
    )
    .order("created_at", { ascending: false })
    .returns<MemberRow[]>();

  if (error) {
    console.error("[Members Page Error]:", error);
  }

  const totalActive   = members?.filter((m) => m.status === "active").length   ?? 0;
  const totalInactive = members?.filter((m) => m.status === "inactive").length ?? 0;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-1">
            Gerenciamento
          </p>
          <h1 className="text-2xl font-bold text-white tracking-tight">Membros</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Cadastre e gerencie os alunos da academia.
          </p>
        </div>
        <RegisterStudentTrigger />
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card padding="sm" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <UsersIcon className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xl font-bold text-white">{members?.length ?? 0}</p>
            <p className="text-xs text-zinc-500">Total</p>
          </div>
        </Card>
        <Card padding="sm" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-primary" />
          </div>
          <div>
            <p className="text-xl font-bold text-primary">{totalActive}</p>
            <p className="text-xs text-zinc-500">Ativos</p>
          </div>
        </Card>
        <Card padding="sm" className="flex items-center gap-3 col-span-2 sm:col-span-1">
          <div className="w-8 h-8 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-zinc-500" />
          </div>
          <div>
            <p className="text-xl font-bold text-zinc-400">{totalInactive}</p>
            <p className="text-xs text-zinc-500">Inativos</p>
          </div>
        </Card>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-6 bg-danger/10 border border-danger/20 rounded-3xl text-sm text-danger">
          Erro ao carregar membros. Verifique as credenciais do servidor.
        </div>
      )}

      {/* Search + table (client component) */}
      {!error && (
        <MembersTable members={members ?? []} />
      )}
    </div>
  );
}
