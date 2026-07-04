import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PlusIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

export const revalidate = 0;

export default async function WorkoutsPage() {
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

  const admin = createAdminClient();

  const { data: collections } = await admin
    .from("exercise_collections")
    .select("id, name, description, estimated_duration_minutes, created_at, gym_id")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false });

  // Count exercises per collection
  const collectionIds = (collections ?? []).map((c) => c.id);
  const countMap: Record<string, number> = {};

  if (collectionIds.length > 0) {
    const { data: counts } = await admin
      .from("collection_exercises")
      .select("collection_id")
      .in("collection_id", collectionIds);

    for (const row of counts ?? []) {
      countMap[row.collection_id] = (countMap[row.collection_id] ?? 0) + 1;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest">
            Academia
          </p>
          <h1 className="text-2xl font-black text-white mt-0.5">Fichas de Treino</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Crie e gerencie as fichas de exercícios dos alunos.
          </p>
        </div>
        <Link
          href="/dashboard/workouts/new"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-sm font-bold bg-primary text-black hover:scale-105 active:scale-95 transition-transform"
        >
          <PlusIcon className="w-4 h-4" />
          Novo Treino
        </Link>
      </div>

      {(!collections || collections.length === 0) ? (
        <div className="p-16 flex flex-col items-center gap-4 text-center bg-surface-1 border border-dashed border-white/10 rounded-3xl">
          <ClipboardDocumentListIcon className="w-12 h-12 text-zinc-700" />
          <div>
            <p className="text-sm font-semibold text-zinc-500">Nenhuma ficha criada</p>
            <p className="text-xs text-zinc-600 mt-1">
              Monte a primeira ficha de treino para os seus alunos.
            </p>
          </div>
          <Link
            href="/dashboard/workouts/new"
            className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-primary text-black"
          >
            <PlusIcon className="w-4 h-4" />
            Criar Ficha
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(collections ?? []).map((col) => (
            <div
              key={col.id}
              className="bg-surface-1 border border-white/5 rounded-3xl p-5 flex flex-col gap-3 hover:border-white/10 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  <ClipboardDocumentListIcon className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-white text-sm leading-tight truncate">
                    {col.name}
                  </p>
                  {col.description && (
                    <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
                      {col.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-zinc-500">
                <span className="flex items-center gap-1">
                  <ClockIcon className="w-3.5 h-3.5" />
                  {col.estimated_duration_minutes} min
                </span>
                <span>
                  {countMap[col.id] ?? 0} exercício(s)
                </span>
              </div>

              <div className="flex gap-2 pt-1 border-t border-white/5 mt-auto">
                <Link
                  href={`/dashboard/settings?tab=collections`}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-center text-zinc-400 hover:text-white hover:bg-surface-2 transition-colors"
                >
                  Editar
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
