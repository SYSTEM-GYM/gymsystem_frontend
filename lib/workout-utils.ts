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
    translated_name: string | null;
    description: string | null;
    instructions: string | null;
    youtube_url: string | null;
    webm_path: string | null;
    video_url: string | null;
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

export type StudentWorkoutItem = TodayWorkoutData & {
  /** True for the session the old "Treino de Hoje" logic would have picked. */
  suggestedToday: boolean;
  /** True when the collection was created by the student (self-service). */
  createdByMe: boolean;
};

type SupabaseLike = {
  from: (table: string) => ReturnType<
    import("@supabase/supabase-js").SupabaseClient["from"]
  >;
};

/**
 * Fetches every workout session assigned to the student (A, B, C…), in
 * schedule order, marking which one would be today's suggestion (weekly match
 * → session rotation → first). The student picks freely from the shelf.
 */
export async function fetchStudentWorkouts(
  supabase: SupabaseLike,
  userId: string,
): Promise<StudentWorkoutItem[]> {
  const { data: schedules } = await supabase
    .from("workout_schedules")
    .select("collection_id, schedule_type, day_of_week, sort_order")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true });

  type ScheduleRow = {
    collection_id: string;
    schedule_type: string;
    day_of_week: number | null;
    sort_order: number;
  };
  const allSchedules = (schedules ?? []) as ScheduleRow[];
  if (allSchedules.length === 0) return [];

  // Dedupe collections preserving schedule order
  const collectionIds: string[] = [];
  for (const s of allSchedules) {
    if (!collectionIds.includes(s.collection_id)) collectionIds.push(s.collection_id);
  }

  // Suggestion mirrors the legacy resolveTodayWorkout fallback chain
  const dayOfWeek = new Date().getDay();
  let suggestedId =
    allSchedules.find(
      (s) => s.schedule_type === "weekly" && s.day_of_week === dayOfWeek,
    )?.collection_id ?? null;

  if (!suggestedId) {
    const sessionSchedules = allSchedules.filter((s) => s.schedule_type === "session");
    if (sessionSchedules.length > 0) {
      const { count } = await supabase
        .from("workout_execution_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      suggestedId = sessionSchedules[(count ?? 0) % sessionSchedules.length].collection_id;
    }
  }
  if (!suggestedId) suggestedId = collectionIds[0];

  const [{ data: collections }, { data: rows }] = await Promise.all([
    supabase
      .from("exercise_collections")
      .select("id, name, estimated_duration_minutes, created_by")
      .in("id", collectionIds),
    supabase
      .from("collection_exercises")
      .select(
        `id, collection_id, exercise_id, sort_order, default_sets, default_reps, default_weight_kg,
         exercise:exercises(id, title, translated_name, description, instructions, youtube_url, webm_path, video_url)`,
      )
      .in("collection_id", collectionIds)
      .order("sort_order", { ascending: true }),
  ]);

  type RawRow = {
    id: string;
    collection_id: string;
    exercise_id: string;
    sort_order: number;
    default_sets: number;
    default_reps: number;
    default_weight_kg: number | null;
    exercise: CollectionExerciseRow["exercise"] | CollectionExerciseRow["exercise"][];
  };

  const exercisesByCollection: Record<string, CollectionExerciseRow[]> = {};
  for (const r of (rows ?? []) as RawRow[]) {
    const ex = Array.isArray(r.exercise) ? r.exercise[0] : r.exercise;
    if (!ex) continue;
    (exercisesByCollection[r.collection_id] ??= []).push({
      id: r.id,
      exercise_id: r.exercise_id,
      sort_order: r.sort_order,
      default_sets: r.default_sets,
      default_reps: r.default_reps,
      default_weight_kg: r.default_weight_kg,
      exercise: ex,
    });
  }

  type CollectionRow = {
    id: string;
    name: string;
    estimated_duration_minutes: number;
    created_by: string;
  };
  const collectionById = new Map(
    ((collections ?? []) as CollectionRow[]).map((c) => [c.id, c]),
  );

  const scheduleTypeByCollection = new Map(
    allSchedules.map((s) => [s.collection_id, s.schedule_type] as const),
  );

  return collectionIds
    .map((id) => {
      const collection = collectionById.get(id);
      if (!collection) return null;
      return {
        collectionId: collection.id,
        collectionName: collection.name,
        estimatedDurationMinutes: collection.estimated_duration_minutes,
        scheduleType: scheduleTypeByCollection.get(id) ?? "session",
        exercises: exercisesByCollection[id] ?? [],
        suggestedToday: id === suggestedId,
        createdByMe: collection.created_by === userId,
      };
    })
    .filter((w): w is StudentWorkoutItem => w !== null);
}
