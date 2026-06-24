import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { ArrowLeftStartOnRectangleIcon, UserCircleIcon } from "@heroicons/react/24/outline";

export default async function StudentProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("first_name, last_name, full_name, photo_url, plan_type, email, phone, created_at, home_gym_id")
    .eq("id", user.id)
    .single();

  const planLabels: Record<string, string> = { basic: "Básico", premium: "Premium", vip: "VIP" };
  const plan = planLabels[profile?.plan_type ?? ""] ?? (profile?.plan_type ?? "—");

  let gymName: string | null = null;
  if (profile?.home_gym_id) {
    const { data: gym } = await supabase
      .from("gyms")
      .select("name")
      .eq("id", profile.home_gym_id)
      .single();
    gymName = gym?.name ?? null;
  }

  const infoRows = [
    { label: "E-mail",      value: user.email ?? "—" },
    { label: "Telefone",    value: profile?.phone ?? "—" },
    { label: "Plano",       value: plan },
    ...(gymName ? [{ label: "Filial",  value: gymName }] : []),
    { label: "Membro desde", value: profile?.created_at
        ? new Date(profile.created_at).toLocaleDateString("pt-BR")
        : "—" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Conta</p>
        <h1 className="text-2xl font-black text-white mt-0.5">Meu Perfil</h1>
      </div>

      {/* Avatar + name */}
      <div className="flex items-center gap-4 p-5 bg-surface-1 border border-white/5 rounded-3xl">
        {profile?.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.photo_url}
            alt={profile.full_name ?? ""}
            className="w-16 h-16 rounded-2xl object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-surface-2 flex items-center justify-center flex-shrink-0">
            <UserCircleIcon className="w-8 h-8 text-zinc-600" />
          </div>
        )}
        <div>
          <p className="text-lg font-bold text-white">{profile?.full_name ?? "—"}</p>
          <p className="text-sm text-zinc-500">{plan}</p>
        </div>
      </div>

      {/* Info */}
      <div className="bg-surface-1 border border-white/5 rounded-3xl overflow-hidden">
        <dl>
          {infoRows.map(({ label, value }, i) => (
            <div
              key={label}
              className={`flex items-center justify-between px-5 py-4 ${
                i < infoRows.length - 1 ? "border-b border-white/5" : ""
              }`}
            >
              <dt className="text-xs text-zinc-500 uppercase tracking-wide">{label}</dt>
              <dd className="text-sm text-white">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Sign out */}
      <form action={signOut}>
        <button
          type="submit"
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold text-danger border border-danger/20 hover:bg-danger/10 transition-colors"
        >
          <ArrowLeftStartOnRectangleIcon className="w-4 h-4" />
          Sair da Conta
        </button>
      </form>
    </div>
  );
}
