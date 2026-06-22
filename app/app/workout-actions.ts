"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type LogExerciseResult =
  | { ok: true }
  | { ok: false; message: string };

export async function logExerciseExecution(input: {
  exerciseId: string;
  collectionId: string;
  weightKg: number | null;
  repsDone: number | null;
  setsCompleted: number | null;
}): Promise<LogExerciseResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, message: "Não autenticado." };

  const { error } = await supabase.from("workout_execution_logs").insert({
    user_id: user.id,
    exercise_id: input.exerciseId,
    collection_id: input.collectionId,
    weight_kg: input.weightKg,
    reps_done: input.repsDone,
    sets_completed: input.setsCompleted,
    status: "completed",
  });

  if (error) {
    console.error("logExerciseExecution:", error);
    return { ok: false, message: "Erro ao registrar série." };
  }

  revalidatePath("/app");
  return { ok: true };
}

export type SetLogInput = {
  exerciseId: string;
  setNumber: number;
  weightKg: number | null;
  repsCompleted: number | null;
};

export type SaveWorkoutLogResult =
  | { ok: true; workoutLogId: string; xpAwarded: number; newStreak: number }
  | { ok: false; message: string };

function streakMultiplier(streak: number): number {
  if (streak >= 60) return 5;
  if (streak >= 30) return 3;
  if (streak >= 10) return 2;
  if (streak >= 5) return 1.5;
  return 1;
}

async function updateStreakAndXP(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<{ xpAwarded: number; newStreak: number }> {
  const today = new Date().toISOString().slice(0, 10);

  const { data: profile } = await supabase
    .from("users")
    .select("experience_points, current_streak, longest_streak, last_workout_date")
    .eq("id", userId)
    .single();

  if (!profile) return { xpAwarded: 0, newStreak: 0 };

  const lastDate = profile.last_workout_date as string | null;
  const currentStreak = (profile.current_streak as number) ?? 0;
  const longestStreak = (profile.longest_streak as number) ?? 0;
  const currentXP = (profile.experience_points as number) ?? 0;

  // Already worked out today — no extra XP
  if (lastDate === today) return { xpAwarded: 0, newStreak: currentStreak };

  const yd = new Date();
  yd.setDate(yd.getDate() - 1);
  const yesterdayStr = yd.toISOString().slice(0, 10);

  let newStreak: number;
  let xpDelta: number;

  if (!lastDate || lastDate === yesterdayStr) {
    // Consecutive day (or first-ever workout)
    newStreak = currentStreak + 1;
    xpDelta = Math.round(50 * streakMultiplier(newStreak));
  } else {
    // Streak broken
    const penalty =
      lastDate < yesterdayStr && currentStreak >= 5
        ? Math.round(currentXP * 0.1)
        : 0;
    newStreak = 1;
    xpDelta = 50 - penalty;
  }

  const newXP = Math.max(0, currentXP + xpDelta);
  const newLongest = Math.max(longestStreak, newStreak);

  await supabase
    .from("users")
    .update({
      experience_points: newXP,
      current_streak: newStreak,
      longest_streak: newLongest,
      last_workout_date: today,
    })
    .eq("id", userId);

  return { xpAwarded: Math.max(0, xpDelta), newStreak };
}

export async function saveWorkoutLog(input: {
  collectionId: string;
  startedAt: string;
  sets: SetLogInput[];
}): Promise<SaveWorkoutLogResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Não autenticado." };

  const { data: workoutLog, error: wlError } = await supabase
    .from("workout_logs")
    .insert({
      student_id: user.id,
      collection_id: input.collectionId,
      started_at: input.startedAt,
      finished_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (wlError || !workoutLog) {
    console.error("saveWorkoutLog insert workout_logs:", wlError);
    return { ok: false, message: "Erro ao salvar sessão de treino." };
  }

  if (input.sets.length > 0) {
    const { error: slError } = await supabase.from("set_logs").insert(
      input.sets.map((s) => ({
        workout_log_id: workoutLog.id,
        exercise_id: s.exerciseId,
        set_number: s.setNumber,
        weight_kg: s.weightKg,
        reps_completed: s.repsCompleted,
      })),
    );

    if (slError) {
      console.error("saveWorkoutLog insert set_logs:", slError);
      return { ok: false, message: "Erro ao salvar séries." };
    }
  }

  // Keep workout_execution_logs in sync for admin history view
  const exerciseAgg: Record<
    string,
    { weight: number | null; reps: number | null; sets: number }
  > = {};
  for (const s of input.sets) {
    if (!exerciseAgg[s.exerciseId]) {
      exerciseAgg[s.exerciseId] = {
        weight: s.weightKg,
        reps: s.repsCompleted,
        sets: 0,
      };
    }
    exerciseAgg[s.exerciseId].sets += 1;
  }
  await supabase.from("workout_execution_logs").insert(
    Object.entries(exerciseAgg).map(([exerciseId, agg]) => ({
      user_id: user.id,
      exercise_id: exerciseId,
      collection_id: input.collectionId,
      weight_kg: agg.weight,
      reps_done: agg.reps,
      sets_completed: agg.sets,
      status: "completed",
    })),
  );

  const { xpAwarded, newStreak } = await updateStreakAndXP(supabase, user.id);

  revalidatePath("/app");
  return { ok: true, workoutLogId: workoutLog.id, xpAwarded, newStreak };
}

export async function getLastExerciseLog(
  exerciseId: string,
): Promise<{ weight_kg: number | null; reps_done: number | null } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("workout_execution_logs")
    .select("weight_kg, reps_done")
    .eq("user_id", user.id)
    .eq("exercise_id", exerciseId)
    .order("logged_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

export type MuscleVolume = Record<string, number>;

export async function getMuscleHeatmapData(): Promise<MuscleVolume> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const since = new Date();
  since.setDate(since.getDate() - 15);

  const { data: wlogs } = await supabase
    .from("workout_logs")
    .select("id")
    .eq("student_id", user.id)
    .gte("created_at", since.toISOString());

  const wlogIds = (wlogs ?? []).map((w: { id: string }) => w.id);
  if (wlogIds.length === 0) return {};

  const { data: sets } = await supabase
    .from("set_logs")
    .select("weight_kg, reps_completed, exercise:exercise_id(primary_muscle)")
    .in("workout_log_id", wlogIds);

  const volume: MuscleVolume = {};
  for (const row of sets ?? []) {
    const ex = row.exercise as unknown as { primary_muscle: string | null } | null;
    const muscle = ex?.primary_muscle;
    if (!muscle) continue;
    const vol =
      ((row.weight_kg as number | null) ?? 20) *
      ((row.reps_completed as number | null) ?? 1);
    volume[muscle] = (volume[muscle] ?? 0) + vol;
  }

  return volume;
}
