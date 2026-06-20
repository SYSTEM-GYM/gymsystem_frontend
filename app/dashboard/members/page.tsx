import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/Card";
import { StatusToggleButton } from "./StatusToggleButton";
import { RegisterStudentTrigger } from "./RegisterStudentTrigger";
import { UsersIcon } from "@heroicons/react/24/outline";

type Member = {
  id: string;
  full_name: string;
  first_name: string | null;
  photo_url: string | null;
  phone: string | null;
  plan_type: string;
  status: string;
  experience_points: number;
  created_at: string;
};

const PLAN_LABELS: Record<string, string> = {
  basic: "Básico",
  premium: "Premium",
  vip: "VIP",
};

const STATUS_STYLES: Record<string, string> = {
  active:   "bg-primary/10 text-primary border border-primary/20",
  inactive: "bg-zinc-700/30 text-zinc-400 border border-zinc-700/50",
  blocked:  "bg-danger/10 text-danger border border-danger/20",
};

const STATUS_LABELS: Record<string, string> = {
  active:   "Ativo",
  inactive: "Inativo",
  blocked:  "Bloqueado",
};

export default async function MembersPage() {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: members, error } = await admin
    .from("users")
    .select("id, full_name, first_name, photo_url, phone, plan_type, status, experience_points, created_at")
    .order("created_at", { ascending: false })
    .returns<Member[]>();

  const totalActive   = members?.filter((m) => m.status === "active").length ?? 0;
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
            Gerencie o cadastro e status de acesso dos alunos.
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

      {/* Members table */}
      <Card padding="sm" className="overflow-hidden !p-0">
        {error && (
          <div className="p-6 text-sm text-danger">
            Erro ao carregar membros. Verifique as credenciais do servidor.
          </div>
        )}

        {!error && (!members || members.length === 0) && (
          <div className="p-12 flex flex-col items-center gap-3 text-center">
            <UsersIcon className="w-10 h-10 text-zinc-700" />
            <p className="text-sm text-zinc-500">Nenhum aluno matriculado ainda.</p>
            <p className="text-xs text-zinc-600">
              Use o botão &ldquo;Matricular Aluno&rdquo; para adicionar o primeiro.
            </p>
          </div>
        )}

        {!error && members && members.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Aluno
                  </th>
                  <th className="text-left px-4 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden sm:table-cell">
                    Plano
                  </th>
                  <th className="text-left px-4 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right px-4 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden md:table-cell">
                    XP
                  </th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {members.map((member) => (
                  <tr
                    key={member.id}
                    className="hover:bg-surface-2/50 transition-colors group"
                  >
                    {/* Aluno */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {member.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={member.photo_url}
                            alt={member.full_name}
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center flex-shrink-0 text-xs font-bold text-zinc-400 group-hover:bg-zinc-700 transition-colors">
                            {member.full_name?.charAt(0).toUpperCase() ?? "?"}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-white leading-tight">
                            {member.full_name || "—"}
                          </p>
                          {member.phone && (
                            <p className="text-xs text-zinc-600 mt-0.5">{member.phone}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Plano */}
                    <td className="px-4 py-4 hidden sm:table-cell">
                      <span className="text-zinc-300">
                        {PLAN_LABELS[member.plan_type] ?? member.plan_type}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          STATUS_STYLES[member.status] ?? STATUS_STYLES.inactive
                        }`}
                      >
                        {STATUS_LABELS[member.status] ?? member.status}
                      </span>
                    </td>

                    {/* XP */}
                    <td className="px-4 py-4 text-right hidden md:table-cell">
                      <span className="text-zinc-400 tabular-nums">
                        {member.experience_points.toLocaleString("pt-BR")}
                      </span>
                    </td>

                    {/* Ações */}
                    <td className="px-6 py-4 text-right">
                      <StatusToggleButton
                        userId={member.id}
                        currentStatus={member.status}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
