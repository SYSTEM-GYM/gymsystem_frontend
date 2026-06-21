import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSquadDetail } from "@/app/app/gymconnect-actions";
import { SquadDashboard } from "@/app/components/app/gymconnect/SquadDashboard";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export const revalidate = 0;

export default async function SquadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const squad = await getSquadDetail(id, user.id);
  if (!squad) notFound();

  return (
    <div className="space-y-4">
      <Link
        href="/app/gymconnect"
        className="inline-flex items-center gap-2 text-xs text-zinc-500 hover:text-white transition-colors"
      >
        <ArrowLeftIcon className="w-3.5 h-3.5" />
        Meus Squads
      </Link>

      <SquadDashboard squad={squad} currentUserId={user.id} />
    </div>
  );
}
