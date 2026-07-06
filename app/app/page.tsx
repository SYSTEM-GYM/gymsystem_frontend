import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WorkoutShelf } from "@/app/components/app/WorkoutShelf";
import { StreakWidget } from "@/app/components/app/StreakWidget";
import { MuscleRadarChart } from "@/app/components/app/MuscleRadarChart";
import { fetchStudentWorkouts } from "@/lib/workout-utils";
import { getMuscleHeatmapData } from "@/app/app/workout-actions";
import Link from "next/link";
import {
  BookOpenIcon,
  BuildingStorefrontIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

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
    ? Math.min(
        100,
        Math.round(((xp - level.min) / (next.min - level.min)) * 100),
      )
    : 100;
  return {
    label: level.label,
    color: level.color,
    levelNum: index + 1,
    progress,
    nextXp: next?.min ?? null,
  };
}

export default async function StudentHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select(
      "first_name, full_name, experience_points, plan_type, current_streak, longest_streak, last_workout_date",
    )
    .eq("id", user.id)
    .single();

  const firstName =
    profile?.first_name ?? profile?.full_name?.split(" ")[0] ?? "Aluno";
  const xp = (profile?.experience_points as number) ?? 0;
  const currentStreak = (profile?.current_streak as number) ?? 0;
  const longestStreak = (profile?.longest_streak as number) ?? 0;
  const lastWorkoutDate = (profile?.last_workout_date as string | null) ?? null;

  const { label: levelLabel, color: levelColor, levelNum, progress, nextXp } =
    resolveLevel(xp);

  const planLabels: Record<string, string> = {
    basic: "Básico",
    premium: "Premium",
    vip: "VIP",
  };
  const planLabel =
    planLabels[profile?.plan_type ?? ""] ?? (profile?.plan_type ?? "");

  const [workouts, muscleVolume] = await Promise.all([
    fetchStudentWorkouts(supabase, user.id),
    getMuscleHeatmapData(),
  ]);

  // Last logged weight/reps per exercise across every assigned session, so any
  // card the student picks opens pre-filled.
  const lastLogs: Record<
    string,
    { weight_kg: number | null; reps_done: number | null }
  > = {};
  const exerciseIds = [
    ...new Set(
      workouts.flatMap((w) => w.exercises.map((e) => e.exercise_id)),
    ),
  ];
  if (exerciseIds.length > 0) {
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

  return (
    <div className="space-y-6">
      {/* Greeting */}
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

      {/* XP Level Widget */}
      <div className="bg-surface-1 border border-white/5 rounded-3xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wide">
              Nível {levelNum}
            </p>
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

      {/* Streak / Ofensiva */}
      <StreakWidget
        currentStreak={currentStreak}
        longestStreak={longestStreak}
        lastWorkoutDate={lastWorkoutDate}
      />

      {/* Workout Shelf — every assigned session, student picks freely */}
      <WorkoutShelf workouts={workouts} lastLogs={lastLogs} />

      {/* Muscle Radar Chart */}
      <MuscleRadarChart volume={muscleVolume} />

      {/* Store shortcut */}
      <Link
        href="/app/store"
        className="flex items-center gap-3 p-4 bg-surface-1 border border-white/5 rounded-2xl hover:border-primary/20 transition-colors group"
      >
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <BuildingStorefrontIcon className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">Loja da Academia</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Suplementos, roupas e acessórios com retirada na recepção
          </p>
        </div>
        <ChevronRightIcon className="w-4 h-4 text-zinc-600 group-hover:text-primary transition-colors shrink-0" />
      </Link>

      {/* Library shortcut */}
      <Link
        href="/app/library"
        className="flex items-center gap-3 p-4 bg-surface-1 border border-white/5 rounded-2xl hover:border-primary/20 transition-colors group"
      >
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <BookOpenIcon className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">Biblioteca de Exercícios</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Vídeos, instruções e técnicas de todos os exercícios
          </p>
        </div>
        <ChevronRightIcon className="w-4 h-4 text-zinc-600 group-hover:text-primary transition-colors shrink-0" />
      </Link>
    </div>
  );
}
