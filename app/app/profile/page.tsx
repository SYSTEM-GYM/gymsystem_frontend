import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import {
  ArrowLeftStartOnRectangleIcon,
  ChevronRightIcon,
  ShoppingBagIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { ProfileEditForm } from "./ProfileEditForm";

export default async function StudentProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // NOTE: e-mail lives only in auth.users (user.email) — public.users has no
  // email column, and selecting one here made PostgREST reject the whole
  // query, blanking the entire profile.
  const { data: profile } = await supabase
    .from("users")
    .select("first_name, last_name, full_name, photo_url, plan_type, phone, created_at, home_gym_id")
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
            className="w-16 h-16 rounded-2xl object-cover shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-surface-2 flex items-center justify-center shrink-0">
            <UserCircleIcon className="w-8 h-8 text-zinc-600" />
          </div>
        )}
        <div>
          <p className="text-lg font-bold text-white">{profile?.full_name ?? "—"}</p>
          <p className="text-sm text-zinc-500">{plan}</p>
        </div>
      </div>

      {/* Editable contact data */}
      <ProfileEditForm
        initialEmail={user.email ?? ""}
        initialPhone={profile?.phone ?? ""}
      />

      {/* Read-only membership info */}
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

      {/* Meus Pedidos */}
      <Link
        href="/app/store/orders"
        className="flex items-center gap-3 p-4 bg-surface-1 border border-white/5 rounded-2xl hover:border-primary/20 transition-colors group"
      >
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <ShoppingBagIcon className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">Meus Pedidos</p>
          <p className="text-xs text-zinc-500 mt-0.5">Histórico de compras na loja</p>
        </div>
        <ChevronRightIcon className="w-4 h-4 text-zinc-600 group-hover:text-primary transition-colors shrink-0" />
      </Link>

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
