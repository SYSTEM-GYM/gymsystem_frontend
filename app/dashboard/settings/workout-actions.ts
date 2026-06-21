"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SettingsActionState } from "./actions";

async function requireAdmin() {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) return { ok: false as const, message: "Não autorizado." };

  const { data: profile } = await authClient
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { ok: false as const, message: "Permissão insuficiente." };
  }

  return { ok: true as const, userId: user.id };
}

async function writeAudit(
  actorId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata: Record<string, unknown> = {},
) {
  const admin = createAdminClient();
  await admin.from("audit_logs").insert({
    actor_id: actorId,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    metadata,
  });
}

// ── Collections ───────────────────────────────────────────────────────────────

export async function createCollection(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const auth = await requireAdmin();
  if (!auth.ok) return { status: "error", message: auth.message };

  const name = (formData.get("name") as string).trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const gymId = (formData.get("gym_id") as string | null)?.trim() || null;
  const duration = parseInt((formData.get("estimated_duration_minutes") as string) || "60", 10);

  if (!name) return { status: "error", message: "Nome da coleção é obrigatório." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("exercise_collections")
    .insert({
      name,
      description,
      gym_id: gymId || null,
      estimated_duration_minutes: duration > 0 ? duration : 60,
      created_by: auth.userId,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("createCollection:", error);
    return { status: "error", message: "Erro ao criar coleção." };
  }

  await writeAudit(auth.userId, "create", "exercise_collection", data.id, { name });
  revalidatePath("/dashboard/settings");
  return { status: "success" };
}

export async function addExerciseToCollection(
  collectionId: string,
  exerciseId: string,
  sortOrder: number,
): Promise<{ ok: boolean; message?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, message: auth.message };

  const admin = createAdminClient();
  const { error } = await admin.from("collection_exercises").upsert(
    {
      collection_id: collectionId,
      exercise_id: exerciseId,
      sort_order: sortOrder,
    },
    { onConflict: "collection_id,exercise_id" },
  );

  if (error) {
    console.error("addExerciseToCollection:", error);
    return { ok: false, message: "Erro ao adicionar exercício." };
  }

  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function removeExerciseFromCollection(
  collectionExerciseId: string,
): Promise<{ ok: boolean; message?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, message: auth.message };

  const admin = createAdminClient();
  const { error } = await admin
    .from("collection_exercises")
    .delete()
    .eq("id", collectionExerciseId);

  if (error) return { ok: false, message: "Erro ao remover exercício." };

  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function reorderCollectionExercises(
  items: { id: string; sort_order: number }[],
): Promise<{ ok: boolean }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false };

  const admin = createAdminClient();
  for (const item of items) {
    await admin
      .from("collection_exercises")
      .update({ sort_order: item.sort_order })
      .eq("id", item.id);
  }

  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function assignWorkoutSchedule(input: {
  userId: string;
  collectionId: string;
  scheduleType: "weekly" | "session" | "custom";
  dayOfWeek?: number;
  sessionLabel?: string;
  sortOrder?: number;
}): Promise<{ ok: boolean; message?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, message: auth.message };

  const admin = createAdminClient();
  const { error } = await admin.from("workout_schedules").insert({
    user_id: input.userId,
    collection_id: input.collectionId,
    schedule_type: input.scheduleType,
    day_of_week: input.dayOfWeek ?? null,
    session_label: input.sessionLabel ?? null,
    sort_order: input.sortOrder ?? 0,
  });

  if (error) {
    console.error("assignWorkoutSchedule:", error);
    return { ok: false, message: "Erro ao atribuir cronograma." };
  }

  await writeAudit(auth.userId, "create", "workout_schedule", input.userId, input);
  revalidatePath(`/dashboard/members/${input.userId}`);
  revalidatePath("/app");
  return { ok: true };
}

// ── Gym operating hours ───────────────────────────────────────────────────────

export async function saveGymOperatingHours(
  gymId: string,
  hours: {
    day_of_week: number;
    open_time: string;
    close_time: string;
    is_closed: boolean;
  }[],
): Promise<{ ok: boolean; message?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, message: auth.message };

  const admin = createAdminClient();

  for (const h of hours) {
    const { error } = await admin.from("gym_operating_hours").upsert(
      {
        gym_id: gymId,
        day_of_week: h.day_of_week,
        open_time: h.open_time,
        close_time: h.close_time,
        is_closed: h.is_closed,
      },
      { onConflict: "gym_id,day_of_week" },
    );
    if (error) {
      console.error("saveGymOperatingHours:", error);
      return { ok: false, message: "Erro ao salvar horários." };
    }
  }

  revalidatePath("/dashboard/settings");
  return { ok: true };
}
