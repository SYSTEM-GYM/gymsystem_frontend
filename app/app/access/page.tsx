import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { QrDisplay } from "@/app/components/app/QrDisplay";
import { TurnstileScanner } from "@/app/components/app/TurnstileScanner";

export default async function AccessPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("first_name, full_name, status, home_gym_id")
    .eq("id", user.id)
    .single();

  const firstName =
    profile?.first_name ?? profile?.full_name?.split(" ")[0] ?? "Aluno";
  const isActive = profile?.status === "active";
  const homeGymId = profile?.home_gym_id ?? null;

  let gymName: string | null = null;
  if (homeGymId) {
    const { data: gym } = await supabase
      .from("gyms")
      .select("name, city")
      .eq("id", homeGymId)
      .single();
    gymName = gym ? `${gym.name} — ${gym.city}` : null;
  }

  return (
    <>
      <QrDisplay
        userId={user.id}
        firstName={firstName}
        isActive={isActive}
        gymName={gymName}
      />
      <TurnstileScanner />
    </>
  );
}
