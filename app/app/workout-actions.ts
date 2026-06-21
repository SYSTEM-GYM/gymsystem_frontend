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
  | { ok: true; workoutLogId: string }
  | { ok: false; message: string };

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
  const exerciseAgg: Record<string, { weight: number | null; reps: number | null; sets: number }> = {};
  for (const s of input.sets) {
    if (!exerciseAgg[s.exerciseId]) {
      exerciseAgg[s.exerciseId] = { weight: s.weightKg, reps: s.repsCompleted, sets: 0 };
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

  revalidatePath("/app");
  return { ok: true, workoutLogId: workoutLog.id };
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
