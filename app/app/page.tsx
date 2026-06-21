import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ExerciseList, type Exercise } from "@/app/components/app/ExerciseList";
import { TodayWorkout } from "@/app/components/app/TodayWorkout";
import { resolveTodayWorkout } from "@/lib/workout-utils";

export const revalidate = 60;

const LEVELS = [
  { min: 0, label: "Iniciante", color: "text-zinc-400" },
  { min: 500, label: "Intermediário", color: "text-primary" },
  { min: 1500, label: "Avançado", color: "text-yellow-400" },
  { min: 3000, label: "Elite", color: "text-orange-400" },
  { min: 6000, label: "Lendário", color: "text-red-400" },
];

function resolveLevel(xp: number) {
  let level = LEVELS[0];
  let index = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].min) {
      level = LEVELS[i];
      index = i;
    }
  }
  const next = LEVELS[index + 1];
  const progress = next
    ? Math.min(100, Math.round(((xp - level.min) / (next.min - level.min)) * 100))
    : 100;
  return { label: level.label, color: level.color, levelNum: index + 1, progress, nextXp: next?.min ?? null };
}

export default async function StudentHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("first_name, full_name, experience_points, plan_type")
    .eq("id", user.id)
    .single();

  const firstName = profile?.first_name ?? profile?.full_name?.split(" ")[0] ?? "Aluno";
  const xp = profile?.experience_points ?? 0;
  const { label: levelLabel, color: levelColor, levelNum, progress, nextXp } = resolveLevel(xp);

  const planLabels: Record<string, string> = { basic: "Básico", premium: "Premium", vip: "VIP" };
  const planLabel = planLabels[profile?.plan_type ?? ""] ?? (profile?.plan_type ?? "");

  const todayWorkout = await resolveTodayWorkout(supabase, user.id);

  const lastLogs: Record<string, { weight_kg: number | null; reps_done: number | null }> = {};
  if (todayWorkout && todayWorkout.exercises.length > 0) {
    const exerciseIds = todayWorkout.exercises.map((e) => e.exercise_id);
    const { data: logs } = await supabase
      .from("workout_execution_logs")
      .select("exercise_id, weight_kg, reps_done, logged_at")
      .eq("user_id", user.id)
      .in("exercise_id", exerciseIds)
      .order("logged_at", { ascending: false });

    for (const log of logs ?? []) {
      if (!lastLogs[log.exercise_id]) {
        lastLogs[log.exercise_id] = {
          weight_kg: log.weight_kg,
          reps_done: log.reps_done,
        };
      }
    }
  }

  const { data: exercises } = await supabase
    .from("exercises")
    .select("id, title, description, youtube_url, webm_path")
    .order("title")
    .returns<Exercise[]>();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest">
          Bem-vindo de volta
        </p>
        <h1 className="text-2xl font-black text-white mt-0.5">
          Olá, {firstName} 👋
        </h1>
        {planLabel && (
          <p className="text-sm text-zinc-500 mt-1">Plano {planLabel}</p>
        )}
      </div>

      <div className="bg-surface-1 border border-white/5 rounded-3xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wide">Nível {levelNum}</p>
            <p className={`text-lg font-black ${levelColor}`}>{levelLabel}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-500">XP Total</p>
            <p className="text-xl font-bold text-white tabular-nums">
              {xp.toLocaleString("pt-BR")}
            </p>
          </div>
        </div>
        <div>
          <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
          {nextXp !== null && (
            <p className="mt-1.5 text-[10px] text-zinc-600">
              {(nextXp - xp).toLocaleString("pt-BR")} XP para o próximo nível
            </p>
          )}
        </div>
      </div>

      {todayWorkout ? (
        <TodayWorkout workout={todayWorkout} lastLogs={lastLogs} />
      ) : (
        <div className="p-6 bg-surface-1 border border-dashed border-white/10 rounded-3xl text-center">
          <p className="text-sm font-semibold text-zinc-500">Nenhum treino agendado para hoje</p>
          <p className="text-xs text-zinc-600 mt-1">
            Peça ao seu personal para atribuir uma ficha de treino.
          </p>
        </div>
      )}

      <div>
        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-3">
          Biblioteca de Exercícios
        </h2>
        <ExerciseList exercises={exercises ?? []} />
      </div>
    </div>
  );
}
