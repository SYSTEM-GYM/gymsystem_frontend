import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GymManager, type Gym } from "@/app/components/settings/GymManager";
import { ExerciseManager, type Exercise } from "@/app/components/settings/ExerciseManager";
import { SettingsTabs } from "@/app/components/settings/SettingsTabs";

type Props = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function SettingsPage({ searchParams }: Props) {
  const { tab = "gyms" } = await searchParams;

  // Auth guard
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

  // Fetch data for active tab only (avoids unnecessary queries)
  const admin = createAdminClient();

  let gyms: Gym[] = [];
  let exercises: Exercise[] = [];

  if (tab === "gyms") {
    const { data } = await admin
      .from("gyms")
      .select("id, name, city, created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true });
    gyms = (data ?? []) as Gym[];
  }

  if (tab === "exercises") {
    const { data } = await admin
      .from("exercises")
      .select("id, title, description, youtube_url, webm_path, created_at")
      .order("created_at", { ascending: false });
    exercises = (data ?? []) as Exercise[];
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Gerencie filiais e a biblioteca de exercícios.
        </p>
      </div>

      {/* Tab bar */}
      <SettingsTabs activeTab={tab} />

      {/* Tab content */}
      {tab === "gyms" && <GymManager initialGyms={gyms} />}
      {tab === "exercises" && <ExerciseManager initialExercises={exercises} />}
    </div>
  );
}
