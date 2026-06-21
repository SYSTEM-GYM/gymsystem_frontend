import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GymManager, type Gym } from "@/app/components/settings/GymManager";
import { ExerciseManager, type Exercise } from "@/app/components/settings/ExerciseManager";
import {
  CollectionManager,
  type Collection,
  type CollectionExerciseItem,
} from "@/app/components/settings/CollectionManager";
import { SettingsTabs } from "@/app/components/settings/SettingsTabs";
import type { OperatingHour } from "@/app/components/settings/GymHoursEditor";

type Props = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function SettingsPage({ searchParams }: Props) {
  const { tab = "gyms" } = await searchParams;

  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await authClient
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const admin = createAdminClient();

  let gyms: Gym[] = [];
  let exercises: Exercise[] = [];
  let collections: Collection[] = [];
  let collectionExercises: Record<string, CollectionExerciseItem[]> = {};
  let gymHours: Record<string, OperatingHour[]> = {};

  if (tab === "gyms" || tab === "collections") {
    const { data } = await admin
      .from("gyms")
      .select("id, name, city, created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true });
    gyms = (data ?? []) as Gym[];
  }

  if (tab === "gyms") {
    const gymIds = gyms.map((g) => g.id);
    if (gymIds.length > 0) {
      const { data: hoursData } = await admin
        .from("gym_operating_hours")
        .select("gym_id, day_of_week, open_time, close_time, is_closed")
        .in("gym_id", gymIds);

      for (const h of hoursData ?? []) {
        const list = gymHours[h.gym_id] ?? [];
        list.push({
          day_of_week: h.day_of_week,
          open_time: h.open_time,
          close_time: h.close_time,
          is_closed: h.is_closed,
        });
        gymHours[h.gym_id] = list;
      }
    }
  }

  if (tab === "exercises" || tab === "collections") {
    const { data } = await admin
      .from("exercises")
      .select("id, title, description, youtube_url, webm_path, created_at")
      .order("created_at", { ascending: false });
    exercises = (data ?? []) as Exercise[];
  }

  if (tab === "collections") {
    const { data: cols } = await admin
      .from("exercise_collections")
      .select("id, name, description, estimated_duration_minutes, gym_id")
      .order("created_at", { ascending: false });

    collections = (cols ?? []) as Collection[];

    if (collections.length > 0) {
      const colIds = collections.map((c) => c.id);
      const { data: ceRows } = await admin
        .from("collection_exercises")
        .select("id, collection_id, exercise_id, sort_order, exercise:exercises(id, title)")
        .in("collection_id", colIds)
        .order("sort_order", { ascending: true });

      for (const row of ceRows ?? []) {
        const ex = Array.isArray(row.exercise) ? row.exercise[0] : row.exercise;
        if (!ex) continue;
        const list = collectionExercises[row.collection_id] ?? [];
        list.push({
          id: row.id,
          exercise_id: row.exercise_id,
          sort_order: row.sort_order,
          exercise: ex,
        });
        collectionExercises[row.collection_id] = list;
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Gerencie filiais, exercícios e coleções de treino.
        </p>
      </div>

      <SettingsTabs activeTab={tab} />

      {tab === "gyms" && (
        <GymManager initialGyms={gyms} gymHours={gymHours} />
      )}
      {tab === "exercises" && <ExerciseManager initialExercises={exercises} />}
      {tab === "collections" && (
        <CollectionManager
          initialCollections={collections}
          collectionExercises={collectionExercises}
          allExercises={exercises}
          gyms={gyms.map((g) => ({ id: g.id, name: g.name }))}
        />
      )}
    </div>
  );
}
