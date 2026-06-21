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
