export type ScheduleType = "weekly" | "monthly" | "session" | "custom";

export type CollectionExerciseRow = {
  id: string;
  exercise_id: string;
  sort_order: number;
  default_sets: number;
  default_reps: number;
  default_weight_kg: number | null;
  exercise: {
    id: string;
    title: string;
    description: string | null;
    youtube_url: string | null;
    webm_path: string | null;
  };
};

export type TodayWorkoutData = {
  collectionId: string;
  collectionName: string;
  estimatedDurationMinutes: number;
  scheduleType: string;
  exercises: CollectionExerciseRow[];
};

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function dayLabel(day: number): string {
  return DAY_LABELS[day] ?? String(day);
}

/** Resolves today's workout collection for a user (mirrors backend logic). */
export async function resolveTodayWorkout(
  supabase: {
    from: (table: string) => ReturnType<
      import("@supabase/supabase-js").SupabaseClient["from"]
    >;
  },
  userId: string,
): Promise<TodayWorkoutData | null> {
  const dayOfWeek = new Date().getDay();

  const { data: weeklySchedule } = await supabase
    .from("workout_schedules")
    .select("collection_id, schedule_type")
    .eq("user_id", userId)
    .eq("schedule_type", "weekly")
    .eq("day_of_week", dayOfWeek)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  let collectionId = weeklySchedule?.collection_id ?? null;
  let scheduleType = weeklySchedule?.schedule_type ?? "session";

  if (!collectionId) {
    const { data: sessionSchedules } = await supabase
      .from("workout_schedules")
      .select("collection_id")
      .eq("user_id", userId)
      .eq("schedule_type", "session")
      .order("sort_order", { ascending: true });

    if (sessionSchedules && sessionSchedules.length > 0) {
      const { count } = await supabase
        .from("workout_execution_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);

      const idx = (count ?? 0) % sessionSchedules.length;
      collectionId = sessionSchedules[idx].collection_id;
      scheduleType = "session";
    }
  }

  if (!collectionId) {
    const { data: customSchedule } = await supabase
      .from("workout_schedules")
      .select("collection_id")
      .eq("user_id", userId)
      .eq("schedule_type", "custom")
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    collectionId = customSchedule?.collection_id ?? null;
    scheduleType = "custom";
  }

  if (!collectionId) return null;

  const { data: collection } = await supabase
    .from("exercise_collections")
    .select("id, name, estimated_duration_minutes")
    .eq("id", collectionId)
    .single();

  if (!collection) return null;

  const { data: rows } = await supabase
    .from("collection_exercises")
    .select(
      `id, exercise_id, sort_order, default_sets, default_reps, default_weight_kg,
       exercise:exercises(id, title, description, youtube_url, webm_path)`,
    )
    .eq("collection_id", collectionId)
    .order("sort_order", { ascending: true });

  type RawRow = {
    id: string;
    exercise_id: string;
    sort_order: number;
    default_sets: number;
    default_reps: number;
    default_weight_kg: number | null;
    exercise: CollectionExerciseRow["exercise"] | CollectionExerciseRow["exercise"][];
  };

  const exercises: CollectionExerciseRow[] = ((rows ?? []) as RawRow[])
    .map((r) => {
      const ex = Array.isArray(r.exercise) ? r.exercise[0] : r.exercise;
      if (!ex) return null;
      return {
        id: r.id,
        exercise_id: r.exercise_id,
        sort_order: r.sort_order,
        default_sets: r.default_sets,
        default_reps: r.default_reps,
        default_weight_kg: r.default_weight_kg,
        exercise: ex,
      };
    })
    .filter((e): e is CollectionExerciseRow => e !== null);

  return {
    collectionId: collection.id,
    collectionName: collection.name,
    estimatedDurationMinutes: collection.estimated_duration_minutes,
    scheduleType,
    exercises,
  };
}
