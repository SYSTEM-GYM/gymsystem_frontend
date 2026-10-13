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
  rowId: string; // collection_exercises.id the set belongs to
  exerciseId: string;
  setNumber: number;
  weightKg: number | null;
  repsCompleted: number | null;
};

export type SaveWorkoutLogResult =
  | { ok: true; workoutLogId: string; xpAwarded: number; newStreak: number }
  | { ok: false; message: string };

function streakMultiplier(streak: number): number {
  if (streak >= 60) return 4;
  if (streak >= 30) return 2.5;
  if (streak >= 14) return 1.75;
  if (streak >= 7) return 1.4;
  if (streak >= 3) return 1.15;
  return 1;
}

const XP_PER_EXERCISE = 7;

// An exercise counts as completed when every planned set of its collection row
// was marked done. Planned sets come from the DB, never from the client.
async function countCompletedExercises(
  supabase: Awaited<ReturnType<typeof createClient>>,
  collectionId: string,
  sets: SetLogInput[],
): Promise<number> {
  const { data: rows } = await supabase
    .from("collection_exercises")
    .select("id, default_sets")
    .eq("collection_id", collectionId);

  const doneSetsByRow: Record<string, Set<number>> = {};
  for (const s of sets) (doneSetsByRow[s.rowId] ??= new Set()).add(s.setNumber);

  return (rows ?? []).filter((r: { id: string; default_sets: number }) => {
    const done = doneSetsByRow[r.id]?.size ?? 0;
    return r.default_sets > 0 && done >= r.default_sets;
  }).length;
}

