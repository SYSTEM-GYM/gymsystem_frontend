import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { WorkoutBuilder, type ExerciseOption } from "@/app/components/workouts/WorkoutBuilder";

export default async function NewWorkoutPage() {
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

  const [{ data: exercises }, { data: gyms }] = await Promise.all([
    admin
      .from("exercises")
      .select("id, title, translated_name, primary_muscle, youtube_url, webm_path, video_url")
      .order("title", { ascending: true })
      .returns<ExerciseOption[]>(),
    admin
      .from("gyms")
      .select("id, name")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true }),
  ]);

  return (
    <WorkoutBuilder
      exercises={exercises ?? []}
      gyms={gyms ?? []}
    />
  );
}
