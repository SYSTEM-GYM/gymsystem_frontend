"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type WorkoutActionResult =
  | { ok: true; collectionId: string }
  | { ok: false; message: string };

export type WorkoutExerciseInput = {
  exercise_id: string;
  sort_order: number;
  default_sets: number;
  default_reps: number;
  default_weight_kg?: number | null;
  rest_seconds?: number;
  notes?: string | null;
};

export async function createWorkout(input: {
  name: string;
  description: string | null;
  gym_id: string | null;
  estimated_duration_minutes: number;
  exercises: WorkoutExerciseInput[];
}): Promise<WorkoutActionResult> {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) return { ok: false, message: "Não autorizado." };

  const { data: profile } = await authClient
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { ok: false, message: "Permissão insuficiente." };
  }

  if (!input.name.trim()) {
    return { ok: false, message: "Nome do treino é obrigatório." };
  }
  if (input.exercises.length === 0) {
    return { ok: false, message: "Adicione pelo menos um exercício ao treino." };
  }

  const admin = createAdminClient();

  // 1. Create the collection
  const { data: collection, error: colError } = await admin
    .from("exercise_collections")
    .insert({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      gym_id: input.gym_id || null,
      estimated_duration_minutes:
        input.estimated_duration_minutes > 0 ? input.estimated_duration_minutes : 60,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (colError || !collection) {
    console.error("createWorkout collection insert:", colError);
    return { ok: false, message: "Erro ao criar treino. Tente novamente." };
  }

  // 2. Bulk insert exercises
  const rows = input.exercises.map((ex) => ({
    collection_id: collection.id,
    exercise_id: ex.exercise_id,
    sort_order: ex.sort_order,
    default_sets: ex.default_sets,
    default_reps: ex.default_reps,
    default_weight_kg: ex.default_weight_kg ?? null,
    rest_seconds: ex.rest_seconds ?? 60,
    notes: ex.notes ?? null,
  }));

  const { error: exError } = await admin.from("collection_exercises").insert(rows);

  if (exError) {
    console.error("createWorkout exercises insert:", exError);
    // Roll back the collection to avoid orphans
    await admin.from("exercise_collections").delete().eq("id", collection.id);
    return { ok: false, message: "Erro ao salvar os exercícios. Tente novamente." };
  }

  revalidatePath("/dashboard/workouts");
  revalidatePath("/dashboard/settings");
  return { ok: true, collectionId: collection.id };
}
