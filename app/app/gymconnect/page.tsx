import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMySquads } from "@/app/app/gymconnect-actions";
import { SquadListClient } from "@/app/components/app/gymconnect/SquadListClient";

export const revalidate = 0;

export default async function GymConnectPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const squads = await getMySquads(user.id);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-semibold text-primary uppercase tracking-widest">
          Comunidade
        </p>
        <h1 className="text-2xl font-black text-white mt-0.5">GymConnect</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Treine com quem você ama. Compare frequências e celebre recordes juntos.
        </p>
      </div>

      <SquadListClient squads={squads} />
    </div>
  );
}