async function updateStreakAndXP(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  completedExercises: number,
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

  // Nothing completed — not a workout day: no XP, streak untouched, so a real
  // workout later today still counts.
  if (completedExercises === 0) return { xpAwarded: 0, newStreak: currentStreak };

  const baseXP = completedExercises * XP_PER_EXERCISE;

  const yd = new Date();
  yd.setDate(yd.getDate() - 1);
  const yesterdayStr = yd.toISOString().slice(0, 10);

  let newStreak: number;
  let xpDelta: number;

  if (!lastDate || lastDate === yesterdayStr) {
    // Consecutive day (or first-ever workout)
    newStreak = currentStreak + 1;
    xpDelta = Math.round(baseXP * streakMultiplier(newStreak));
  } else {
    // Streak is breaking — check for an approved squad rescue for yesterday
    const { data: rescue } = await supabase
      .from("squad_streak_rescues")
      .select("id")
      .eq("student_id", userId)
      .eq("missed_date", yesterdayStr)
      .eq("status", "approved")
      .maybeSingle();

    if (rescue) {
      // Rescue active: maintain streak, skip penalty, award streak XP
      newStreak = currentStreak + 1;
      xpDelta = Math.round(baseXP * streakMultiplier(newStreak));
    } else {
      // Genuine break — flat penalty, not percentage-based
      const penalty = currentStreak >= 3 ? Math.min(150, Math.round(currentXP * 0.04)) : 0;
      newStreak = 1;
      xpDelta = baseXP - penalty;
    }
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

  const completedExercises = await countCompletedExercises(supabase, input.collectionId, input.sets);
  const { xpAwarded, newStreak } = await updateStreakAndXP(supabase, user.id, completedExercises);

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

// ── Student custom workouts ───────────────────────────────────────────────────

export type StudentExerciseResult = {
  id: string;
  title: string;
  translated_name: string | null;
  muscle_group: string | null;
  youtube_url: string | null;
  webm_path: string | null;
  video_url: string | null;
};

export async function searchStudentExercises(
  query: string,
  muscleGroup: string | null,
): Promise<StudentExerciseResult[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  let q = supabase
    .from("exercises")
    .select("id, title, translated_name, muscle_group, youtube_url, webm_path, video_url")
    .order("translated_name", { ascending: true, nullsFirst: false })
    .limit(48);

  const term = query.trim();
  if (term.length >= 2) {
    q = q.or(`title.ilike.%${term}%,translated_name.ilike.%${term}%`);
  }
  if (muscleGroup) {
    q = q.eq("muscle_group", muscleGroup);
  }

  const { data } = await q;
  return (data ?? []) as StudentExerciseResult[];
}

export type CustomWorkoutExerciseInput = {
  exerciseId: string;
  sets: number;
  reps: number;
};

export type CreateCustomWorkoutResult =
  | { ok: true; collectionId: string }
  | { ok: false; message: string };

export async function createStudentWorkout(input: {
  name: string;
  exercises: CustomWorkoutExerciseInput[];
}): Promise<CreateCustomWorkoutResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Não autenticado." };

  const name = input.name.trim();
  if (name.length < 3) return { ok: false, message: "Dê um nome ao treino (mín. 3 letras)." };
  if (input.exercises.length === 0) {
    return { ok: false, message: "Selecione pelo menos um exercício." };
  }

  // RLS (collections_owner_insert) enforces created_by = auth.uid()
  const { data: collection, error: colError } = await supabase
    .from("exercise_collections")
    .insert({
      name,
      description: "Treino criado pelo aluno",
      estimated_duration_minutes: Math.max(20, input.exercises.length * 8),
      created_by: user.id,
    })
    .select("id")
    .single();

  if (colError || !collection) {
    console.error("createStudentWorkout collection:", colError);
    return { ok: false, message: "Erro ao criar o treino." };
  }

  const { error: exError } = await supabase.from("collection_exercises").insert(
    input.exercises.map((e, idx) => ({
      collection_id: collection.id,
      exercise_id: e.exerciseId,
      sort_order: idx,
      default_sets: Math.min(10, Math.max(1, Math.round(e.sets) || 3)),
      default_reps: Math.min(100, Math.max(1, Math.round(e.reps) || 12)),
    })),
  );

  if (exError) {
    console.error("createStudentWorkout exercises:", exError);
    await supabase.from("exercise_collections").delete().eq("id", collection.id);
    return { ok: false, message: "Erro ao salvar os exercícios do treino." };
  }

  // Schedule row makes it show up on the student's shelf
  const { error: schedError } = await supabase.from("workout_schedules").insert({
    user_id: user.id,
    collection_id: collection.id,
    schedule_type: "custom",
    sort_order: 90,
  });

  if (schedError) {
    console.error("createStudentWorkout schedule:", schedError);
    return { ok: false, message: "Treino criado, mas não foi possível agendá-lo." };
  }

  revalidatePath("/app");
  return { ok: true, collectionId: collection.id };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function updateStudentWorkout(input: {
  collectionId: string;
  name: string;
  exercises: CustomWorkoutExerciseInput[];
}): Promise<CreateCustomWorkoutResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Não autenticado." };

  const name = input.name.trim();
  if (name.length < 3) return { ok: false, message: "Dê um nome ao treino (mín. 3 letras)." };
  if (input.exercises.length === 0) {
    return { ok: false, message: "Selecione pelo menos um exercício." };
  }
  // Ids are interpolated into a PostgREST filter below — accept UUIDs only
  if (!input.exercises.every((e) => UUID_RE.test(e.exerciseId))) {
    return { ok: false, message: "Exercício inválido." };
  }

  // Defense in depth on top of RLS owner policies
  const { data: owned } = await supabase
    .from("exercise_collections")
    .select("id")
    .eq("id", input.collectionId)
    .eq("created_by", user.id)
    .maybeSingle();

  if (!owned) return { ok: false, message: "Você só pode editar treinos criados por você." };

  const { error: colError } = await supabase
    .from("exercise_collections")
    .update({
      name,
      estimated_duration_minutes: Math.max(20, input.exercises.length * 8),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.collectionId);

  if (colError) {
    console.error("updateStudentWorkout collection:", colError);
    return { ok: false, message: "Erro ao salvar o treino." };
  }

  // Upsert on (collection_id, exercise_id) keeps the row ids of exercises that
  // stay in the workout, so an in-progress session still maps its sets.
  const { error: upError } = await supabase.from("collection_exercises").upsert(
    input.exercises.map((e, idx) => ({
      collection_id: input.collectionId,
      exercise_id: e.exerciseId,
      sort_order: idx,
      default_sets: Math.min(10, Math.max(1, Math.round(e.sets) || 3)),
      default_reps: Math.min(100, Math.max(1, Math.round(e.reps) || 12)),
    })),
    { onConflict: "collection_id,exercise_id" },
  );

  if (upError) {
    console.error("updateStudentWorkout exercises:", upError);
    return { ok: false, message: "Erro ao salvar os exercícios do treino." };
  }

  const keptIds = input.exercises.map((e) => e.exerciseId);
  const { error: delError } = await supabase
    .from("collection_exercises")
    .delete()
    .eq("collection_id", input.collectionId)
    .not("exercise_id", "in", `(${keptIds.join(",")})`);

  if (delError) {
    console.error("updateStudentWorkout remove exercises:", delError);
    return { ok: false, message: "Erro ao remover exercícios do treino." };
  }

  revalidatePath("/app");
  return { ok: true, collectionId: input.collectionId };
}

export async function deleteStudentWorkout(collectionId: string): Promise<LogExerciseResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Não autenticado." };

  // Only collections the student owns pass this filter (defense in depth on
  // top of RLS owner policies).
  const { data: owned } = await supabase
    .from("exercise_collections")
    .select("id")
    .eq("id", collectionId)
    .eq("created_by", user.id)
    .maybeSingle();

  if (!owned) return { ok: false, message: "Você só pode excluir treinos criados por você." };

  // Remove own schedule rows first (collection delete is RESTRICT-referenced)
  await supabase
    .from("workout_schedules")
    .delete()
    .eq("collection_id", collectionId)
    .eq("user_id", user.id);

  const { error } = await supabase
    .from("exercise_collections")
    .delete()
    .eq("id", collectionId);

  if (error) {
    console.error("deleteStudentWorkout:", error);
    return { ok: false, message: "Erro ao excluir o treino." };
  }

  revalidatePath("/app");
  return { ok: true };
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
    .select("exercise:exercise_id(primary_muscle)")
    .in("workout_log_id", wlogIds);

  // Completed sets per muscle — the radar labels its values as "séries"
  const volume: MuscleVolume = {};
  for (const row of sets ?? []) {
    const ex = row.exercise as unknown as { primary_muscle: string | null } | null;
    const muscle = ex?.primary_muscle;
    if (!muscle) continue;
    volume[muscle] = (volume[muscle] ?? 0) + 1;
  }

  return volume;
}
